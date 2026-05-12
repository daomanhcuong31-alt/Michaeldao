import backend.api as backend_api
from fastapi.testclient import TestClient

from backend.api import app


client = TestClient(app)


def test_api_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    payload = resp.json()
    assert "ok" in payload
    assert "preflight" in payload


def test_create_run_requires_input():
    resp = client.post("/api/runs", json={})
    assert resp.status_code == 400
    assert "Provide at least one of" in resp.json().get("detail", "")


def test_list_runs_endpoint():
    resp = client.get("/api/runs?limit=10")
    assert resp.status_code == 200
    payload = resp.json()
    assert "runs" in payload
    assert isinstance(payload["runs"], list)


def test_root_redirects_to_ui():
    resp = client.get("/", follow_redirects=False)
    assert resp.status_code in {302, 307}
    assert resp.headers.get("location") == "/static/claude-ui/index.html"


def test_api_key_guard(monkeypatch):
    monkeypatch.setenv("SF_API_KEY", "test-key")
    denied = client.get("/api/health")
    assert denied.status_code == 401
    allowed = client.get("/api/health", headers={"x-sf-api-key": "test-key"})
    assert allowed.status_code == 200
    monkeypatch.delenv("SF_API_KEY", raising=False)


def test_worker_system_endpoints(monkeypatch):
    fake = {"ok": True, "return_code": 0, "stdout": "ok", "stderr": "", "error": ""}

    def _fake_run(_name, timeout_sec=20):
        return {**fake, "timeout_sec": timeout_sec}

    monkeypatch.setattr(backend_api, "_run_local_script", _fake_run)
    for method, url in [
        ("get", "/api/system/worker/status"),
        ("post", "/api/system/worker/start"),
        ("post", "/api/system/worker/stop"),
    ]:
        resp = getattr(client, method)(url)
        assert resp.status_code == 200
        payload = resp.json()
        assert payload.get("ok") is True
        assert "result" in payload
        if method == "get":
            assert "worker" in payload
            assert "runtime" in payload
            assert "queue" in payload


def test_integrations_and_me_endpoints():
    i = client.get("/api/integrations")
    assert i.status_code == 200
    assert "items" in i.json()
    assert "counts" in i.json()
    assert "ui_config" in i.json()
    me = client.get("/api/me")
    assert me.status_code == 200
    assert "name" in me.json()


def test_supported_upload_extensions_cover_office_and_csv():
    exts = backend_api.SUPPORTED_EXTS
    for ext in [".pptx", ".xlsx", ".csv", ".txt", ".pdf", ".docx"]:
        assert ext in exts


def test_ui_config_endpoints():
    original = client.get("/api/ui-config").json()
    g = client.get("/api/ui-config")
    assert g.status_code == 200
    body = g.json()
    assert "defaults" in body
    assert "standing_instruction" in body

    try:
        payload = {
            "standing_instruction": "Prioritize covenant downside.",
            "knowledge_base_notes": "Use internal style.",
            "standing_instruction_attachments": ["standing-file-1"],
            "knowledge_base_attachments": ["knowledge-file-1"],
            "account_profile": {"operator_name": "Test Operator", "workspace": "Test Workspace"},
            "policy": {
                "market_intel_instruction": "Track refinancing and sector downside.",
                "market_intel_attachments": ["market-file-1"],
            },
            "rag": {
                "enabled": True,
                "instruction": "Use internal references before generic reasoning.",
                "references": ["credit policy manual"],
                "attachments": ["rag-file-1"],
            },
            "google_drive": {"enabled": True, "source_folder_id": "abc123"},
            "telegram": {"enabled": True, "channel": "@alerts"},
            "defaults": {"audience": "ceo", "route_mode": "auto"},
        }
        p = client.put("/api/ui-config", json=payload)
        assert p.status_code == 200
        out = p.json()
        assert out.get("ok") is True
        assert out.get("ui_config", {}).get("standing_instruction") == "Prioritize covenant downside."
        assert out.get("ui_config", {}).get("knowledge_base_notes") == "Use internal style."
        assert out.get("ui_config", {}).get("standing_instruction_attachments") == ["standing-file-1"]
        assert out.get("ui_config", {}).get("knowledge_base_attachments") == ["knowledge-file-1"]
        assert out.get("ui_config", {}).get("account_profile", {}).get("operator_name") == "Test Operator"
        assert out.get("ui_config", {}).get("account_profile", {}).get("workspace") == "Test Workspace"
        assert out.get("ui_config", {}).get("rag", {}).get("attachments") == ["rag-file-1"]
        assert out.get("ui_config", {}).get("policy", {}).get("market_intel_attachments") == ["market-file-1"]

        g2 = client.get("/api/ui-config")
        assert g2.status_code == 200
        persisted = g2.json()
        assert persisted.get("standing_instruction") == "Prioritize covenant downside."
        assert persisted.get("knowledge_base_notes") == "Use internal style."
        assert persisted.get("standing_instruction_attachments") == ["standing-file-1"]
        assert persisted.get("knowledge_base_attachments") == ["knowledge-file-1"]
        assert persisted.get("account_profile", {}).get("operator_name") == "Test Operator"
        assert persisted.get("account_profile", {}).get("workspace") == "Test Workspace"
        assert persisted.get("rag", {}).get("attachments") == ["rag-file-1"]
        assert persisted.get("policy", {}).get("market_intel_attachments") == ["market-file-1"]

        me = client.get("/api/me")
        assert me.status_code == 200
        assert me.json().get("name") == "Test Operator"
        assert me.json().get("workspace") == "Test Workspace"
    finally:
        client.put("/api/ui-config", json=original)


def test_create_run_combines_settings_knowledge_attachments(monkeypatch):
    original = client.get("/api/ui-config").json()
    monkeypatch.setattr(backend_api, "_start_run_thread", lambda run_id, req, input_files: None)
    try:
        client.put(
            "/api/ui-config",
            json={
                "standing_instruction_attachments": ["standing-global"],
                "knowledge_base_attachments": ["knowledge-global"],
                "policy": {
                    "market_intel_attachments": ["market-global"],
                    "credit_decision_mode": "analysis_only",
                },
                "rag": {"attachments": ["rag-global"]},
            },
        )
        created = client.post(
            "/api/runs",
            json={
                "run_name": "Attachment merge",
                "text": "Run with merged attachment context",
                "standing_instruction_attachment_ids": ["standing-run"],
                "knowledge_base_attachment_ids": ["knowledge-run"],
            },
        )
        assert created.status_code == 200
        run = client.get(f"/api/runs/{created.json()['run_id']}")
        assert run.status_code == 200
        request = run.json().get("request", {})
        assert request.get("standing_instruction_attachment_ids") == ["standing-global", "standing-run"]
        assert request.get("knowledge_base_attachment_ids") == [
            "knowledge-global",
            "rag-global",
            "market-global",
            "knowledge-run",
        ]
    finally:
        client.put("/api/ui-config", json=original)


def test_integration_test_endpoint_google_drive():
    resp = client.post("/api/integrations/google_drive/test")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload.get("provider") == "google_drive"
    assert "detail" in payload


def test_rerun_endpoint(monkeypatch):
    monkeypatch.setattr(backend_api, "_execute_run", lambda run_id, req, input_files: None)
    created = client.post("/api/runs", json={"sample": True})
    assert created.status_code == 200
    run_id = created.json().get("run_id")
    assert run_id

    rerun = client.post(f"/api/runs/{run_id}/rerun")
    assert rerun.status_code == 200
    payload = rerun.json()
    assert payload.get("source_run_id") == run_id
    assert payload.get("run_id")


def test_latest_artifact_prefers_user_report(tmp_path):
    run_id = "run-test-artifacts"
    report = tmp_path / "CC_Memo_Test.txt"
    metadata = tmp_path / "CC_Memo_Test.metadata.json"
    report.write_text("report content", encoding="utf-8")
    metadata.write_text("{}", encoding="utf-8")
    record = {
        "run_id": run_id,
        "version_label": "v1.0",
        "request": {"run_name": "Artifact Preference v1.0"},
        "artifacts": [
            {"name": metadata.name, "path": str(metadata)},
            {"name": report.name, "path": str(report)},
        ],
    }
    decorated = backend_api._decorate_run(record)
    assert decorated["latest_artifact"]["kind"] == "credit_memo"
    assert decorated["latest_artifact"]["name"] == report.name


def test_build_run_cmd_passes_non_credit_output_as_structured_args():
    req = backend_api.RunRequest(
        run_name="Minutes UAT",
        intent="meeting_minutes",
        text="Meeting notes",
        report_format="meeting_minutes",
        output_template_id="meeting_minutes",
        output_formats=["txt"],
    )

    cmd = backend_api._build_run_cmd(req, [])
    joined = "\n".join(cmd)

    assert "--report-format" in cmd
    assert "meeting_minutes" in cmd
    assert "[Credit Memo Objective]" not in joined
    assert "[Output Family]\nmeeting_minutes" in joined


def test_non_credit_artifact_kind_is_not_credit_memo(tmp_path):
    report = tmp_path / "MeetingMinutes_Test.txt"
    report.write_text("minutes", encoding="utf-8")
    item = {"name": report.name, "path": str(report)}

    decorated = backend_api._decorate_artifact("run-minutes", item)

    assert decorated["kind"] == "meeting_minutes"
