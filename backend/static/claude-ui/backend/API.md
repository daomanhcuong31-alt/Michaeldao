# API Reference — SF Agentic AI Flow (Reconciled)
# Merges CLAUDE_UI_BACKEND_CONTRACT.md + original UI scaffold
# Date: 2026-04-28

Base URL: `http://localhost:4000` (mock) · `https://api.michaeldao.io` (prod)
Prefix: all routes under `/api/`
Auth: `Authorization: Bearer $AGENTFLOW_API_KEY`

---

## `POST /api/files`
Upload one or more files. Returns FileReference objects used in run inputs.

**Request:** multipart/form-data, field name `files` (multiple allowed)

**Response 200**
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

---

## `POST /api/runs`
Create a run.

**Body**
```json
{
  "idempotency_key": "uuid-v4",
  "run_name": "Deal A",
  "text_input": "Focus on the revenue projections",
  "config": {
    "intent":              "memo_only",
    "route_mode":          "auto",
    "target_workers":      [],
    "manager_instruction": "market intel only",
    "audience":            "credit_committee",
    "post_credit":         "stop",
    "human_gate":          "approve",
    "autonomous":          true,
    "fast":                true,
    "no_web_research":     false,
    "skip_preflight":      false,
    "provider":            "hermes",
    "timeout_sec":         1800,
    "drive_folder_id":     "1Tx9bz4kPq…",
    "notes":               ""
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
  ]
}
```

**Response 201**
```json
{ "run_id": "run_456", "status": "queued", "created_at": "2026-04-28T10:01:22Z" }
```

> `idempotency_key` prevents double-dispatch on network retry. UI generates a UUID on first submit and reuses it on retry. Server returns 200 with original run if key already seen.

---

## `GET /api/runs?status=&limit=&cursor=`
List runs, newest first. Cursor pagination.

---

## `GET /api/runs/:run_id`
Full run status document.

**Response 200**
```json
{
  "run_id":               "run_456",
  "run_name":             "Deal A",
  "status":               "running",
  "route_mode":           "auto",
  "planned_workers":      ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
  "completed_steps":      ["ingestion"],
  "current_agent":        "market_intel",
  "progress_percent":     25,
  "quality_gate_decision":"",
  "last_error":           "",
  "manager_plan": {
    "mode":    "full",
    "workers": ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
    "reason":  "auto-default-full"
  },
  "artifacts_count":  0,
  "created_at":       "2026-04-28T12:00:00Z",
  "updated_at":       "2026-04-28T12:01:00Z"
}
```

---

## `GET /api/runs/:run_id/events` *(Server-Sent Events)*
Live stream — preferred over polling. Falls back gracefully if not supported.

Events emitted:
- `status`   — `{ status }` — queued → running → paused → completed / failed / cancelled
- `progress` — `{ progress_percent, current_agent, eta_sec }`
- `step`     — `{ agent, status }` — running | done | failed per worker
- `log`      — `{ ts, level, msg }` — level: info | tool | ok | warn | err
- `gate`     — `{ quality_gate_decision }` — fired when human gate triggers
- `artifact` — `{ artifact_id, name, kind, download_url }`
- `error`    — `{ last_error }`

---

## `GET /api/runs/:run_id/artifacts`
List output artifacts for a run.

**Response 200**
```json
{
  "artifacts": [
    {
      "artifact_id":  "art_001",
      "run_id":       "run_456",
      "name":         "CC_Memo_Deal_A_20260428.txt",
      "kind":         "credit_memo",
      "mime_type":    "text/plain",
      "size_bytes":   22345,
      "download_url": "/api/artifacts/art_001/download",
      "created_at":   "2026-04-28T12:01:10Z"
    }
  ]
}
```

---

## `GET /api/artifacts/:artifact_id/download`
Stream the artifact file.

---

## `POST /api/control`
Send a control action to the current or a specific run.

**Body**
```json
{
  "action":  "pause",
  "run_id":  "run_456",
  "notify":  true,
  "message": ""
}
```

Actions: `pause` · `resume` · `status` · `cancel_current_run` · `send_latest_report`

---

## `GET /api/health`
Worker + engine readiness check. Used to drive the sidebar status dot.

**Response 200**
```json
{ "ok": true, "provider": "hermes", "ready": true }
```

---

## `GET /api/integrations`
Connection status for all providers (Google Drive, Telegram, etc.). Used by the Integrations screen.

---

## `POST /api/integrations/:provider/connect`
Kicks off OAuth where applicable. Returns `{ redirect_url }`.

---

## `GET /api/me`
Current user. Used for avatar + budget display.

---

## Worker-facing endpoints (internal — laptop → cloud)

### `POST /worker/claim`
Long-poll for next queued run. Holds open up to 25s.
**Body** `{ "worker_id", "version", "tools_available": [] }`
**Response 200** — full run document · **204** — no work

### `POST /worker/runs/:run_id/events`
Worker pushes step/log/progress/status/artifact/gate/error events.
Body: `{ "event": "step", "data": { "agent": "market_intel", "status": "running" } }`

### `POST /worker/runs/:run_id/finish`
**Body** `{ "status": "completed"|"failed", "error": "", "artifacts": [...], "tokens": {}, "cost_usd": 0.42 }`

### `POST /worker/heartbeat`
Every 30s. `{ "worker_id", "provider": "hermes", "ready": true, "current_run_id": "" }`

---

## Errors

```json
{ "error": { "code": "RATE_LIMITED", "message": "…", "retry_after_sec": 120 } }
```

Codes: `UNAUTHENTICATED` · `NOT_FOUND` · `IDEMPOTENT_REPLAY` · `WORKER_OFFLINE` · `BUDGET_EXCEEDED` · `RATE_LIMITED` · `VALIDATION_ERROR`
