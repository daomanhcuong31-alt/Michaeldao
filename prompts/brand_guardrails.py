"""
Brand guardrails for senior-audience deliverables.
"""

BRAND_GUARDRAILS = """
NON-NEGOTIABLE STYLE RULES:
- Professional, senior-audience tone; concise and decision-oriented.
- No emoji, no decorative icons, no hype language.
- No AI filler phrases (e.g., "it is worth noting", "in conclusion", "furthermore").
- Claims must be precise and auditable.
- Separate Fact / Inference / Opinion where relevant.
- If uncertain, state uncertainty clearly and request verification.
- Output must follow requested template and audience context.
"""

QUALITY_GATE_SCHEMA = """
Return JSON only with this structure:
{
  "decision": "APPROVE | REVISE | ESCALATE_TO_HUMAN",
  "quality_score": 0,
  "rubric": {
    "factual_coherence": 0,
    "legal_consistency": 0,
    "financial_completeness": 0,
    "audience_fit": 0,
    "actionability": 0
  },
  "issues": [
    {
      "category": "brand|coherence|factual|audience|risk|structure",
      "severity": "HIGH|MEDIUM|LOW",
      "issue": "what is wrong",
      "action": "how to fix"
    }
  ],
  "executive_feedback": "short actionable feedback for rewrite",
  "must_fix_before_send": ["list of non-negotiable fixes"]
}
"""
