"""
Audience-specific output expectations.
"""

AUDIENCE_PROFILES = {
    "credit_committee": {
        "tone": "risk-disciplined, evidence-led, committee-ready",
        "focus": [
            "credit structure and risk allocation",
            "financial metrics and stress cases",
            "regulatory/compliance flags",
            "clear recommendation and conditions precedent"
        ],
        "length": "medium to detailed"
    },
    "ceo": {
        "tone": "strategic, commercial, decisive",
        "focus": [
            "economic value and downside risk",
            "capital impact and resource ask",
            "go/no-go decision options",
            "time-to-execution"
        ],
        "length": "short to medium"
    },
    "chief_cibg": {
        "tone": "institutional, portfolio-aware, execution-focused",
        "focus": [
            "fit with CIBG strategy and pipeline",
            "risk-return profile vs alternatives",
            "cross-team dependencies and bottlenecks",
            "decision and owner-level next steps"
        ],
        "length": "medium"
    },
    "external_client": {
        "tone": "professional, clear, relationship-safe",
        "focus": [
            "commercial terms and rationale",
            "what is confirmed vs pending",
            "required client actions",
            "timeline and next meeting checkpoints"
        ],
        "length": "short to medium"
    }
}

STRICT_STYLE_POLICY = {
    "executive_clarity": True,
    "evidence_labels_required": ["FACT", "INFERENCE", "OPINION"],
    "no_fluff": True,
    "required_tone": "professional, concise, decision-oriented",
}
