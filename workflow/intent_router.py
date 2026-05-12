"""
workflow/intent_router.py - Channel-agnostic intent and post-credit routing.
"""

from dataclasses import dataclass

VALID_INTENTS = {
    "memo_only",
    "memo_plus_distribution",
    "memo_plus_holdbook",
    "full_e2e",
    "custom",
    "analysis_brief",
    "ops_sop",
    "meeting_minutes",
    "pipeline_report",
    "market_intel",
    "data_analysis",
}


@dataclass(frozen=True)
class IntentRoute:
    intent: str
    post_credit_mode: str
    run_distribution: bool
    run_holdbook: bool


def normalize_intent(intent: str) -> str:
    key = (intent or "").strip().lower().replace("-", "_").replace(" ", "_")
    if key not in VALID_INTENTS:
        return "memo_only"
    return key


def route_intent(intent: str, explicit_post_credit: str = "") -> IntentRoute:
    normalized = normalize_intent(intent)
    override = (explicit_post_credit or "").strip().lower()

    mode_map = {
        "memo_only": "stop",
        "memo_plus_distribution": "distribution",
        "memo_plus_holdbook": "holdbook",
        "full_e2e": "hybrid",
        "custom": "stop",
        "analysis_brief": "stop",
        "ops_sop": "stop",
        "meeting_minutes": "stop",
        "pipeline_report": "stop",
        "market_intel": "stop",
        "data_analysis": "stop",
    }
    mode = mode_map[normalized]
    if override in {"ask", "stop", "holdbook", "distribution", "hybrid"}:
        mode = override

    return IntentRoute(
        intent=normalized,
        post_credit_mode=mode.upper(),
        run_distribution=mode in {"distribution", "hybrid"},
        run_holdbook=mode in {"holdbook", "hybrid"},
    )



def get_output_family(intent_or_state) -> str:
    intent = intent_or_state
    # Backward compatibility: callers may pass full state object.
    if not isinstance(intent_or_state, str):
        intent = getattr(intent_or_state, "intent", None) or getattr(intent_or_state, "requested_intent", None) or "memo_only"

    normalized = normalize_intent(intent)
    family_map = {
        "memo_only": "credit_memo",
        "memo_plus_distribution": "credit_memo",
        "memo_plus_holdbook": "credit_memo",
        "full_e2e": "credit_memo",
        "custom": "credit_memo",
        "analysis_brief": "analysis_brief",
        "ops_sop": "ops_sop",
        "meeting_minutes": "meeting_minutes",
        "pipeline_report": "pipeline_report",
        "market_intel": "market_intel",
        "data_analysis": "data_analysis",
    }
    return family_map.get(normalized, "credit_memo")
