"""
agents/operations_planner.py - Deal implementation workflow planner.
"""

import json
import re
from typing import Any, Dict, Optional
from agents.base import BaseAgent
from workflow.state import DealState


class OperationsPlannerAgent(BaseAgent):
    name = "operations_planner"

    system_prompt = """You are an operations execution lead for structured finance.
Design implementation workflow that is practical, auditable, and owner-assigned.
No icons. No fluff. Executive professional style.
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

    def _fallback(self, mode: str, reason: str) -> Dict[str, Any]:
        return {
            "implementation_mode": mode,
            "workstreams": [
                {
                    "name": "Credit and Legal",
                    "owner": "Credit + Legal",
                    "actions": ["Finalize conditions precedent", "Confirm covenant wording", "Approve final documentation"],
                    "dependencies": ["Credit memo approved"],
                    "timing": "T+0 to T+5",
                },
                {
                    "name": "Execution and Settlement",
                    "owner": "Operations",
                    "actions": ["Set up facility in core systems", "Set payment schedule", "Set monitoring controls"],
                    "dependencies": ["Signed legal docs"],
                    "timing": "T+5 to T+10",
                },
            ],
            "critical_path": ["Credit sign-off", "Legal doc execution", "System setup", "First utilization readiness"],
            "gates": ["Gate 1: approval", "Gate 2: legal close", "Gate 3: go-live"],
            "notes": f"Fallback mode: {reason}",
        }

    def create_plan(self, state: DealState, distribution_advice: Dict[str, Any], mode: str) -> Dict[str, Any]:
        prompt = f"""Build a practical implementation workflow in strict JSON.

Mode:
{mode}

Deal terms:
{json.dumps(state.parsed_terms, indent=2)}

Compliance flags:
{json.dumps(state.compliance_flags, indent=2)}

Distribution advice:
{json.dumps(distribution_advice, indent=2)}

Return JSON:
{{
  "implementation_mode": "HOLDBOOK|DISTRIBUTION|HYBRID",
  "workstreams": [
    {{
      "name": "...",
      "owner": "...",
      "actions": ["..."],
      "dependencies": ["..."],
      "timing": "T+n"
    }}
  ],
  "critical_path": ["..."],
  "gates": ["..."],
  "day_0_to_day_30": ["..."],
  "controls_and_reporting": ["..."]
}}

Rules:
- Keep it execution-ready and concise.
- Include distribution-specific tasks if mode is DISTRIBUTION/HYBRID.
- Include investor communication control points if applicable.
- JSON only.
"""
        resp = self.call_llm(prompt)
        if str(resp).startswith("ERROR:"):
            return self._fallback(mode, str(resp))

        obj = self._parse_json(resp)
        if not obj:
            return self._fallback(mode, "JSON parse failed")
        return obj

    def run_custom(self, state: DealState, distribution_advice: Dict[str, Any], mode: str) -> Dict[str, Any]:
        plan = self.create_plan(state, distribution_advice, mode)
        state.operations_workplan = plan
        state.mark_complete("operations_planner")
        return plan


_agent = OperationsPlannerAgent()


def run_operations_planner_agent(state: DealState, distribution_advice: Optional[Dict[str, Any]] = None, mode: str = "HOLDBOOK") -> Dict[str, Any]:
    return _agent.run_custom(state, distribution_advice or {}, mode)
