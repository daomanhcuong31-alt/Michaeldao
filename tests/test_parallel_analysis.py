import time

from workflow.state import DealState
import workflow.parallel_analysis as pa


def test_hermes_serial_mode_runs_without_thread_lock_contention(monkeypatch):
    order = []

    def fake_fin(state):
        order.append("financial_modeler")
        state.financial_model = {"ok": True}
        state.mark_complete("financial_modeler")
        return state.dict()

    def fake_comp(state):
        order.append("compliance")
        state.compliance_flags = [{"severity": "LOW", "issue": "test"}]
        state.regulatory_summary = "ok"
        state.mark_complete("compliance")
        return state.dict()

    monkeypatch.setenv("LLM_PROVIDER", "hermes")
    monkeypatch.setattr(pa, "run_financial_modeler_agent", fake_fin)
    monkeypatch.setattr(pa, "run_compliance_agent", fake_comp)

    state = DealState()
    out = pa.run_parallel_analysis_agent(state)
    assert "analysis_parallel" in out["completed_steps"]
    assert "financial_modeler" in out["completed_steps"]
    assert "compliance" in out["completed_steps"]
    assert order == ["financial_modeler", "compliance"]


def test_parallel_timeout_guard_adds_error(monkeypatch):
    def slow(state):
        time.sleep(6)
        return state.dict()

    monkeypatch.setenv("LLM_PROVIDER", "lm_studio")
    monkeypatch.setenv("ANALYSIS_PARALLEL_JOIN_TIMEOUT_SEC", "1")
    monkeypatch.setattr(pa, "run_financial_modeler_agent", slow)
    monkeypatch.setattr(pa, "run_compliance_agent", slow)

    state = DealState()
    out = pa.run_parallel_analysis_agent(state)
    assert "analysis_parallel" in out["completed_steps"]
    assert "financial_modeler" in out["completed_steps"]
    assert "compliance" in out["completed_steps"]
    assert any("timed out" in e.get("error", "") for e in out["errors"])


def test_branch_failure_applies_fallback_and_marks_complete(monkeypatch):
    def boom(_state):
        raise RuntimeError("boom")

    monkeypatch.setenv("LLM_PROVIDER", "lm_studio")
    monkeypatch.setattr(pa, "run_financial_modeler_agent", boom)
    monkeypatch.setattr(pa, "run_compliance_agent", boom)

    state = DealState()
    out = pa.run_parallel_analysis_agent(state)
    assert "analysis_parallel" in out["completed_steps"]
    assert "financial_modeler" in out["completed_steps"]
    assert "compliance" in out["completed_steps"]
    assert out["financial_model"]["data_quality"] == "INSUFFICIENT"
    assert "UNKNOWN" in out["regulatory_summary"]
    assert any("fallback applied" in e.get("error", "") for e in out["errors"])
