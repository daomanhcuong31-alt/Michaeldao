import json
from agents.base import BaseAgent
from workflow.state import DealState
from prompts.tcb_tone import TCB_TONE_GUIDE, CC_MEMO_TEMPLATE
from prompts.brand_guardrails import BRAND_GUARDRAILS
from prompts.audience_profiles import AUDIENCE_PROFILES

OUTPUT_SPECS = {
    "credit_memo": {
        "label": "credit memo",
        "title": "CREDIT COMMITTEE MEMORANDUM",
        "sections": "Executive Summary, Borrower Profile, Deal Structure, Financial Analysis, Risk & Mitigants, Covenants, Recommendation",
        "purpose": "support a credit analysis or decision recommendation",
    },
    "analysis_brief": {
        "label": "analysis brief",
        "title": "ANALYSIS BRIEF",
        "sections": "Executive Summary, Key Findings, Evidence, Analysis, Risks, Open Items",
        "purpose": "summarize business analysis without forcing a credit decision",
    },
    "ops_sop": {
        "label": "operations SOP",
        "title": "STANDARD OPERATING PROCEDURE",
        "sections": "Purpose, Scope, Roles, Inputs, Procedure Steps, Controls, Exceptions, Escalation, Records",
        "purpose": "document a repeatable operating process",
    },
    "meeting_minutes": {
        "label": "meeting minutes",
        "title": "MEETING MINUTES",
        "sections": "Meeting Metadata, Attendees, Agenda, Discussion Summary, Decisions, Action Items, Open Questions",
        "purpose": "record discussion, decisions, owners, and follow-up actions",
    },
    "pipeline_report": {
        "label": "pipeline report",
        "title": "PIPELINE REPORT",
        "sections": "KPI Snapshot, Pipeline by Stage, Deal Movement, Risk Flags, Deal Table, Next Actions",
        "purpose": "summarize pipeline status and management actions",
    },
    "data_analysis": {
        "label": "data analysis report",
        "title": "DATA ANALYSIS REPORT",
        "sections": "Data Summary, Data Quality, Key Metrics, Trends, Exceptions, Recommendations",
        "purpose": "explain data patterns and practical implications",
    },
    "market_intel": {
        "label": "market intelligence brief",
        "title": "MARKET INTELLIGENCE BRIEF",
        "sections": "Scope, Market Summary, Comparable Signals, Risks, Implications, Verification Notes",
        "purpose": "summarize market context and what still needs verification",
    },
}


def _normalize_output_family(state: DealState) -> str:
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
        "autonomous": "analysis_brief",
        "not_applicable": "analysis_brief",
    }
    return aliases.get(key, key if key in OUTPUT_SPECS else "analysis_brief")


class MemoArchitectAgent(BaseAgent):
    name = "memo_architect"
    system_prompt = f"""You are the Output Architect for Structured Finance and business operations.
{TCB_TONE_GUIDE}
{BRAND_GUARDRAILS}
Always produce stakeholder-ready output. If data is missing, state it explicitly.
"""

    def _fallback_memo(self, state: DealState) -> str:
        family = _normalize_output_family(state)
        spec = OUTPUT_SPECS.get(family, OUTPUT_SPECS["analysis_brief"])
        p = state.parsed_terms or {}
        fm = (state.financial_model or {}).get("calculated_metrics", {})
        if family == "credit_memo":
            recommendation = (
                "Provide analysis only; no approval recommendation requested."
                if state.credit_decision_mode != "decision_recommendation"
                else "Approve subject to final legal/compliance confirmation and completion of required conditions."
            )
            return f"""{spec['title']}

1. EXECUTIVE SUMMARY
Borrower: {p.get('borrower','NOT PROVIDED')}. Facility: {p.get('facility_type','NOT PROVIDED')} {p.get('amount','?')} {p.get('currency','')}. Position: {recommendation}

2. TRANSACTION STRUCTURE
Tenor: {p.get('tenor','NOT PROVIDED')}. Pricing: {p.get('pricing','NOT PROVIDED')}. Purpose: {p.get('purpose','NOT PROVIDED')}. Security: {p.get('security','NOT PROVIDED')}.

3. FINANCIAL ANALYSIS
Model outputs available: {json.dumps(fm)[:1200]}

4. MARKET CONTEXT
{json.dumps(state.market_context)[:1500]}

5. COMPLIANCE
Flags: {len(state.compliance_flags)}. Regulatory summary: {state.regulatory_summary[:1200]}

6. CONCLUSION
{recommendation}
"""
        if family == "ops_sop":
            return f"""{spec['title']}

1. PURPOSE
Document the requested process using the available uploaded or pasted input.

2. SCOPE
Applies to the workflow described in the input. Missing scope boundaries should be confirmed by the operator.

3. ROLES AND RESPONSIBILITIES
- Process owner: NOT PROVIDED
- Performer: NOT PROVIDED
- Reviewer/approver: NOT PROVIDED

4. PROCEDURE STEPS
- Intake the request and source materials.
- Validate required data and approvals.
- Execute the process steps described in the input.
- Record exceptions and escalation items.

5. CONTROLS AND ESCALATION
- Check completeness before execution.
- Escalate missing approvals, unclear ownership, or policy exceptions.
"""
        if family == "meeting_minutes":
            return f"""{spec['title']}

1. MEETING METADATA
- Date/time: NOT PROVIDED
- Meeting purpose: Derived from user input where available
- Chair: NOT PROVIDED

2. DISCUSSION SUMMARY
{(state.raw_text or state.input_text or 'No meeting transcript was provided.')[:1800]}

3. DECISIONS
- No formal decision extracted unless explicitly stated in the source.

4. ACTION ITEMS
- Owner: NOT PROVIDED | Action: Confirm decisions and next steps | Due: NOT PROVIDED | Status: Open

5. OPEN QUESTIONS
- Confirm attendee list, decision owners, and due dates.
"""
        if family == "pipeline_report":
            return f"""{spec['title']}

1. KPI SNAPSHOT
- Total pipeline: NOT PROVIDED
- New deals: NOT PROVIDED
- Closed / dropped: NOT PROVIDED
- Watchlist items: NOT PROVIDED

2. PIPELINE BY STAGE
No structured pipeline table was extracted. Upload an Excel/CSV pipeline file for table-level reporting.

3. RISK FLAGS
- Missing or incomplete stage, amount, owner, or next-action data should be resolved before management reporting.

4. NEXT ACTIONS
- Validate data quality.
- Confirm stage definitions.
- Update deal owner actions and target dates.
"""
        return f"""{spec['title']}

1. SUMMARY
This {spec['label']} was generated from the available input. Purpose: {spec['purpose']}.

2. KEY FINDINGS
{json.dumps(state.parsed_terms or {}, indent=2)[:1600]}

3. SUPPORTING CONTEXT
{json.dumps(state.market_context)[:1500]}

4. OPEN ITEMS
- Confirm missing facts and source data before external distribution.
"""

    def write_memo(self, state: DealState) -> str:
        family = _normalize_output_family(state)
        spec = OUTPUT_SPECS.get(family, OUTPUT_SPECS["analysis_brief"])
        audience_key = (state.audience or "credit_committee").strip().lower().replace(" ", "_")
        profile = AUDIENCE_PROFILES.get(audience_key, AUDIENCE_PROFILES["credit_committee"])
        revision_brief = state.advisor_feedback.strip()
        style_policy = {
            "executive_clarity": "short paragraphs, clear headings, direct recommendation",
            "evidence_labels": "label material claims as [FACT], [INFERENCE], or [OPINION]",
            "no_fluff": "ban filler language and generic transitions",
        }

        credit_rules = ""
        if family == "credit_memo":
            credit_rules = f"""
CREDIT OBJECTIVE:
{state.credit_decision_mode}
Use credit decision language only when the objective is decision_recommendation.
"""

        long_prompt = f"""Write a complete stakeholder-ready {spec['label']}.

OUTPUT FAMILY:
{family}
OUTPUT PURPOSE:
{spec['purpose']}
REQUIRED SECTION GUIDE:
{spec['sections']}
REPORT FORMAT:
{state.report_format}
SOP FORMAT:
{state.sop_format}
OUTPUT TEMPLATE:
{state.output_template_id}
REPORT LENGTH TARGET:
{state.report_length_words or 'not specified'} words
STRUCTURED OUTPUT INSTRUCTION:
{state.structured_output_instruction or '[No additional structure supplied]'}
{credit_rules}

AUDIENCE PROFILE:
{json.dumps(profile, indent=2)}
AUDIENCE TEMPLATE KEY: {audience_key}
STRICT STYLE POLICY:
{json.dumps(style_policy, indent=2)}

FULL DEAL TERMS:
{json.dumps(state.parsed_terms, indent=2)}

FINANCIAL ANALYSIS:
{json.dumps(state.financial_model.get('calculated_metrics', {}), indent=2)}
Financial Narrative:
{state.financial_model.get('narrative', 'NOT AVAILABLE')}

MARKET CONTEXT:
{json.dumps(state.market_context, indent=2)}

COMPLIANCE FLAGS:
{json.dumps(state.compliance_flags, indent=2)}

REGULATORY SUMMARY:
{state.regulatory_summary}

Advisor rewrite guidance:
{revision_brief if revision_brief else "[No revision feedback]"}

Credit memo template reference, only if OUTPUT FAMILY is credit_memo:
{CC_MEMO_TEMPLATE if family == 'credit_memo' else '[Not applicable]'}

Rules: No emoji/icons. No AI filler. Precise, professional, concise.
Rules: Enforce executive clarity. Use evidence labels on material claims: [FACT]/[INFERENCE]/[OPINION].
Rules: Do not write a credit committee memo unless OUTPUT FAMILY is credit_memo.
"""

        memo = self.call_llm(long_prompt)
        if memo and not memo.startswith("ERROR:") and len(memo.split()) >= 120:
            return memo
        if family != "credit_memo" and str(memo).startswith("ERROR:"):
            return self._fallback_memo(state)

        short_prompt = f"""Write a concise professional {spec['label']} with headings only.
Title: {spec['title']}
Required sections: {spec['sections']}
Borrower: {(state.parsed_terms or {}).get('borrower','NOT PROVIDED')}
Facility: {(state.parsed_terms or {}).get('facility_type','NOT PROVIDED')}
Amount: {(state.parsed_terms or {}).get('amount','?')} {(state.parsed_terms or {}).get('currency','')}
Tenor: {(state.parsed_terms or {}).get('tenor','NOT PROVIDED')}
Pricing: {(state.parsed_terms or {}).get('pricing','NOT PROVIDED')}
Security: {(state.parsed_terms or {}).get('security','NOT PROVIDED')}
Do not include credit approval language unless the output family is credit_memo.
"""
        memo2 = self.call_llm(short_prompt)
        if memo2 and not memo2.startswith("ERROR:") and len(memo2.split()) >= 80:
            return memo2

        return self._fallback_memo(state)

    def run(self, state: DealState) -> dict:
        family = _normalize_output_family(state)
        spec = OUTPUT_SPECS.get(family, OUTPUT_SPECS["analysis_brief"])
        print(f"[Memo Architect] Writing {spec['label']}...")
        memo = self.write_memo(state)
        state.draft_memo = memo
        md = state.output_metadata or {}
        md.update(
            {
                "audience": state.audience,
                "audience_profile_selected": True,
                "audience_template_key": state.audience,
                "style_policy": "executive_clarity_evidence_labels_no_fluff",
                "output_family": family,
                "output_label": spec["label"],
                "output_title": spec["title"],
            }
        )
        state.output_metadata = md
        state.mark_complete("memo_architect")
        print(f"[Memo Architect] Output written ({len(memo.split())} words)")
        return state.dict()

_agent = MemoArchitectAgent()
def run_memo_architect_agent(state: DealState) -> dict:
    return _agent.run(state)
