import json
import re
from time import perf_counter
from agents.base import BaseAgent
from workflow.state import DealState

class MarketIntelAgent(BaseAgent):
    name = "market_intel"

    system_prompt = """You are a structured-finance market analyst.
Return concise JSON only.
If unsure, state [NEEDS VERIFICATION]."""

    def _parse_json(self, txt: str):
        cleaned = re.sub(r"```(?:json)?\n?", "", txt).replace("```", "").strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            try:
                return json.loads(cleaned)
            except Exception:
                pass
        m = re.findall(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(sorted(m, key=len, reverse=True)[0])
            except Exception:
                return None
        return None

    def _fallback(self, reason: str, deal: dict):
        deal_currency = deal.get("currency", "[NOT PROVIDED]")
        deal_sector = deal.get("borrower_type", "[NOT PROVIDED]")
        return {
            "sector_overview": {
                "sector_name": deal_sector,
                "sector_outlook": "[NEEDS VERIFICATION]",
                "key_risks": ["Live market generation timed out or failed"],
                "key_tailwinds": ["Strategic sector support may exist [NEEDS VERIFICATION]"],
                "data_source": f"Fallback mode: {reason[:160]}"
            },
            "benchmark_rates": {
                "sbv_refinancing_rate": "[NEEDS VERIFICATION]",
                "usd_benchmark": f"{deal_currency} benchmark unavailable [NEEDS VERIFICATION]",
                "data_source": "Fallback mode due to LLM timeout/error"
            },
            "macro_risks": [
                {
                    "risk": "Insufficient fresh market context",
                    "severity": "MEDIUM",
                    "mitigation": "Refresh LM Studio model and rerun market section"
                }
            ],
            "data_quality_notes": f"NEEDS VERIFICATION: LLM fallback activated ({reason[:180]})."
        }

    def analyse_market_context(self, parsed_terms: dict) -> dict:
        deal = {
            "borrower": parsed_terms.get("borrower", "[NOT PROVIDED]"),
            "borrower_type": parsed_terms.get("borrower_type", "[NOT PROVIDED]"),
            "facility_type": parsed_terms.get("facility_type", "[NOT PROVIDED]"),
            "amount": parsed_terms.get("amount", "[NOT PROVIDED]"),
            "currency": parsed_terms.get("currency", "[NOT PROVIDED]"),
            "tenor": parsed_terms.get("tenor", "[NOT PROVIDED]"),
            "pricing": parsed_terms.get("pricing", "[NOT PROVIDED]"),
            "purpose": parsed_terms.get("purpose", "[NOT PROVIDED]")
        }

        prompt = f"""Generate compact market context for this deal.

DEAL:
{json.dumps(deal, ensure_ascii=False)}

Return JSON with keys only:
- sector_overview: {{sector_name, sector_outlook, key_risks, key_tailwinds, data_source}}
- benchmark_rates: {{sbv_refinancing_rate, usd_benchmark, data_source}}
- macro_risks: [{{risk, severity, mitigation}}]
- data_quality_notes

Rules:
- Max 2 items per list
- Keep each field <= 18 words
- Use [NEEDS VERIFICATION] if uncertain
- JSON only
"""

        resp = self.call_llm(prompt)
        if resp.startswith("ERROR:"):
            return self._fallback(resp, deal)

        obj = self._parse_json(resp)
        if obj is None:
            return self._fallback("JSON parse failed", deal)

        return obj

    def run(self, state: DealState) -> dict:
        started = perf_counter()
        print("[Market Intel] START")
        fallback_used = False
        if not state.parsed_terms:
            state.add_error("market_intel", "No parsed terms available")
            state.market_context = self._fallback("No parsed terms", {})
            fallback_used = True
            state.mark_complete("market_intel")
            print(f"[Market Intel] END duration={perf_counter() - started:.2f}s fallback_used={fallback_used}")
            return state.dict()

        context = self.analyse_market_context(state.parsed_terms)
        if "fallback" in json.dumps(context).lower():
            state.add_error("market_intel", "Fallback mode used")
            fallback_used = True
        state.market_context = context
        state.mark_complete("market_intel")
        print(f"[Market Intel] END duration={perf_counter() - started:.2f}s fallback_used={fallback_used}")
        return state.dict()

_agent = MarketIntelAgent()
def run_market_intel_agent(state: DealState) -> dict:
    return _agent.run(state)
