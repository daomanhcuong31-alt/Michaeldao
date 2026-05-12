# SF Agentic AI Backend Contract for Claude UI

Use this file as the frontend-to-backend handoff spec. The UI should not call Hermes directly. It should call your backend API, which then maps requests to the current engine.

## Requirements

1. The frontend must send all run configuration to the backend.
2. The backend must translate UI config into the engine contract already used in this repo.
3. Google Drive is a file source, not the engine.
4. Upload, Drive attach, run control, and downloads must all be backend-driven.
5. `route_mode=targeted` must reveal worker selection.
6. `route_mode=auto` must reveal manager instruction input.
7. Status UI must show planned workers, completed steps, current agent, and last error.
8. Artifact downloads must come from backend URLs.

## Backend API Contract

### `POST /api/files`
Upload files and return file references.

Request:
```json
{
  "files": ["<binary multipart files>"]
}
```

Response:
```json
{
  "files": [
    {
      "id": "file_123",
      "name": "term_sheet.pdf",
      "source": "upload",
      "mime_type": "application/pdf",
      "size_bytes": 123456,
      "download_url": "/api/files/file_123/download"
    }
  ]
}
```

### `POST /api/runs`
Create a run.

Request:
```json
{
  "config": {
    "intent": "memo_only",
    "route_mode": "auto",
    "target_workers": ["market_intel"],
    "manager_instruction": "market intel only",
    "audience": "credit_committee",
    "post_credit": "stop",
    "human_gate": "approve",
    "autonomous": true,
    "fast": true,
    "no_web_research": true,
    "skip_preflight": false,
    "provider": "hermes",
    "timeout_sec": 1800,
    "drive_folder_id": "",
    "notes": ""
  },
  "inputs": [
    {
      "id": "file_123",
      "name": "term_sheet.pdf",
      "source": "upload",
      "mime_type": "application/pdf",
      "size_bytes": 123456,
      "download_url": "/api/files/file_123/download"
    }
  ],
  "text_input": "",
  "run_name": "Deal A"
}
```

Response:
```json
{
  "run_id": "run_456",
  "status": "queued"
}
```

### `GET /api/runs/:run_id`
Fetch run status.

Response:
```json
{
  "run_id": "run_456",
  "status": "running",
  "route_mode": "auto",
  "planned_workers": ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
  "completed_steps": ["ingestion"],
  "current_agent": "market_intel",
  "progress_percent": 25,
  "quality_gate_decision": "",
  "last_error": "",
  "manager_plan": {
    "mode": "full",
    "workers": ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
    "reason": "auto-default-full"
  },
  "artifacts_count": 0,
  "created_at": "2026-04-28T12:00:00Z",
  "updated_at": "2026-04-28T12:01:00Z"
}
```

### `GET /api/runs/:run_id/artifacts`
List artifacts.

Response:
```json
{
  "artifacts": [
    {
      "artifact_id": "art_001",
      "run_id": "run_456",
      "name": "CC_Memo_Deal_A_20260428_120100.txt",
      "kind": "credit_memo",
      "mime_type": "text/plain",
      "size_bytes": 22345,
      "download_url": "/api/artifacts/art_001/download",
      "created_at": "2026-04-28T12:01:10Z"
    }
  ]
}
```

### `POST /api/control`
Send control actions.

Request:
```json
{
  "action": "send_latest_report",
  "run_id": "",
  "notify": true,
  "message": ""
}
```

Supported actions:
```json
["pause", "resume", "status", "cancel_current_run", "send_latest_report"]
```

### `GET /api/health`
Return engine readiness.

Response:
```json
{
  "ok": true,
  "provider": "hermes",
  "ready": true
}
```

## JSON Schemas

### `RunConfig`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/run-config.json",
  "title": "RunConfig",
  "type": "object",
  "additionalProperties": false,
  "required": ["intent", "route_mode"],
  "properties": {
    "intent": {
      "type": "string",
      "enum": ["memo_only", "memo_plus_distribution", "memo_plus_holdbook", "full_e2e"]
    },
    "route_mode": {
      "type": "string",
      "enum": ["auto", "full", "targeted"]
    },
    "target_workers": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["ingestion", "market_intel", "analysis_parallel", "financial_modeler", "compliance", "memo_architect", "senior_advisor"]
      },
      "default": []
    },
    "manager_instruction": { "type": "string", "default": "" },
    "audience": {
      "type": "string",
      "enum": ["credit_committee", "relationship_manager", "risk", "senior_management", "operations"],
      "default": "credit_committee"
    },
    "post_credit": {
      "type": "string",
      "enum": ["ask", "stop", "holdbook", "distribution", "hybrid"],
      "default": "ask"
    },
    "human_gate": {
      "type": "string",
      "enum": ["ask", "approve", "revise", "stop"],
      "default": "ask"
    },
    "autonomous": { "type": "boolean", "default": true },
    "fast": { "type": "boolean", "default": true },
    "no_web_research": { "type": "boolean", "default": false },
    "skip_preflight": { "type": "boolean", "default": false },
    "provider": { "type": "string", "enum": ["hermes", "lm_studio"], "default": "hermes" },
    "timeout_sec": { "type": "integer", "minimum": 120, "maximum": 14400, "default": 1800 },
    "drive_folder_id": { "type": "string", "default": "" },
    "notes": { "type": "string", "default": "" }
  }
}
```

### `FileReference`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/file-reference.json",
  "title": "FileReference",
  "type": "object",
  "additionalProperties": false,
  "required": ["name", "source"],
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "source": { "type": "string", "enum": ["upload", "google_drive", "local_path"] },
    "mime_type": { "type": "string" },
    "size_bytes": { "type": "integer", "minimum": 0 },
    "drive_file_id": { "type": "string" },
    "drive_folder_id": { "type": "string" },
    "download_url": { "type": "string" }
  }
}
```

### `RunRequest`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/run-request.json",
  "title": "RunRequest",
  "type": "object",
  "additionalProperties": false,
  "required": ["config", "inputs"],
  "properties": {
    "config": { "$ref": "https://sf-agentic-ai.local/schemas/run-config.json" },
    "inputs": {
      "type": "array",
      "items": { "$ref": "https://sf-agentic-ai.local/schemas/file-reference.json" },
      "default": []
    },
    "text_input": { "type": "string", "default": "" },
    "run_name": { "type": "string", "default": "" }
  }
}
```

### `RunStatus`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/run-status.json",
  "title": "RunStatus",
  "type": "object",
  "additionalProperties": false,
  "required": ["run_id", "status", "created_at", "updated_at"],
  "properties": {
    "run_id": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["queued", "running", "paused", "completed", "failed", "cancelled"]
    },
    "route_mode": { "type": "string", "enum": ["auto", "full", "targeted"] },
    "planned_workers": { "type": "array", "items": { "type": "string" }, "default": [] },
    "completed_steps": { "type": "array", "items": { "type": "string" }, "default": [] },
    "current_agent": { "type": "string", "default": "" },
    "progress_percent": { "type": "number", "minimum": 0, "maximum": 100 },
    "quality_gate_decision": { "type": "string", "default": "" },
    "last_error": { "type": "string", "default": "" },
    "manager_plan": { "type": "object", "additionalProperties": true },
    "artifacts_count": { "type": "integer", "minimum": 0, "default": 0 },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

### `Artifact`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/artifact.json",
  "title": "Artifact",
  "type": "object",
  "additionalProperties": false,
  "required": ["artifact_id", "run_id", "name", "kind", "download_url"],
  "properties": {
    "artifact_id": { "type": "string" },
    "run_id": { "type": "string" },
    "name": { "type": "string" },
    "kind": {
      "type": "string",
      "enum": ["credit_memo", "metadata", "post_credit", "log", "other"]
    },
    "mime_type": { "type": "string" },
    "size_bytes": { "type": "integer", "minimum": 0 },
    "download_url": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" }
  }
}
```

### `ControlCommand`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://sf-agentic-ai.local/schemas/control-command.json",
  "title": "ControlCommand",
  "type": "object",
  "additionalProperties": false,
  "required": ["action"],
  "properties": {
    "action": {
      "type": "string",
      "enum": ["pause", "resume", "status", "cancel_current_run", "send_latest_report"]
    },
    "run_id": { "type": "string", "default": "" },
    "notify": { "type": "boolean", "default": true },
    "message": { "type": "string", "default": "" }
  }
}
```

## Frontend Placeholder Requirements

1. Build an upload panel that binds to `POST /api/files`.
2. Build a Google Drive attach flow that returns `FileReference[]`.
3. Build a run config form bound to `RunConfig`.
4. Show worker multi-select only when `route_mode=targeted`.
5. Show manager instruction input only when `route_mode=auto`.
6. Add a run timeline/status card bound to `RunStatus`.
7. Add an artifacts table bound to `Artifact[]`.
8. Add control buttons bound to `ControlCommand`.
9. Keep the frontend API base URL in an env variable such as `VITE_API_BASE_URL`.
10. Do not couple the UI to Hermes or any direct model provider calls.

