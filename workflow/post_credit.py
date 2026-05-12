"""
workflow/post_credit.py - Stage-2 flow after human review of credit memo.
"""

import json
from typing import Any, Dict
from workflow.state import DealState
from agents.distribution_advisor import run_distribution_advisor_agent
from agents.operations_planner import run_operations_planner_agent
from tools.research_client import run_perplexity_investor_research

VALID_MODES = {"STOP", "HOLDBOOK", "DISTRIBUTION", "HYBRID"}


def _normalize_mode(mode: str) -> str:
    m = (mode or "STOP").strip().upper()
    if m in {"HOLD_BOOK", "HOLD-BOOK"}:
        m = "HOLDBOOK"
    if m not in VALID_MODES:
        m = "STOP"
    return m


def run_post_credit_workflow(state: DealState, mode: str = "STOP", run_web_research: bool = True) -> Dict[str, Any]:
    mode = _normalize_mode(mode)
    state.post_credit_mode = mode

    if mode == "STOP":
        return {
            "status": "skipped",
            "mode": mode,
            "reason": "Human selected stop after credit memo.",
            "research": {},
            "distribution_advice": {},
            "operations_plan": {},
        }

    needs_distribution = mode in {"DISTRIBUTION", "HYBRID"}
    needs_holdbook = mode in {"HOLDBOOK", "HYBRID"}
    research_bundle = {"status": "skipped", "reason": "Not requested", "data": {"sources": [], "summary": ""}}
    distribution_advice = {}
    operations_plan = {}

    if needs_distribution:
        if run_web_research:
            research_bundle = run_perplexity_investor_research(
                parsed_terms=state.parsed_terms,
                market_context=state.market_context,
                compliance_flags=state.compliance_flags,
            )
        pref = {"DISTRIBUTION": "DISTRIBUTE", "HYBRID": "HYBRID"}.get(mode, "AUTO")
        distribution_advice = run_distribution_advisor_agent(
            state,
            research_bundle=research_bundle,
            preferred_mode=pref,
        )

    if needs_holdbook:
        operations_plan = run_operations_planner_agent(
            state,
            distribution_advice=distribution_advice if distribution_advice else {"distribution_recommendation": "HOLD_BOOK"},
            mode=mode,
        )

    state.investor_research = research_bundle
    state.distribution_advice = distribution_advice
    state.operations_workplan = operations_plan

    return {
        "status": "completed",
        "mode": mode,
        "status_log": [
            "distribution_stage=done" if needs_distribution else "distribution_stage=skipped",
            "holdbook_stage=done" if needs_holdbook else "holdbook_stage=skipped",
        ],
        "research": research_bundle,
        "distribution_advice": distribution_advice,
        "operations_plan": operations_plan,
    }


def render_post_credit_report(bundle: Dict[str, Any]) -> str:
    mode = bundle.get("mode", "STOP")
    status = bundle.get("status", "unknown")
    research = bundle.get("research", {}) or {}
    advice = bundle.get("distribution_advice", {}) or {}
    ops = bundle.get("operations_plan", {}) or {}

    lines = []
    lines.append("# Post-Credit Execution Pack")
    lines.append("")
    lines.append(f"- Status: {status}")
    lines.append(f"- Mode: {mode}")
    lines.append("")

    lines.append("## Distribution Recommendation")
    lines.append(f"- Recommendation: {advice.get('distribution_recommendation', 'N/A')}")
    lines.append(f"- Confidence: {advice.get('confidence', 'N/A')}")
    if advice.get("must_resolve_before_launch"):
        lines.append("- Must resolve before launch:")
        for item in advice.get("must_resolve_before_launch", []):
            lines.append(f"  - {item}")
    lines.append("")

    lines.append("## Research")
    lines.append(f"- Research status: {research.get('status', 'N/A')}")
    sources = ((research.get("data") or {}).get("sources") or [])
    lines.append(f"- Sources captured: {len(sources)}")
    for src in sources[:8]:
        sid = src.get("id", "S?")
        title = src.get("title", "Untitled")
        date = src.get("date", "Unknown")
        url = src.get("url", "")
        lines.append(f"  - {sid} | {title} | {date} | {url}")
    lines.append("")

    lines.append("## Operations Workplan")
    lines.append(f"- Implementation mode: {ops.get('implementation_mode', 'N/A')}")
    for ws in ops.get("workstreams", []):
        lines.append(f"- Workstream: {ws.get('name', 'N/A')} | Owner: {ws.get('owner', 'N/A')} | Timing: {ws.get('timing', 'N/A')}")
        for action in ws.get("actions", [])[:6]:
            lines.append(f"  - {action}")
    lines.append("")

    lines.append("## Raw JSON Snapshot")
    lines.append("```json")
    lines.append(json.dumps(bundle, indent=2, ensure_ascii=False)[:12000])
    lines.append("```")
    return "\n".join(lines)
