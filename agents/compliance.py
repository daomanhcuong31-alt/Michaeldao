"""
agents/compliance.py — Compliance & Risk Agent

Role: Screens the deal against Vietnamese law, SBV regulations, and TCB policy.

Input:  state.parsed_terms + state.financial_model
Output: state.compliance_flags  (list of issues with severity)
        state.regulatory_summary  (narrative)

Key regulatory areas covered:
- SBV credit limits (Circular 22/2019 and amendments)
- Single borrower / group exposure limits
- Collateral requirements (Circular 39/2016)
- Related party lending restrictions
- Foreign currency lending rules (Circular 24/2015)
- IFRS vs VAS flagging (material for credit assessment)
- ESG considerations (IFC Performance Standards where applicable)

IMPORTANT CAVEAT (applied in system prompt):
  Regulatory references must be verified before use in final documents.
  This agent flags issues for human review — it does NOT provide legal advice.
"""

import json
import re
import os
from agents.base import BaseAgent
from workflow.state import DealState


class ComplianceAgent(BaseAgent):

    name = "compliance"

    system_prompt = """You are a compliance and regulatory risk analyst at Techcombank CIBG, Vietnam.

You screen structured finance deals against Vietnamese banking law and SBV regulations.

CRITICAL RULES:
1. Any regulatory reference (Circular number, Decree, Law) must be stated with full title
   and date — do not abbreviate or make up references
2. If you are not certain a regulation applies or its current status, say so explicitly
3. Mark findings as VERIFIED (you are confident), PROBABLE (likely applies), or
   NEEDS VERIFICATION (requires legal/compliance team to confirm)
4. Do not provide legal advice — flag for human expert review
5. Vietnamese law and SBV framework do not always map 1:1 to international standards
   — flag where analogies are being drawn rather than citing direct rules
6. IFRS vs VAS divergence is material: covenant calculations, capital ratios, and
   reported financials can differ significantly between standards

Your output feeds a credit committee memo. Precision and appropriate caution
are more valuable than completeness.
"""

    def screen_compliance(self, parsed_terms: dict, financial_model: dict) -> dict:
        """Run the compliance screening."""
        fast_mode = str(os.getenv("SF_FAST_MODE", "false")).strip().lower() in {"1", "true", "yes", "on"}
        max_flags = 3 if fast_mode else 5
        terms_compact = {
            "borrower": parsed_terms.get("borrower", "[NOT PROVIDED]"),
            "borrower_type": parsed_terms.get("borrower_type", "[NOT PROVIDED]"),
            "facility_type": parsed_terms.get("facility_type", "[NOT PROVIDED]"),
            "amount": parsed_terms.get("amount", "[NOT PROVIDED]"),
            "currency": parsed_terms.get("currency", "[NOT PROVIDED]"),
            "tenor": parsed_terms.get("tenor", "[NOT PROVIDED]"),
            "pricing": parsed_terms.get("pricing", "[NOT PROVIDED]"),
            "security": parsed_terms.get("security", "[NOT PROVIDED]"),
            "governing_law": parsed_terms.get("governing_law", "[NOT PROVIDED]"),
            "accounting_standard": parsed_terms.get("accounting_standard", "[NOT PROVIDED]"),
            "covenants": parsed_terms.get("covenants", [])[:4],
        }
        fin_compact = financial_model.get("parameters", {}) if isinstance(financial_model, dict) else {}

        prompt = f"""Screen this deal for regulatory compliance and risk flags.

DEAL TERMS:
{json.dumps(terms_compact, ensure_ascii=False)}

FINANCIAL SUMMARY:
{json.dumps(fin_compact, ensure_ascii=False)}

Return a JSON object:
{{
  "compliance_flags": [
    {{
      "severity": "HIGH / MEDIUM / LOW",
      "category": "e.g. Single Borrower Limit / Foreign Currency / Collateral / IFRS-VAS / Related Party",
      "issue": "Clear description of the compliance concern",
      "regulation_reference": "Full name + number + year of relevant regulation (or 'NEEDS VERIFICATION')",
      "verification_status": "VERIFIED / PROBABLE / NEEDS VERIFICATION",
      "recommendation": "What the deal team or legal should do",
      "deal_breaker": true_or_false
    }}
  ],
  "sbv_limit_check": {{
    "single_borrower_limit_applicable": true_or_false,
    "group_exposure_applicable": true_or_false,
    "foreign_currency_lending_applicable": true_or_false,
    "notes": "summary of limit analysis"
  }},
  "covenant_assessment": {{
    "maintenance_covenants_present": true_or_false,
    "incurrence_covenants_present": true_or_false,
    "ifrs_vs_vas_flag": "Does the covenant definition specify IFRS or VAS? Critical if not specified.",
    "covenant_gaps": ["list of missing covenants for this facility type"]
  }},
  "overall_regulatory_position": "CLEAR / FLAGS FOR REVIEW / SIGNIFICANT CONCERNS",
  "disclaimer": "Always include: These flags require verification by TCB Legal and Compliance before finalisation."
}}

Rules:
- Max {max_flags} compliance flags
- Keep each issue/recommendation concise
- JSON only."""

        response = self.call_llm(prompt)
        try:
            cleaned = re.sub(r"```(?:json)?\n?", "", response).replace("```", "").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {
                "raw_output": response,
                "parse_error": "Compliance output was not valid JSON",
                "overall_regulatory_position": "UNKNOWN — REVIEW REQUIRED"
            }

    def run(self, state: DealState) -> dict:
        print(f"[Compliance] Running regulatory screening...")

        result = self.screen_compliance(state.parsed_terms, state.financial_model)

        flags = result.get("compliance_flags", [])
        high_flags = [f for f in flags if f.get("severity") == "HIGH"]
        print(f"[Compliance] Found {len(flags)} flags ({len(high_flags)} HIGH)")

        state.compliance_flags = flags
        state.regulatory_summary = json.dumps({
            "sbv_limit_check": result.get("sbv_limit_check", {}),
            "covenant_assessment": result.get("covenant_assessment", {}),
            "overall_position": result.get("overall_regulatory_position", "UNKNOWN"),
            "disclaimer": result.get("disclaimer", "")
        }, indent=2)
        state.mark_complete("compliance")

        return state.dict()


_agent = ComplianceAgent()

def run_compliance_agent(state: DealState) -> dict:
    return _agent.run(state)
