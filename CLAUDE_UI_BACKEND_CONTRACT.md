# Claude UI Backend Contract

This contract defines the backend surface for UI integration.  
The UI should call this backend only, not Hermes/LM Studio directly.

## Base

- Default local base URL: `http://127.0.0.1:8000`
- Start command:

```bash
uvicorn backend.api:app --host 127.0.0.1 --port 8000
```

## Endpoints

### 1) Upload Files

- `POST /api/files`
- Content-Type: `multipart/form-data`
- Field: `files` (one or more files)

Response:

```json
{
  "files": [
    {
      "file_id": "uuid",
      "original_name": "deal.pdf",
      "stored_name": "uuid_deal.pdf",
      "stored_path": "/abs/path/data/api/uploads/uuid_deal.pdf",
      "size_bytes": 12345,
      "content_type": "application/pdf",
      "uploaded_at": "2026-04-29T00:00:00+00:00"
    }
  ]
}
```

### 2) Create Run

- `POST /api/runs`
- Body JSON:

```json
{
  "intent": "memo_only",
  "audience": "credit_committee",
  "route_mode": "auto",
  "workers": ["market_intel"],
  "manager_instruction": "market intel only",
  "post_credit": "stop",
  "human_gate": "approve",
  "autonomous": true,
  "fast": false,
  "skip_preflight": false,
  "no_web_research": true,
  "file_ids": ["uuid"],
  "text": "",
  "sample": false
}
```

Rules:
- Provide at least one of: `file_ids`, `text`, or `sample=true`.
- `intent`: `memo_only | memo_plus_distribution | memo_plus_holdbook | full_e2e`
- `route_mode`: `auto | full | targeted`
- `post_credit`: `ask | stop | holdbook | distribution | hybrid`
- `human_gate`: `ask | approve | revise | stop`

Response:

```json
{
  "run_id": "uuid",
  "status": "queued",
  "status_url": "/api/runs/uuid",
  "artifacts_url": "/api/runs/uuid/artifacts"
}
```

### 3) Run Status

- `GET /api/runs/{run_id}`

Response includes:
- lifecycle fields (`queued|running|succeeded|failed|cancelled`)
- timestamps
- return code
- logs (`stdout_log`, `stderr_log`)
- request snapshot and input file paths
- artifact index

### 3b) Run History

- `GET /api/runs?limit=50`
- Returns latest run records for UI history list.

### 4) Run Artifacts

- `GET /api/runs/{run_id}/artifacts`

Response:

```json
{
  "run_id": "uuid",
  "status": "succeeded",
  "artifacts": [
    {
      "name": "CC_Memo_xxx.txt",
      "path": "/abs/path/data/output/CC_Memo_xxx.txt",
      "size_bytes": 1000,
      "mtime": "2026-04-29T00:00:00+00:00",
      "download_url": "/api/artifacts/uuid/CC_Memo_xxx.txt"
    }
  ]
}
```

### 5) Artifact Download

- `GET /api/artifacts/{run_id}/{filename}`
- Returns file stream if the artifact belongs to the run.

### 5b) Run Logs

- `GET /api/runs/{run_id}/logs?max_lines=200`
- Returns stdout/stderr tail for browser monitoring.

### 6) Control

- `POST /api/control`
- Body JSON:

```json
{
  "action": "pause",
  "notify": true,
  "run_id": ""
}
```

Allowed actions:
- `pause`
- `resume`
- `status`
- `cancel_current_run`
- `send_latest_report`

Behavior:
- Writes a command JSON into `SF_CONTROL_DIR` (or default `data/inbox/control`).
- If `action=cancel_current_run` and `run_id` is provided, backend attempts local process termination for that run as well.

### 7) Health

- `GET /api/health`

Response includes:
- `ok`
- provider/base/model
- provider preflight payload

### 8) Worker Service Helpers (Local Ops)

- `GET /api/system/worker/status`
- `POST /api/system/worker/start`
- `POST /api/system/worker/stop`

Notes:
- These endpoints execute local helper scripts under `scripts/`.
- They are intended for laptop/local operation convenience.

## Persistence

Backend persists state under:
- `data/api/uploads.json`
- `data/api/runs.json`
- `data/api/uploads/`
- `data/api/logs/`

This supports UI polling and run history continuity across backend restarts.

## UI Route

- Built-in UI is served by backend at:
  - `/` -> redirects to `/static/index.html`
- This UI consumes the same API contract above.

## CORS

- Backend CORS is controlled by env var:
  - `SF_UI_ORIGINS` (comma-separated origins, default `*`)

## Optional API Key Guard

- If `SF_API_KEY` is set, all `/api/*` endpoints require:
  - `X-SF-API-KEY: <your-key>`
- Built-in UI supports this via top-bar API key input (stored in browser localStorage).
