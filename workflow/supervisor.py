"""
workflow/supervisor.py - Manager router

Routing:
supervisor -> ingestion -> market_intel -> analysis_parallel
          -> memo_architect -> END
"""

from typing import Literal, Optional
from workflow.state import DealState

NextAgent = Literal[
    "ingestion",
    "market_intel",
    "analysis_parallel",
    "financial_modeler",
    "compliance",
    "memo_architect",
    "END",
]


FULL_SEQUENCE = ["ingestion", "market_intel", "analysis_parallel", "memo_architect"]
WRITER_SEQUENCE = ["ingestion", "memo_architect"]
ANALYSIS_SEQUENCE = ["ingestion", "analysis_parallel", "memo_architect"]
MARKET_BRIEF_SEQUENCE = ["ingestion", "market_intel", "memo_architect"]


def _normalize_workers(workers) -> list[str]:
    allowed = {
        "ingestion",
        "market_intel",
        "analysis_parallel",
        "financial_modeler",
        "compliance",
        "memo_architect",
        "senior_advisor",
        "admin_ops",
        "data_analyst",
    }
    out = []
    for w in (workers or []):
        key = str(w).strip().lower().replace("-", "_").replace(" ", "_")
        if key in allowed and key not in out:
            out.append(key)
    return out


def _expand_with_dependencies(workers: list[str]) -> list[str]:
    deps = {
        "market_intel": ["ingestion"],
        "analysis_parallel": ["ingestion"],
        "financial_modeler": ["ingestion"],
        "compliance": ["ingestion"],
        "memo_architect": ["ingestion"],
        "senior_advisor": ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
        "admin_ops": ["ingestion", "memo_architect"],
        "data_analyst": ["ingestion", "analysis_parallel", "memo_architect"],
    }
    out = list(workers)
    changed = True
    while changed:
        changed = False
        for w in list(out):
            for d in deps.get(w, []):
                if d not in out:
                    out.append(d)
                    changed = True
    # Keep deterministic execution order aligned with graph flow.
    order = ["ingestion", "market_intel", "analysis_parallel", "financial_modeler", "compliance", "memo_architect", "senior_advisor"]
    return [w for w in order if w in out]


def _output_family(state: DealState) -> str:
    raw = (
        getattr(state, "desired_output", "")
        or getattr(state, "report_format", "")
        or getattr(state, "output_template_id", "")
        or getattr(state, "intent", "")
        or "credit_memo"
    )
    key = str(raw).strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "credit_memo_v2": "credit_memo",
        "credit_committee_memo": "credit_memo",
        "memo_only": "credit_memo",
        "memo_plus_distribution": "credit_memo",
        "memo_plus_holdbook": "credit_memo",
        "full_e2e": "credit_memo",
        "sop": "ops_sop",
        "standard_sop": "ops_sop",
        "ops_sop_v2": "ops_sop",
        "analysis": "analysis_brief",
        "analysis_brief_v1": "analysis_brief",
        "meeting_minutes_v1": "meeting_minutes",
        "pipeline_report_v1": "pipeline_report",
        "market_intel_brief": "market_intel",
        "data_report": "data_analysis",
    }
    return aliases.get(key, key or "credit_memo")


def _plan_for_output_family(family: str) -> Optional[tuple[str, list[str], str]]:
    if family in {"ops_sop", "meeting_minutes"}:
        return "targeted", WRITER_SEQUENCE, f"output-family-{family}"
    if family in {"pipeline_report", "data_analysis", "analysis_brief"}:
        return "targeted", ANALYSIS_SEQUENCE, f"output-family-{family}"
    if family in {"market_intel"}:
        return "targeted", MARKET_BRIEF_SEQUENCE, "output-family-market-intel"
    return None


def _infer_from_instruction(instruction: str, fallback_intent: str) -> tuple[str, list[str], str]:
    text = (instruction or "").strip().lower()
    if not text:
        return "full", FULL_SEQUENCE, "auto-default-full"

    if any(k in text for k in ["full sequence", "full run", "end to end", "whole flow", "complete flow", "complete memo"]):
        return "full", FULL_SEQUENCE, "instruction-full"

    if any(k in text for k in ["meeting minutes", "minutes", "action items", "attendees"]):
        return "targeted", WRITER_SEQUENCE, "instruction-meeting-minutes"
    if any(k in text for k in ["sop", "standard operating procedure", "procedure", "process note", "workflow note"]):
        return "targeted", WRITER_SEQUENCE, "instruction-sop"
    if any(k in text for k in ["pipeline report", "pipeline tracker", "excel report", "data analysis", "spreadsheet"]):
        return "targeted", ANALYSIS_SEQUENCE, "instruction-data-report"
    if any(k in text for k in ["market intel", "market intelligence", "market view", "market update"]):
        if any(k in text for k in ["market intel only", "market intelligence only", "only market intel", "just market intel", "focus on market intel"]):
            return "targeted", _expand_with_dependencies(["market_intel"]), "instruction-market-intel-only"
        return "targeted", MARKET_BRIEF_SEQUENCE, "instruction-market-intel"
    if any(k in text for k in ["compliance", "regulation", "legal screen", "legal check"]):
        return "targeted", _expand_with_dependencies(["compliance"]), "instruction-compliance"
    if any(k in text for k in ["financial model", "modeling", "ratio", "dscr", "cashflow model"]):
        return "targeted", _expand_with_dependencies(["financial_modeler"]), "instruction-financial-model"
    if any(k in text for k in ["memo", "credit memo", "cc memo", "prepare memo"]):
        return "full", FULL_SEQUENCE, "instruction-memo"

    if fallback_intent in {"memo_plus_distribution", "memo_plus_holdbook", "full_e2e", "custom"}:
        return "full", FULL_SEQUENCE, "intent-full"
    return "full", FULL_SEQUENCE, "auto-default-full"


def _infer_from_document_request(input_text: str, fallback_intent: str) -> tuple[str, list[str], str]:
    text = (input_text or "").strip().lower()
    if not text:
        return "full", FULL_SEQUENCE, "doc-empty-default-full"

    # Only honor strict "only/just/focus" directives from document text.
    strict_market = [
        "market intel only",
        "market intelligence only",
        "only market intel",
        "focus on market intel",
        "just market intel",
    ]
    strict_compliance = [
        "compliance only",
        "legal check only",
        "regulatory check only",
        "only compliance",
    ]
    strict_financial = [
        "financial model only",
        "only financial model",
        "modeling only",
        "ratio analysis only",
    ]
    strict_full = [
        "run full sequence",
        "run whole sequence",
        "full workflow",
        "end to end",
        "complete memo",
    ]
    strict_minutes = [
        "meeting minutes",
        "prepare minutes",
        "minutes only",
        "action item tracker",
    ]
    strict_sop = [
        "sop",
        "standard operating procedure",
        "procedure only",
        "process documentation",
    ]
    strict_data = [
        "pipeline report",
        "pipeline tracker",
        "data analysis",
        "spreadsheet report",
    ]

    if any(k in text for k in strict_minutes):
        return "targeted", WRITER_SEQUENCE, "doc-directive-meeting-minutes"
    if any(k in text for k in strict_sop):
        return "targeted", WRITER_SEQUENCE, "doc-directive-sop"
    if any(k in text for k in strict_data):
        return "targeted", ANALYSIS_SEQUENCE, "doc-directive-data-report"
    if any(k in text for k in strict_market):
        return "targeted", MARKET_BRIEF_SEQUENCE, "doc-directive-market-intel"
    if any(k in text for k in strict_compliance):
        return "targeted", _expand_with_dependencies(["compliance"]), "doc-directive-compliance"
    if any(k in text for k in strict_financial):
        return "targeted", _expand_with_dependencies(["financial_modeler"]), "doc-directive-financial-model"
    if any(k in text for k in strict_full):
        return "full", FULL_SEQUENCE, "doc-directive-full"

    if fallback_intent in {"memo_plus_distribution", "memo_plus_holdbook", "full_e2e", "custom"}:
        return "full", FULL_SEQUENCE, "intent-full"
    return "full", FULL_SEQUENCE, "doc-default-full"


def _resolve_plan(state: DealState) -> tuple[str, list[str], str]:
    configured_mode = str(getattr(state, "route_mode", "auto") or "auto").strip().lower()
    instruction = str(getattr(state, "manager_instruction", "") or "")
    targets = _normalize_workers(getattr(state, "target_workers", []))
    family = _output_family(state)
    family_plan = _plan_for_output_family(family)

    if family_plan and configured_mode in {"auto", "full"}:
        return family_plan
    if configured_mode == "full":
        return "full", FULL_SEQUENCE, "configured-full"
    if configured_mode == "targeted":
        if not targets:
            if family_plan:
                return family_plan
            return "full", FULL_SEQUENCE, "targeted-empty-fallback-full"
        return "targeted", _expand_with_dependencies(targets), "configured-targeted"
    if instruction:
        return _infer_from_instruction(instruction=instruction, fallback_intent=state.intent)
    return _infer_from_document_request(input_text=state.input_text, fallback_intent=state.intent)


def supervisor_node(state: DealState) -> dict:
    completed = set(state.completed_steps)
    mode, planned_workers, reason = _resolve_plan(state)
    active_plan = [w for w in planned_workers if w != "senior_advisor"]
    metadata = dict(state.output_metadata or {})
    metadata["manager_plan"] = {
        "mode": mode,
        "workers": active_plan,
        "reason": reason,
    }
    state.output_metadata = metadata
    state.manager_plan = metadata["manager_plan"]

    if "ingestion" in active_plan and "ingestion" not in completed:
        next_agent = "ingestion"
    elif "market_intel" in active_plan and "market_intel" not in completed:
        next_agent = "market_intel"
    elif "analysis_parallel" in active_plan and not {"financial_modeler", "compliance"}.issubset(completed):
        next_agent = "analysis_parallel"
    elif "financial_modeler" in active_plan and "financial_modeler" not in completed:
        next_agent = "financial_modeler"
    elif "compliance" in active_plan and "compliance" not in completed:
        next_agent = "compliance"
    elif "memo_architect" in active_plan and "memo_architect" not in completed:
        next_agent = "memo_architect"
    else:
        next_agent = "END"

    print(f"[Supervisor] plan={mode}:{','.join(active_plan)} reason={reason} -> {next_agent}")
    return {"current_agent": next_agent}


def route_after_supervisor(state: DealState) -> NextAgent:
    return state.current_agent  # type: ignore
