#!/usr/bin/env python3
"""
diagnose_gateways.py - Quick connectivity check for LM Studio and Hermes.
"""

import os
from tools.healthcheck import preflight_lm_studio


def check_provider(name: str, base_url: str, model: str) -> bool:
    print(f"\n--- Checking {name.upper()} ---")
    print(f"URL:   {base_url}")
    print(f"Model: {model}")

    result = preflight_lm_studio(base_url, model, provider=name)
    if result.get("ok"):
        print("STATUS: OK")
        if result.get("warning"):
            print(f"INFO:   {result['warning']}")
        return True

    print("STATUS: FAILED")
    print(f"ERROR:  {result.get('error')}")
    return False


if __name__ == "__main__":
    lm_url = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    lm_model = os.getenv("LM_STUDIO_MODEL", "qwen/qwen3.5-9b")

    hermes_url = os.getenv("HERMES_BASE_URL", "http://127.0.0.1:8000/v1")
    hermes_model = os.getenv("HERMES_MODEL", "qwen/qwen3.5-9b")

    print("SF Agentic AI Gateway Diagnostics")
    ok_lm = check_provider("lm_studio", lm_url, lm_model)
    ok_hermes = check_provider("hermes", hermes_url, hermes_model)

    print("\nTip: run with Hermes provider:")
    print("LLM_PROVIDER=hermes python3 main.py --sample --autonomous")

    raise SystemExit(0 if (ok_lm or ok_hermes) else 1)
