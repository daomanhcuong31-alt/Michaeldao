from workflow.state import DealState
from workflow.supervisor import supervisor_node


def _next(state: DealState) -> str:
    out = supervisor_node(state)
    return out["current_agent"]


def test_default_auto_routes_full_sequence_from_start():
    state = DealState(input_text="x")
    assert _next(state) == "ingestion"


def test_targeted_compliance_runs_ingestion_then_compliance_only():
    state = DealState(input_text="x", route_mode="targeted", target_workers=["compliance"])
    assert _next(state) == "ingestion"

    state.completed_steps = ["ingestion"]
    assert _next(state) == "compliance"

    state.completed_steps = ["ingestion", "compliance"]
    assert _next(state) == "END"


def test_auto_instruction_market_intel_skips_analysis_and_memo():
    state = DealState(input_text="x", manager_instruction="please run market intel only")
    assert _next(state) == "ingestion"

    state.completed_steps = ["ingestion"]
    assert _next(state) == "market_intel"

    state.completed_steps = ["ingestion", "market_intel"]
    assert _next(state) == "END"


def test_auto_document_directive_routes_targeted_when_no_manager_note():
    state = DealState(input_text="Please do compliance only for this package.")
    assert _next(state) == "ingestion"

    state.completed_steps = ["ingestion"]
    assert _next(state) == "compliance"


def test_meeting_minutes_output_routes_to_writer_not_credit_pipeline():
    state = DealState(input_text="Meeting notes and action items", desired_output="meeting_minutes", report_format="meeting_minutes")
    assert _next(state) == "ingestion"

    state.completed_steps = ["ingestion"]
    assert _next(state) == "memo_architect"

    state.completed_steps = ["ingestion", "memo_architect"]
    assert _next(state) == "END"


def test_data_analyst_target_does_not_fallback_to_full_credit_pipeline():
    state = DealState(input_text="Pipeline spreadsheet analysis", route_mode="targeted", target_workers=["data_analyst"])
    assert _next(state) == "ingestion"

    state.completed_steps = ["ingestion"]
    assert _next(state) == "analysis_parallel"
