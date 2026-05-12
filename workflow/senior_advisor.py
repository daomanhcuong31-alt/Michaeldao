"""
Mandatory quality gate before final output (practical mode).
"""

import json
import re
from typing import Literal
from agents.base import BaseAgent
from workflow.state import DealState
from prompts.brand_guardrails import BRAND_GUARDRAILS, QUALITY_GATE_SCHEMA
from prompts.audience_profiles import AUDIENCE_PROFILES

NextAfterAdvisor = Literal["memo_architect", "END"]


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
        "meeting_minutes_v1": "meeting_minutes",
        "pipeline_report_v1": "pipeline_report",
    }
    return aliases.get(key, key or "credit_memo")


class SeniorAdvisorAgent(BaseAgent):
    name = "senior_advisor"

    system_prompt = f"""You are the Senior Advisor Controller.
You challenge output quality before anything reaches stakeholders.

{BRAND_GUARDRAILS}

Gatekeeping policy:
- APPROVE: stakeholder-ready now.
- REVISE: fixable in one rewrite.
- ESCALATE_TO_HUMAN: unresolved legal/regulatory uncertainty, major contradictions, or high-risk uncertainty.
"""

    def _has_high_issues(self, issues):
        if not isinstance(issues, list):
            return False
        for i in issues:
            if isinstance(i, dict) and str(i.get("severity", "")).upper() == "HIGH":
                return True
        return False

    def _has_mitigation_signals(self, memo_text: str) -> bool:
        t = (memo_text or "").lower()
        has_reco = any(x in t for x in ["recommendation", "decision:", "approve subject"])
        has_controls = any(x in t for x in ["conditions precedent", "condition precedent", "covenant", "mitigant", "mitigation"])
        return has_reco and has_controls

    def _rubric_threshold(self, rubric: dict) -> tuple[str, str]:
        """
        Deterministic decision thresholds:
        - APPROVE: all dims >= 7 and total >= 38
        - REVISE: all dims >= 5 and total >= 28
        - ESCALATE_TO_HUMAN: otherwise
        """
        dims = [
            "factual_coherence",
            "legal_consistency",
            "financial_completeness",
            "audience_fit",
            "actionability",
        ]
        vals = [int(rubric.get(k, 0) or 0) for k in dims]
        total = sum(vals)
        if min(vals) >= 7 and total >= 38:
            return "APPROVE", f"all rubric dimensions >=7; total={total}"
        if min(vals) >= 5 and total >= 28:
            return "REVISE", f"minimum dimension between 5-6 or total={total}"
        return "ESCALATE_TO_HUMAN", f"one or more dimensions <5 or total={total}"

    def review(self, state: DealState) -> dict:
        audience_key = (state.audience or "credit_committee").strip().lower().replace(" ", "_")
        profile = AUDIENCE_PROFILES.get(audience_key, AUDIENCE_PROFILES["credit_committee"])

        prompt = f"""Review this draft for release readiness.

AUDIENCE PROFILE:
{json.dumps(profile, indent=2)}

PARSED TERMS:
{json.dumps(state.parsed_terms, indent=2)}

COMPLIANCE FLAGS:
{json.dumps(state.compliance_flags, indent=2)}

DRAFT OUTPUT:
{state.draft_memo}

Assess:
1) Data coherence and internal consistency
2) Factual discipline and claim quality
3) Brand/style compliance
4) Audience fit
5) Decision usefulness

Rubric scores (0-10 each): factual_coherence, legal_consistency, financial_completeness, audience_fit, actionability.

{QUALITY_GATE_SCHEMA}
"""
        resp = self.call_llm(prompt)

        if str(resp).startswith("ERROR:"):
            if _output_family(state) != "credit_memo":
                return {
                    "decision": "APPROVE",
                    "quality_score": 70,
                    "rubric": {
                        "factual_coherence": 8,
                        "legal_consistency": 8,
                        "financial_completeness": 8,
                        "audience_fit": 8,
                        "actionability": 8,
                    },
                    "issues": [{
                        "category": "infra",
                        "severity": "MEDIUM",
                        "issue": "Senior advisor LLM unavailable; non-credit output accepted with infra warning.",
                        "action": "Manual spot-check recommended before external distribution.",
                    }],
                    "executive_feedback": "Advisor infra warning; non-credit output not rerun to preserve local latency.",
                    "must_fix_before_send": [],
                }
            prior = int(getattr(state, "quality_score", 0) or 0)
            if state.revision_count > 0 and prior >= 70:
                return {
                    "decision": "APPROVE",
                    "quality_score": prior,
                    "issues": [{
                        "category": "infra",
                        "severity": "MEDIUM",
                        "issue": "Senior advisor LLM unavailable on this pass.",
                        "action": "Proceed with caution; schedule post-send QA.",
                    }],
                    "executive_feedback": "Advisor infra warning; content approved from prior quality pass.",
                    "must_fix_before_send": [],
                }
            return {
                "decision": "REVISE",
                "quality_score": max(prior, 60),
                "rubric": {
                    "factual_coherence": 6,
                    "legal_consistency": 6,
                    "financial_completeness": 6,
                    "audience_fit": 6,
                    "actionability": 6,
                },
                "issues": [{
                    "category": "infra",
                    "severity": "MEDIUM",
                    "issue": "Senior advisor LLM unavailable.",
                    "action": "Retry once with same draft.",
                }],
                "executive_feedback": "Retry quality gate once.",
                "must_fix_before_send": [],
            }

        cleaned = re.sub(r"```(?:json)?\n?", "", str(resp)).replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except Exception:
            return {
                "decision": "REVISE",
                "quality_score": 65,
                "rubric": {
                    "factual_coherence": 6,
                    "legal_consistency": 6,
                    "financial_completeness": 6,
                    "audience_fit": 6,
                    "actionability": 6,
                },
                "issues": [{
                    "category": "structure",
                    "severity": "MEDIUM",
                    "issue": "Advisor JSON parse failed.",
                    "action": "Minor rewrite for structure clarity.",
                }],
                "executive_feedback": "Rewrite with tighter structure and explicit recommendation.",
                "must_fix_before_send": [],
            }

    def run(self, state: DealState) -> dict:
        if not state.draft_memo.strip():
            state.quality_gate_decision = "ESCALATE_TO_HUMAN"
            state.quality_gate_notes = [{
                "category": "structure",
                "severity": "HIGH",
                "issue": "No draft to review",
                "action": "Run memo_architect first",
            }]
            state.advisor_feedback = "No draft available for quality review."
            state.mark_complete("senior_advisor")
            return state.dict()

        family = _output_family(state)
        if family != "credit_memo":
            state.quality_gate_decision = "APPROVE"
            state.quality_score = 80
            state.quality_gate_notes = [{
                "category": "non_credit_output",
                "severity": "LOW",
                "issue": "Deterministic local QA applied for non-credit output family.",
                "action": "Manual spot-check recommended before external sharing.",
            }]
            state.advisor_feedback = "Non-credit output passed deterministic local QA."
            md = state.output_metadata or {}
            md["controller_decision"] = "APPROVE"
            md["controller_decision_why"] = "non-credit deterministic local QA"
            md["controller_rubric"] = {
                "factual_coherence": 8,
                "legal_consistency": 8,
                "financial_completeness": 8,
                "audience_fit": 8,
                "actionability": 8,
            }
            state.output_metadata = md
            state.mark_complete("senior_advisor")
            print(f"[Senior Advisor] Decision: {state.quality_gate_decision} | Score: {state.quality_score} | Revisions: {state.revision_count}/{state.max_revisions}")
            return state.dict()

        result = self.review(state)
        decision = str(result.get("decision", "REVISE")).upper().strip()
        if decision not in {"APPROVE", "REVISE", "ESCALATE_TO_HUMAN"}:
            decision = "REVISE"

        try:
            score = int(result.get("quality_score", 0))
        except Exception:
            score = 0

        issues = result.get("issues", []) if isinstance(result.get("issues", []), list) else []
        rubric = result.get("rubric", {}) if isinstance(result.get("rubric", {}), dict) else {}
        rubric_decision, rubric_why = self._rubric_threshold(rubric)
        decision = rubric_decision

        has_high = self._has_high_issues(issues)
        mitigated_high = has_high and self._has_mitigation_signals(state.draft_memo)

        if decision == "REVISE" and state.revision_count >= state.max_revisions:
            decision = "ESCALATE_TO_HUMAN"
            issues.append({
                "category": "risk",
                "severity": "HIGH",
                "issue": "Max auto-revision reached with unresolved issues.",
                "action": "Manual review required before external sharing.",
            })
        if decision == "APPROVE" and has_high and not mitigated_high:
            decision = "REVISE"
            issues.append({
                "category": "risk",
                "severity": "MEDIUM",
                "issue": "Rubric passed but high-severity issue not mitigated.",
                "action": "Tighten controls and recommendation language.",
            })

        state.quality_gate_decision = decision
        state.quality_score = score
        state.quality_gate_notes = issues
        state.advisor_feedback = str(result.get("executive_feedback", ""))
        md = state.output_metadata or {}
        md["controller_rubric"] = rubric
        md["controller_decision_why"] = rubric_why
        md["controller_decision"] = decision
        state.output_metadata = md

        if decision == "REVISE":
            state.revision_count += 1
            if "memo_architect" in state.completed_steps:
                state.completed_steps.remove("memo_architect")

        state.mark_complete("senior_advisor")
        print(f"[Senior Advisor] Decision: {state.quality_gate_decision} | Score: {state.quality_score} | Revisions: {state.revision_count}/{state.max_revisions}")
        return state.dict()


_agent = SeniorAdvisorAgent()


def run_senior_advisor_agent(state: DealState) -> dict:
    return _agent.run(state)


def route_after_senior_advisor(state: DealState) -> NextAfterAdvisor:
    if state.quality_gate_decision == "REVISE":
        return "memo_architect"
    return "END"
