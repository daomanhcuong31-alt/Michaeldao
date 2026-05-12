from types import SimpleNamespace

import agents.base as base_module


class _Agent(base_module.BaseAgent):
    name = "unit_test_agent"


def test_hermes_infer_json_parsing(monkeypatch):
    payload = '{"ok":true,"outputs":[{"text":"HELLO"}]}'

    def fake_run(cmd, capture_output, text, timeout, check):
        assert "hermes" in cmd[0]
        return SimpleNamespace(returncode=0, stdout=f"diagnostic\\n{payload}\\n", stderr="")

    monkeypatch.setattr(base_module.subprocess, "run", fake_run)
    monkeypatch.setattr(base_module.settings, "llm_provider", "hermes")
    monkeypatch.setattr(base_module.settings, "model", "lmstudio/qwen/qwen3.5-9b")

    agent = _Agent()
    out = agent.call_llm("Say hello", system_override="system")
    assert out == "HELLO"
