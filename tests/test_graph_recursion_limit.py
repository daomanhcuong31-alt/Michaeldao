import workflow.graph as graph


class _FakePipeline:
    def __init__(self):
        self.last_config = None

    def invoke(self, state, config=None):
        self.last_config = config or {}
        return {
            **state,
            "completed_steps": ["ingestion"],
            "errors": [],
            "messages": [],
        }


def test_run_pipeline_applies_recursion_limit(monkeypatch):
    fake = _FakePipeline()
    monkeypatch.setenv("PIPELINE_RECURSION_LIMIT", "77")
    monkeypatch.setattr(graph, "build_graph", lambda: fake)

    out = graph.run_pipeline(input_text="x", audience="credit_committee", intent="memo_only")
    assert fake.last_config.get("recursion_limit") == 77
    assert "ingestion" in out.completed_steps
