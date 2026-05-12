from workflow.state import DealState
from main import _ensure_non_empty_output


def test_partial_worker_run_generates_non_empty_report():
    state = DealState(
        intent="memo_only",
        completed_steps=["ingestion"],
        parsed_terms={
            "borrower": "Test Borrower",
            "facility_type": "Term Loan",
            "amount": "USD 1,000,000",
            "currency": "USD",
            "tenor": "1 year",
            "pricing": "SOFR + 1.00%",
            "security": "Unsecured",
            "covenants": ["DSCR minimum 1.20x"],
            "missing_or_unclear": ["purpose"],
        },
    )

    out = _ensure_non_empty_output(state)

    assert "PARTIAL STRUCTURED FINANCE WORKER OUTPUT" in out.draft_memo
    assert "Test Borrower" in out.draft_memo
    assert out.output_metadata["fallback_output_generated"] is True


def test_partial_meeting_minutes_output_is_not_credit_memo():
    state = DealState(
        intent="meeting_minutes",
        desired_output="meeting_minutes",
        report_format="meeting_minutes",
        completed_steps=["ingestion"],
        input_text="Discussed portfolio review. Dao to update tracker by Friday.",
    )

    out = _ensure_non_empty_output(state)

    assert "PARTIAL MEETING MINUTES" in out.draft_memo
    assert "credit committee memo" not in out.draft_memo.lower()
