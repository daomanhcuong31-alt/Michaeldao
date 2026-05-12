from tools import healthcheck


class _Resp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_lmstudio_preflight_ok_with_model_present(monkeypatch):
    def fake_get(url, timeout=5.0):
        assert url.endswith("/v1/models")
        return _Resp({"data": [{"id": "qwen/qwen3.5-9b"}]})

    monkeypatch.setattr(healthcheck.requests, "get", fake_get)
    out = healthcheck.preflight_lm_studio("http://127.0.0.1:1234/v1", "qwen/qwen3.5-9b", provider="lm_studio")
    assert out["ok"] is True
    assert out["model_present"] is True


def test_hermes_preflight_uses_health_endpoint(monkeypatch):
    called = {"url": None}

    def fake_get(url, timeout=5.0):
        called["url"] = url
        return _Resp({"ok": True, "status": "live"})

    monkeypatch.setattr(healthcheck.requests, "get", fake_get)
    out = healthcheck.preflight_lm_studio("http://127.0.0.1:18789", "lmstudio/qwen/qwen3.5-9b", provider="hermes")
    assert out["ok"] is True
    assert called["url"].endswith("/health")
    assert "skipped" in out["warning"].lower()
