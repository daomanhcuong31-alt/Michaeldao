"""
workflow/state.py - Shared state passed between agents
"""

from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class DealState(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    input_text: str = Field(default="")
    input_file_path: Optional[str] = Field(default=None)

    raw_text: str = Field(default="")
    parsed_terms: dict = Field(default_factory=dict)

    market_context: dict = Field(default_factory=dict)
    financial_model: dict = Field(default_factory=dict)

    compliance_flags: list = Field(default_factory=list)
    regulatory_summary: str = Field(default="")

    draft_memo: str = Field(default="")

    # Quality + brand controls
    audience: str = Field(default="credit_committee")
    intent: str = Field(default="memo_only")
    route_mode: str = Field(default="auto")
    target_workers: list = Field(default_factory=list)
    manager_instruction: str = Field(default="")
    manager_plan: dict = Field(default_factory=dict)
    desired_output: str = Field(default="credit_memo")
    report_format: str = Field(default="credit_memo")
    sop_format: str = Field(default="")
    output_template_id: str = Field(default="autonomous")
    structured_output_instruction: str = Field(default="")
    report_length_words: int = Field(default=0)
    credit_decision_mode: str = Field(default="analysis_only")
    brand_strict: bool = Field(default=True)
    output_metadata: dict = Field(default_factory=dict)

    quality_gate_decision: str = Field(default="PENDING")
    quality_score: int = Field(default=0)
    quality_gate_notes: list = Field(default_factory=list)
    advisor_feedback: str = Field(default="")
    revision_count: int = Field(default=0)
    max_revisions: int = Field(default=1)

    # Stage-2 post-credit outputs
    post_credit_mode: str = Field(default="STOP")
    investor_research: dict = Field(default_factory=dict)
    distribution_advice: dict = Field(default_factory=dict)
    operations_workplan: dict = Field(default_factory=dict)

    current_agent: str = Field(default="supervisor")
    completed_steps: list = Field(default_factory=list)
    errors: list = Field(default_factory=list)
    messages: list = Field(default_factory=list)

    # Compatibility shim: keep existing state.dict() call sites without Pydantic v2 warnings.
    def dict(self, *args, **kwargs):
        return self.model_dump(*args, **kwargs)

    def mark_complete(self, agent_name: str):
        if agent_name not in self.completed_steps:
            self.completed_steps.append(agent_name)

    def add_error(self, agent_name: str, error: str):
        self.errors.append({"agent": agent_name, "error": error})

    def summary(self) -> str:
        return (
            f"Pipeline status:\n"
            f"  Completed: {', '.join(self.completed_steps) or 'none'}\n"
            f"  Errors:    {len(self.errors)}\n"
            f"  Current:   {self.current_agent}\n"
            f"  Quality:   {self.quality_gate_decision} ({self.quality_score})\n"
            f"  Memo:      {'ready' if self.draft_memo else 'not yet written'}\n"
            f"  Post:      {self.post_credit_mode}"
        )
