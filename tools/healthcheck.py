"""
tools/healthcheck.py - Lightweight LM Studio preflight checks
"""

from __future__ import annotations

from urllib.parse import urlparse

import requests


def _normalize_base_url(base_url: str) -> str:
    raw = (base_url or "").strip()
    if not raw:
        raise ValueError("LM_STUDIO_BASE_URL is empty")
    if not raw.startswith(("http://", "https://")):
        raise ValueError("LM_STUDIO_BASE_URL must start with http:// or https://")
    parsed = urlparse(raw)
    if not parsed.netloc:
        raise ValueError("LM_STUDIO_BASE_URL is missing host:port")
    return raw.rstrip("/")


def _models_url(base_url: str) -> str:
    if base_url.endswith("/v1"):
        return f"{base_url}/models"
    return f"{base_url}/v1/models"


def _hermes_health_url(base_url: str) -> str:
    root = base_url[:-3] if base_url.endswith("/v1") else base_url
    return f"{root.rstrip('/')}/health"


def preflight_lm_studio(base_url: str, model: str, timeout_sec: float = 5.0, provider: str = "lm_studio") -> dict:
    """
    Returns:
      {
        "ok": bool,
        "models_url": str,
        "model_present": bool,
        "warning": str,
        "error": str,
        "model_count": int
      }
    """
    # Anthropic: no local server to check — API key validated at call time
    if (provider or "").strip().lower() == "anthropic":
        return {
            "ok": True,
            "models_url": "https://api.anthropic.com/v1/models",
            "model_present": True,
            "warning": "",
            "error": "",
            "model_count": 1,
        }

    try:
        normalized = _normalize_base_url(base_url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "models_url": "", "model_present": False, "warning": "", "model_count": 0}

    if (provider or "").strip().lower() == "hermes":
        url = _hermes_health_url(normalized)
        root = normalized[:-3] if normalized.endswith('/v1') else normalized
        alt_url = f"{normalized.rstrip('/')}/health"
        api_health_url = f"{root.rstrip('/')}/api/health"

        def _is_healthy(payload: object) -> bool:
            if not isinstance(payload, dict):
                return False
            if payload.get("ok") is True:
                return True
            if str(payload.get("status", "")).strip().lower() == "ok":
                return True
            return payload.get("ready") is True

        last_err = None
        for candidate in (url, api_health_url, alt_url):
            try:
                resp = requests.get(candidate, timeout=timeout_sec)
                resp.raise_for_status()
                payload = resp.json()
                if _is_healthy(payload):
                    return {
                        "ok": True,
                        "models_url": candidate,
                        "model_present": True,  # model validation handled by hermes infer runtime
                        "warning": "Hermes health check passed; model list validation is skipped for this provider.",
                        "error": "",
                        "model_count": 0,
                    }
                last_err = f"Hermes health endpoint unhealthy: {payload}"
            except Exception as exc:
                last_err = str(exc)

        return {
            "ok": False,
            "error": f"Hermes health unreachable: {last_err}",
            "models_url": url,
            "model_present": False,
            "warning": "",
            "model_count": 0,
        }

    url = _models_url(normalized)
    try:
        resp = requests.get(url, timeout=timeout_sec)
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        return {"ok": False, "error": f"LM Studio /v1/models unreachable: {exc}", "models_url": url, "model_present": False, "warning": "", "model_count": 0}

    items = payload.get("data", []) if isinstance(payload, dict) else []
    model_ids = [str(item.get("id", "")).strip() for item in items if isinstance(item, dict)]
    configured = (model or "").strip()
    present = configured in model_ids if configured else False
    warning = ""
    if configured and not present:
        warning = f"Configured model '{configured}' not in /v1/models list; continuing (alias mismatch may be expected)."

    return {
        "ok": True,
        "models_url": url,
        "model_present": present,
        "warning": warning,
        "error": "",
        "model_count": len(model_ids),
    }
