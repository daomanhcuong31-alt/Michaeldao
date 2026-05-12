"""
workflow/parallel_analysis.py - Run financial + compliance in parallel.
"""

import os
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import wait, FIRST_COMPLETED
from workflow.state import DealState
from agents.financial_modeler import run_financial_modeler_agent
from agents.compliance import run_compliance_agent
from agents.market_intel import run_market_intel_agent


def _clone_state(state: DealState) -> DealState:
    if hasattr(state, "model_copy"):
        return state.model_copy(deep=True)  # pydantic v2
    return state.copy(deep=True)  # pydantic v1


def _run_branch(runner, state: DealState) -> DealState:
    local_state = _clone_state(state)
    result = runner(local_state)
    if isinstance(result, DealState):
        return result
    return DealState(**result)


def _join_timeout_sec() -> int:
    raw = os.getenv("ANALYSIS_PARALLEL_JOIN_TIMEOUT_SEC", "").strip()
    if raw:
        try:
            return max(5, int(raw))
        except Exception:
            pass
    fast_mode = str(os.getenv("SF_FAST_MODE", "false")).strip().lower() in {"1", "true", "yes", "on"}
    provider = str(os.getenv("LLM_PROVIDER", "lm_studio")).strip().lower()
    if provider in {"hermes", "hermes"}:
        return 180 if fast_mode else 300
    return 45 if fast_mode else 90


def _apply_branch_result(state: DealState, name: str, branch_state: DealState):
    if name == "financial_modeler":
        state.financial_model = branch_state.financial_model
        state.mark_complete("financial_modeler")
    elif name == "compliance":
        state.compliance_flags = branch_state.compliance_flags
        state.regulatory_summary = branch_state.regulatory_summary
        state.mark_complete("compliance")
    elif name == "market_intel":
        state.market_context = branch_state.market_context
        state.mark_complete("market_intel")

    for err in branch_state.errors:
        if err.get("agent") == name and err not in state.errors:
            state.errors.append(err)


def _mark_branch_failed(state: DealState, name: str, reason: str):
    if name == "financial_modeler":
        if not state.financial_model:
            state.financial_model = {
                "parameters": {},
                "calculated_metrics": {"note": "financial model unavailable; fallback used"},
                "narrative": "Financial model branch failed; manual review required.",
                "accounting_standard": "Unknown",
                "data_quality": "INSUFFICIENT",
            }
        state.mark_complete("financial_modeler")
    elif name == "compliance":
        if not state.compliance_flags:
            state.compliance_flags = [{
                "severity": "HIGH",
                "category": "Process",
                "issue": "Compliance branch failed during runtime",
                "regulation_reference": "NEEDS VERIFICATION",
                "verification_status": "NEEDS VERIFICATION",
                "recommendation": "Manual legal/compliance review is mandatory before approval",
                "deal_breaker": False,
            }]
        if not state.regulatory_summary:
            state.regulatory_summary = (
                '{"overall_position":"UNKNOWN — REVIEW REQUIRED",'
                '"disclaimer":"Automated compliance screening failed; human verification required."}'
            )
        state.mark_complete("compliance")
    elif name == "market_intel":
        if not state.market_context:
            state.market_context = {"error": f"Market Intel branch failed during runtime: {reason}"}
        state.mark_complete("market_intel")
    state.add_error("analysis_parallel", f"{name} fallback applied: {reason}")


def run_parallel_analysis_agent(state: DealState) -> dict:
    completed = set(state.completed_steps)
    active_plan = state.manager_plan.get("workers", [])
    print(f"[Parallel Analysis] active_plan={active_plan} completed={sorted(list(completed))}")
    tasks = {}

    if active_plan:
        if "market_intel" in active_plan and "market_intel" not in completed:
            tasks["market_intel"] = run_market_intel_agent
        if "financial_modeler" in active_plan and "financial_modeler" not in completed:
            tasks["financial_modeler"] = run_financial_modeler_agent
        if "compliance" in active_plan and "compliance" not in completed:
            tasks["compliance"] = run_compliance_agent
    else:
        # Backward-compatible default when manager has not yet emitted an explicit worker plan.
        if "financial_modeler" not in completed:
            tasks["financial_modeler"] = run_financial_modeler_agent
        if "compliance" not in completed:
            tasks["compliance"] = run_compliance_agent

    if not tasks:
        state.mark_complete("analysis_parallel")
        return state.dict()

    provider = str(os.getenv("LLM_PROVIDER", "lm_studio")).strip().lower()
    join_timeout_sec = _join_timeout_sec()
    if provider in {"hermes", "hermes"}:
        print(f"[Parallel Analysis] Running {list(tasks.keys())} branches in serial mode for {provider} provider...")
        for name, fn in tasks.items():
            try:
                branch_state = _run_branch(fn, state)
                _apply_branch_result(state, name, branch_state)
            except Exception as exc:
                _mark_branch_failed(state, name, str(exc))
        state.mark_complete("analysis_parallel")
        worker_summary = ", ".join([f"{n}={n in state.completed_steps}" for n in tasks])
        print(f"[Parallel Analysis] Complete ({worker_summary})")
        return state.dict()

    print(f"[Parallel Analysis] Running {list(tasks.keys())} in parallel...")

    pool = ThreadPoolExecutor(max_workers=len(tasks))
    futures = {name: pool.submit(_run_branch, fn, state) for name, fn in tasks.items()}
    name_by_future = {fut: name for name, fut in futures.items()}
    remaining = set(futures.values())
    completed_futures = set()

    try:
        # Global join timeout: protects against non-LLM hangs in any parallel branch.
        while remaining:
            done, remaining = wait(remaining, timeout=join_timeout_sec, return_when=FIRST_COMPLETED)
            if not done:
                break
            completed_futures.update(done)

        for fut in completed_futures:
            name = name_by_future[fut]
            try:
                branch_state = fut.result()
            except Exception as exc:
                _mark_branch_failed(state, name, str(exc))
                continue

            _apply_branch_result(state, name, branch_state)
    finally:
        stuck = remaining if "remaining" in locals() else set()
        if stuck:
            for fut in stuck:
                name = name_by_future[fut]
                fut.cancel()
                _mark_branch_failed(
                    state,
                    name,
                    f"branch timed out after {join_timeout_sec}s; branch aborted to prevent pipeline hang",
                )
        pool.shutdown(wait=False, cancel_futures=True)

    state.mark_complete("analysis_parallel")
    worker_summary = ", ".join([f"{n}={n in state.completed_steps}" for n in tasks])
    print(f"[Parallel Analysis] Complete ({worker_summary})")
    return state.dict()
