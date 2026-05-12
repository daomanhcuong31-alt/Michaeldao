"""
agents/distribution_advisor.py - Hold/distribute/hybrid advisory with investor suitability.
"""

import json
import re
from typing import Any, Dict, Optional
from agents.base import BaseAgent
from workflow.state import DealState


class DistributionAdvisorAgent(BaseAgent):
    name = "distribution_advisor"

    system_prompt = """You are a structured finance distribution strategist.
Output must be professional, concise, and executive-ready.
No icons. No hype. No filler.
"""

    def _parse_json(self, text: str) -> Optional[Dict[str, Any]]:
        cleaned = re.sub(r"```(?:json)?\n?", "", str(text)).replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except Exception:
            pass
        blocks = re.findall(r"\{[\s\S]*\}", cleaned)
        for block in sorted(blocks, key=len, reverse=True):
            try:
                return json.loads(block)
            except Exception:
                continue
        return None

    def _fallback(self, preferred_mode: str, reason: str) -> Dict[str, Any]:
        rec = preferred_mode if preferred_mode in {"HOLD_BOOK", "DISTRIBUTE", "HYBRID"} else "HYBRID"
        return {
            "distribution_recommendation": rec,
            "investor_suitability": [],
            "soundout_strategy": {
                "launch_readiness": "CONDITIONAL",
                "priority_targets": [],
                "sequencing": ["Validate legal + credit pack", "Run limited soundout", "Decide final launch"],
                "key_messages": [],
            },
            "execution_implications": {
                "ops_complexity": "MEDIUM",
                "dependencies": ["Credit approval", "Legal confirmation", "Pricing committee"],
                "risk_controls": ["Controlled launch", "Limit initial ticket size"],
            },
            "must_resolve_before_launch": ["Insufficient reliable market evidence"],
            "confidence": "LOW",
            "notes": f"Fallback mode: {reason}",
        }

    def create_advice(self, state: DealState, research_bundle: Dict[str, Any], preferred_mode: str = "AUTO") -> Dict[str, Any]:
        prompt = f"""Create distribution advisory in strict JSON.

Preferred mode from human:
{preferred_mode}

Deal terms:
{json.dumps(state.parsed_terms, indent=2)}

Financial model summary:
{json.dumps((state.financial_model or {}).get('calculated_metrics', {}), indent=2)}

Compliance flags:
{json.dumps(state.compliance_flags, indent=2)}

Credit memo:
{state.draft_memo[:4000]}

External research bundle:
{json.dumps(research_bundle, indent=2)}

Return JSON exactly:
{{
  "distribution_recommendation": "HOLD_BOOK|DISTRIBUTE|HYBRID|DEFER",
  "investor_suitability": [
    {{
      "investor_type": "...",
      "fit": "HIGH|MEDIUM|LOW",
      "rationale": "...",
      "evidence_ids": ["S1","S2"]
    }}
  ],
  "soundout_strategy": {{
    "launch_readiness": "READY|CONDITIONAL|NOT_READY",
    "priority_targets": ["..."],
    "sequencing": ["..."],
    "key_messages": ["..."]
  }},
  "execution_implications": {{
    "ops_complexity": "LOW|MEDIUM|HIGH",
    "dependencies": ["..."],
    "risk_controls": ["..."]
  }},
  "must_resolve_before_launch": ["..."],
  "confidence": "HIGH|MEDIUM|LOW"
}}

Rules:
- Professional tone for senior audiences.
- Do not invent sources. Use only evidence_ids present in research_bundle.data.sources IDs.
- If research is missing or weak, lower confidence and state conservative launch readiness.
- JSON only.
"""
        resp = self.call_llm(prompt)
        if str(resp).startswith("ERROR:"):
            return self._fallback(preferred_mode, str(resp))

        obj = self._parse_json(resp)
        if not obj:
            return self._fallback(preferred_mode, "JSON parse failed")
        return obj

    def run_custom(self, state: DealState, research_bundle: Dict[str, Any], preferred_mode: str = "AUTO") -> Dict[str, Any]:
        advice = self.create_advice(state, research_bundle, preferred_mode)
        state.distribution_advice = advice
        state.mark_complete("distribution_advisor")
        return advice


_agent = DistributionAdvisorAgent()


def run_distribution_advisor_agent(state: DealState, research_bundle: Optional[Dict[str, Any]] = None, preferred_mode: str = "AUTO") -> Dict[str, Any]:
    return _agent.run_custom(state, research_bundle or {"status": "skipped", "data": {"sources": []}}, preferred_mode)
