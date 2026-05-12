"""
agents/financial_modeler.py — Financial Modeler Agent

Role: Validates the financial structure and runs key credit metrics.

Input:  state.parsed_terms + state.market_context
Output: state.financial_model  (DSCR, waterfall, stress scenarios, ratios)

CRITICAL DESIGN PRINCIPLE — Numerical Precision:
  This agent does NOT rely on the LLM for arithmetic.
  The LLM identifies what to calculate and sets up the parameters.
  Python then does all the actual math.
  This eliminates the hallucination risk on numbers.

The flow is:
  1. LLM reads the deal terms and identifies the financial structure
  2. LLM outputs structured parameters (no calculations)
  3. Python functions calculate DSCR, waterfall, stress scenarios
  4. LLM writes the narrative around the Python-verified numbers
"""

import json
import re
from agents.base import BaseAgent
from workflow.state import DealState
from tools.calculator import (
    calculate_dscr,
    calculate_waterfall,
    run_stress_scenarios
)


class FinancialModelerAgent(BaseAgent):

    name = "financial_modeler"

    system_prompt = """You are a structured finance modeller at Techcombank CIBG, Vietnam.

You analyse deal financial structures for credit committee review.

CRITICAL RULE: You do NOT perform arithmetic. You extract and structure the financial
parameters from the deal documents. A separate Python engine handles all calculations.
Your job is to:
1. Identify the financial parameters needed for the model
2. Flag any missing data that would prevent accurate modelling
3. Explain the financial logic and structural features
4. Interpret the calculated outputs and write the credit narrative

Standards:
- Specify IFRS vs VAS for all financial figures — divergence is material
- Flag if historical financials are not available (common for new-to-bank clients)
- Always state the assumed base case and what would break it
"""

    def extract_financial_params(self, parsed_terms: dict) -> dict:
        """Ask the LLM to extract the raw financial parameters (no math)."""

        prompt = f"""Extract financial modelling parameters from this deal. Do NOT calculate anything.
Just extract numbers as stated in the document.

DEAL TERMS:
{json.dumps(parsed_terms, indent=2)}

Return a JSON object with:
{{
  "ebitda_annual": null_or_number,
  "total_debt": null_or_number,
  "proposed_facility_amount": null_or_number,
  "annual_debt_service": null_or_number,
  "interest_rate_pct": null_or_number,
  "tenor_years": null_or_number,
  "repayment_type": "bullet / amortising / semi-annual / other",
  "collateral_value": null_or_number,
  "ltv_stated": null_or_number,
  "accounting_standard": "IFRS / VAS / Unknown",
  "financials_available": true_or_false,
  "financial_year_end": "month/year or Unknown",
  "missing_data": ["list of missing items that would affect modelling"],
  "structural_notes": "any structural features that affect the waterfall"
}}

Return JSON only. Use null for any number not stated in the document."""

        response = self.call_llm(prompt)
        try:
            cleaned = re.sub(r"```(?:json)?\n?", "", response).replace("```", "").strip()
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"parse_error": response, "missing_data": ["Parameter extraction failed"]}

    def write_financial_narrative(self, params: dict, calc_results: dict) -> str:
        """Ask the LLM to write the credit narrative around verified numbers."""

        prompt = f"""Write the financial analysis section of a credit committee memo.

The numbers below have been verified by Python — use them exactly as given.
Do NOT change any figures. Write in TCB credit committee tone — formal, analytical,
concise. Flag risks clearly.

VERIFIED FINANCIAL METRICS:
{json.dumps(calc_results, indent=2)}

DEAL PARAMETERS:
{json.dumps(params, indent=2)}

Write:
1. Financial structure summary (2-3 sentences)
2. Key credit metrics (reference each calculated figure)
3. Base case assumption and what breaks it
4. Financial risk assessment (3-5 bullet points)

Max 400 words. No tables — narrative only for this section."""

        return self.call_llm(prompt)

    def run(self, state: DealState) -> dict:
        print(f"[Financial Modeler] Extracting parameters and running calculations...")

        if not state.parsed_terms:
            state.add_error("financial_modeler", "No parsed terms — Ingestion must run first")
            state.mark_complete("financial_modeler")
            return state.dict()

        # Step 1: LLM extracts parameters (no math)
        params = self.extract_financial_params(state.parsed_terms)

        # Step 2: Python does all calculations (no hallucination risk)
        calc_results = {}
        try:
            dscr = calculate_dscr(
                ebitda=params.get("ebitda_annual"),
                annual_debt_service=params.get("annual_debt_service"),
                total_debt=params.get("total_debt"),
                facility_amount=params.get("proposed_facility_amount"),
                interest_rate=params.get("interest_rate_pct"),
                tenor_years=params.get("tenor_years"),
                repayment_type=params.get("repayment_type", "amortising")
            )
            calc_results["dscr_analysis"] = dscr

            waterfall = calculate_waterfall(
                collateral_value=params.get("collateral_value"),
                facility_amount=params.get("proposed_facility_amount"),
                ltv_stated=params.get("ltv_stated")
            )
            calc_results["waterfall"] = waterfall

            stress = run_stress_scenarios(
                base_dscr=dscr.get("dscr_base"),
                base_ltv=waterfall.get("ltv_calculated")
            )
            calc_results["stress_scenarios"] = stress

        except Exception as e:
            print(f"[Financial Modeler] Calculation error: {e}")
            calc_results["calculation_error"] = str(e)
            calc_results["note"] = "Insufficient financial data for full modelling"

        # Step 3: LLM writes narrative around the verified numbers
        narrative = self.write_financial_narrative(params, calc_results)

        state.financial_model = {
            "parameters": params,
            "calculated_metrics": calc_results,
            "narrative": narrative,
            "accounting_standard": params.get("accounting_standard", "Unknown"),
            "data_quality": "PARTIAL" if params.get("missing_data") else "COMPLETE"
        }
        state.mark_complete("financial_modeler")
        print(f"[Financial Modeler] Complete. DSCR available: {'dscr_analysis' in calc_results}")

        return state.dict()


_agent = FinancialModelerAgent()

def run_financial_modeler_agent(state: DealState) -> dict:
    return _agent.run(state)
