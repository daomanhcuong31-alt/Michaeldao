from workflow.intent_router import normalize_intent, route_intent


def test_normalize_intent_unknown_defaults_to_memo_only():
    assert normalize_intent("weird-intent") == "memo_only"


def test_non_credit_intents_are_preserved():
    assert normalize_intent("meeting minutes") == "meeting_minutes"
    assert normalize_intent("ops-sop") == "ops_sop"
    assert normalize_intent("pipeline_report") == "pipeline_report"
    assert route_intent("meeting_minutes").post_credit_mode == "STOP"


def test_route_intent_default_and_override():
    r1 = route_intent("full_e2e")
    assert r1.post_credit_mode == "HYBRID"
    assert r1.run_distribution is True
    assert r1.run_holdbook is True

    r2 = route_intent("memo_plus_distribution", explicit_post_credit="stop")
    assert r2.post_credit_mode == "STOP"
    assert r2.run_distribution is False
    assert r2.run_holdbook is False
