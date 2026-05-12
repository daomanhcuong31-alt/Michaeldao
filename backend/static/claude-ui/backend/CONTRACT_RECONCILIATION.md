# Contract Reconciliation — SF Agentic AI UI ↔ Backend

**Comparing:** `CLAUDE_UI_BACKEND_CONTRACT.md` (your backend team's spec) vs `backend/API.md` (UI scaffold)
**Date:** 2026-04-28
**Verdict:** Reconcilable. 7 concrete gaps — none are blockers, but 3 must be fixed before wiring.

---

## Gap Summary

| # | Area | Severity | What the backend contract says | What the UI scaffold says | Fix |
|---|------|----------|-------------------------------|--------------------------|-----|
| 1 | **Naming** | 🔴 MUST fix | `run`, `run_id`, `/api/runs` | `job`, `id`, `/jobs` | Rename UI scaffold → use `run` terminology |
| 2 | **File upload pattern** | 🔴 MUST fix | `POST /api/files` (multipart, server receives) | `POST /uploads/sign` (presigned PUT, client uploads direct to S3) | Adopt backend's multipart pattern |
| 3 | **RunConfig schema** | 🔴 MUST fix | Domain-specific fields: `intent`, `route_mode`, `target_workers`, `audience`, `post_credit`, `human_gate`, `autonomous`, `fast`, `no_web_research`, `skip_preflight`, `provider` | Generic: `task_type`, `planner`, `max_steps`, `pause_for_review`, `tools_allowed` | Adopt backend's RunConfig fully; our generic fields don't exist in their engine |
| 4 | **RunStatus shape** | 🔴 MUST fix | `planned_workers[]`, `completed_steps[]`, `current_agent`, `quality_gate_decision`, `last_error`, `manager_plan`, `artifacts_count` | `steps[]` with index/title/detail, `log[]` | Adopt backend's shape; update Active Job + Job Detail screens |
| 5 | **Control endpoint** | 🟡 Should fix | `POST /api/control` with actions: pause, resume, cancel_current_run, send_latest_report | Separate `/jobs/:id/cancel` and `/jobs/:id/approve` — missing resume, send_latest_report | Add unified `/api/control` endpoint; keep cancel/approve as aliases |
| 6 | **URL prefix** | 🟡 Should fix | All routes under `/api/` | No prefix | Add `/api/` prefix in api-client.js |
| 7 | **SSE vs polling** | 🟢 Nice to have | Not mentioned — GET /api/runs/:id implies polling | SSE stream on `/jobs/:id/events` | SSE is strictly better UX. Add it to backend contract; polling is fallback |
| — | **Health endpoint** | 🟢 Good, add | `GET /api/health → { ok, provider, ready }` | Missing | Add to our spec |
| — | **Idempotency key** | 🟡 Should add | Not mentioned | Required in `POST /jobs` | Add to `POST /api/runs` — prevents double-dispatch |
| — | **Artifact kinds** | 🟢 Matches intent | `credit_memo \| metadata \| post_credit \| log \| other` | Generic PPTX/XLSX labels | UI displays `kind` as-is — no code change needed |
| — | **`drive_folder_id`** | 🟢 Minor | Just the Drive folder ID string | Full URL in `drive_link` | Backend contract is cleaner — use ID, resolve URL server-side |

---

## The 3 that matter most (fix before wiring)

### Gap 1 — Rename: `job` → `run`

Every UI file uses `job`/`JOB-1042`/`/jobs`. Backend uses `run`/`run_456`/`/api/runs`.

**Fix in `api-client.js`:** change base paths. UI component props can stay as `job` internally — just rename the API layer.

```js
// BEFORE
const createJob  = (p) => req("POST", "/jobs", p)
// AFTER
const createRun  = (p) => req("POST", "/api/runs", p)
```

---

### Gap 3 — RunConfig (this is the biggest one)

The New Job screen currently sends:
```json
{ "task_type": "ppt", "prompt": "...", "config": { "planner": "claude-sonnet-4.5" } }
```

Backend expects:
```json
{
  "config": {
    "intent": "memo_only",
    "route_mode": "auto",
    "target_workers": [],
    "manager_instruction": "...",
    "audience": "credit_committee",
    "post_credit": "ask",
    "human_gate": "approve",
    "autonomous": true,
    "fast": true,
    "no_web_research": false,
    "skip_preflight": false,
    "provider": "hermes",
    "timeout_sec": 1800,
    "drive_folder_id": ""
  }
}
```

**UI changes needed:**
- Replace `task_type` chip selector with `intent` selector
- Add `route_mode` toggle (auto / full / targeted)
- Show `target_workers` multi-select ONLY when `route_mode = targeted`
- Show `manager_instruction` textarea ONLY when `route_mode = auto`
- Add `audience` dropdown
- Add `post_credit` and `human_gate` selectors
- Add `provider` toggle (hermes / lm_studio) — useful for testing

---

### Gap 4 — RunStatus shape

The Active Job screen currently reads `steps[]` like:
```js
{ t: "Generating slides", sub: "8 of 14", ts: "00:02:55", running: true }
```

Backend returns:
```json
{
  "planned_workers":  ["ingestion", "market_intel", "analysis_parallel", "memo_architect"],
  "completed_steps":  ["ingestion"],
  "current_agent":    "market_intel",
  "progress_percent": 25,
  "quality_gate_decision": "",
  "last_error":       "",
  "manager_plan":     { "mode": "full", "workers": [...], "reason": "auto-default-full" }
}
```

**UI changes needed:**
- Step trace → render `planned_workers[]` as the steps list
- Highlight `current_agent` as the "running" step
- Mark `completed_steps[]` as done
- Show `quality_gate_decision` badge when non-empty
- Show `last_error` in a red alert box when non-empty
- Show `manager_plan.reason` as a sub-label under the run name

---

## What's already aligned ✅

- Auth pattern (bearer token) — identical
- Artifact download via URL — identical intent
- Control actions (pause/cancel) — our `/jobs/:id/cancel` maps cleanly to `cancel_current_run`
- File sources: upload, google_drive, local_path — matches
- Notification/output config — complementary (our Telegram fields are additive)
- Worker heartbeat — not in their spec, but additive (no conflict)
- SSE — not in their spec, but additive (no conflict; polling still works as fallback)

---

## Reconciled endpoint map

| Action | Backend contract | Our scaffold → reconciled to |
|--------|-----------------|------------------------------|
| Upload file | `POST /api/files` | `POST /api/files` ✅ adopt |
| Create run | `POST /api/runs` | `POST /api/runs` ✅ adopt |
| Get status | `GET /api/runs/:id` | `GET /api/runs/:id` ✅ adopt |
| Live stream | *(not specified)* | `GET /api/runs/:id/events` ✅ add to their spec |
| List artifacts | `GET /api/runs/:id/artifacts` | `GET /api/runs/:id/artifacts` ✅ adopt |
| Download artifact | `/api/artifacts/:id/download` | `/api/artifacts/:id/download` ✅ adopt |
| Control | `POST /api/control` | `POST /api/control` ✅ adopt |
| Health | `GET /api/health` | `GET /api/health` ✅ add |
| Integrations | *(not specified)* | `GET /api/integrations` ✅ keep |
| Worker claim | *(internal)* | `POST /worker/claim` ✅ keep |
| Worker events | *(internal)* | `POST /worker/runs/:id/events` ✅ keep |
| Worker finish | *(internal)* | `POST /worker/runs/:id/finish` ✅ keep |
| Worker heartbeat | *(not specified)* | `POST /worker/heartbeat` ✅ keep |

---

## Recommended action plan

**You do (UI side — takes ~2h):**
1. Update `api-client.js` — rename paths to `/api/runs`, `/api/files`, etc.
2. Update `screens/new-job.jsx` — swap task_type chips for intent + route_mode + conditional fields
3. Update `screens/active-job.jsx` — render `planned_workers` + `current_agent` instead of `steps[]`
4. Update `data.jsx` — update mock shapes to match RunStatus/RunConfig schemas

**Coding model does (backend side):**
1. Implement all endpoints in `API.md` (reconciled version below)
2. Map `RunConfig` → Hermes engine contract
3. Implement `POST /api/files` multipart handler
4. Add SSE fan-out on `GET /api/runs/:id/events`
5. Implement `POST /api/control` unified endpoint

**Do together (contract):**
- Add `idempotency_key` to `POST /api/runs` (10 min discussion)
- Confirm `drive_folder_id` format (folder ID only vs full URL)

---

## Files to update in this project

1. `backend/API.md` → reconciled version (see below)
2. `backend/openapi.yaml` → add RunConfig, RunStatus, FileReference schemas
3. `backend/mock-server.js` → update routes to `/api/*`, update shapes
4. `backend/api-client.js` → update paths + payload builders
5. `screens/new-job.jsx` → intent + route_mode UI
6. `screens/active-job.jsx` → planned_workers + current_agent rendering
