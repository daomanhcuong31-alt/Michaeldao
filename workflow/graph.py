"""
workflow/graph.py - LangGraph pipeline wiring
"""

import os
from time import perf_counter
from typing import List, Optional
from langgraph.graph import StateGraph, END
from workflow.state import DealState
from workflow.supervisor import supervisor_node, route_after_supervisor
from workflow.senior_advisor import run_senior_advisor_agent, route_after_senior_advisor
from workflow.parallel_analysis import run_parallel_analysis_agent

from agents.ingestion import run_ingestion_agent
from agents.market_intel import run_market_intel_agent
from agents.financial_modeler import run_financial_modeler_agent
from agents.compliance import run_compliance_agent
from agents.memo_architect import run_memo_architect_agent
from workflow.intent_router import normalize_intent
from prompts.audience_profiles import AUDIENCE_PROFILES


def _instrument_step(step_name, runner):
    def _wrapped(state):
        started = perf_counter()
        input_state = state if isinstance(state, DealState) else DealState(**state)
        before_errors = len(input_state.errors)
        print(f"[Step:{step_name}] START")
        out = runner(state)
        output_state = out if isinstance(out, DealState) else DealState(**out)
        new_errors = output_state.errors[before_errors:]
        fallback_used = any(
            e.get("agent") == step_name and "fallback" in str(e.get("error", "")).lower()
            for e in new_errors
        )
        print(
            f"[Step:{step_name}] END "
            f"duration={perf_counter() - started:.2f}s "
            f"fallback_used={fallback_used}"
        )
        return out
    return _wrapped


def build_graph():
    graph = StateGraph(DealState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("ingestion", _instrument_step("ingestion", run_ingestion_agent))
    graph.add_node("market_intel", _instrument_step("market_intel", run_market_intel_agent))

    graph.add_node("financial_modeler", _instrument_step("financial_modeler", run_financial_modeler_agent))  # kept for compatibility
    graph.add_node("compliance", _instrument_step("compliance", run_compliance_agent))                # kept for compatibility
    graph.add_node("analysis_parallel", _instrument_step("analysis_parallel", run_parallel_analysis_agent))

    graph.add_node("memo_architect", _instrument_step("memo_architect", run_memo_architect_agent))
    graph.add_node("senior_advisor", _instrument_step("senior_advisor", run_senior_advisor_agent))

    graph.set_entry_point("supervisor")

    graph.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {
            "ingestion": "ingestion",
            "market_intel": "market_intel",
            "analysis_parallel": "analysis_parallel",
            "financial_modeler": "financial_modeler",
            "compliance": "compliance",
            "memo_architect": "memo_architect",
            "END": END,
        },
    )

    for agent_name in ["ingestion", "market_intel", "analysis_parallel", "financial_modeler", "compliance"]:
        graph.add_edge(agent_name, "supervisor")

    graph.add_edge("memo_architect", "senior_advisor")

    graph.add_conditional_edges(
        "senior_advisor",
        route_after_senior_advisor,
        {
            "memo_architect": "memo_architect",
            "END": END,
        },
    )

    return graph.compile()


def run_pipeline(
    input_text: str,
    file_path: str = None,
    audience: str = "credit_committee",
    max_revisions: int = 1,
    intent: str = "memo_only",
    route_mode: str = "auto",
    target_workers: Optional[List[str]] = None,
    manager_instruction: str = "",
    desired_output: str = "credit_memo",
    report_format: str = "credit_memo",
    sop_format: str = "",
    output_template_id: str = "autonomous",
    structured_output_instruction: str = "",
    report_length_words: int = 0,
    credit_decision_mode: str = "analysis_only",
) -> DealState:
    pipeline = build_graph()
    recursion_limit = max(10, int(os.getenv("PIPELINE_RECURSION_LIMIT", "40")))
    audience_key = (audience or "credit_committee").strip().lower().replace(" ", "_")
    if audience_key not in AUDIENCE_PROFILES:
        audience_key = "credit_committee"

    normalized_intent = normalize_intent(intent)
    normalized_output = (desired_output or report_format or output_template_id or normalized_intent or "credit_memo")
    normalized_output = str(normalized_output).strip().lower().replace("-", "_").replace(" ", "_") or "credit_memo"
    initial_state = {
        "input_text": input_text,
        "input_file_path": file_path,
        "audience": audience_key,
        "intent": normalized_intent,
        "route_mode": str(route_mode or "auto").strip().lower(),
        "target_workers": target_workers or [],
        "manager_instruction": manager_instruction or "",
        "desired_output": normalized_output,
        "report_format": str(report_format or normalized_output).strip() or normalized_output,
        "sop_format": str(sop_format or "").strip(),
        "output_template_id": str(output_template_id or "autonomous").strip() or "autonomous",
        "structured_output_instruction": str(structured_output_instruction or "").strip(),
        "report_length_words": int(report_length_words or 0),
        "credit_decision_mode": str(credit_decision_mode or "analysis_only").strip() or "analysis_only",
        "max_revisions": 0 if normalized_output != "credit_memo" else max_revisions,
        "output_metadata": {
            "audience": audience_key,
            "audience_profile_selected": True,
            "intent": normalized_intent,
            "route_mode": str(route_mode or "auto").strip().lower(),
            "target_workers": target_workers or [],
            "manager_instruction": manager_instruction or "",
            "desired_output": normalized_output,
            "report_format": str(report_format or normalized_output).strip() or normalized_output,
            "sop_format": str(sop_format or "").strip(),
            "output_template_id": str(output_template_id or "autonomous").strip() or "autonomous",
            "structured_output_instruction": str(structured_output_instruction or "").strip(),
            "report_length_words": int(report_length_words or 0),
            "credit_decision_mode": str(credit_decision_mode or "analysis_only").strip() or "analysis_only",
        },
        "messages": [],
        "completed_steps": [],
        "errors": [],
    }

    print("[Pipeline] Starting SF Agentic AI pipeline...")
    final_state = pipeline.invoke(initial_state, config={"recursion_limit": recursion_limit})
    print("[Pipeline] Complete.")
    return DealState(**final_state)
