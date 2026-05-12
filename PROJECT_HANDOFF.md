# SF Agentic AI Master Handoff

Use this file as the source of truth when resuming work across sessions.

## Project Goal

Build a production-grade, autonomous structured finance analysis system with:

1. File intake from local folder or Google Drive.
2. Automatic worker routing based on file content and/or explicit instruction.
3. Optional full-sequence execution or targeted worker execution.
4. Backend-driven UI integration for upload, status, control, and artifact download.
5. Hermes as the engine/provider layer, not the UI layer.

## Current Product Direction

The system should support two operating modes:

1. Explicit control mode:
   - User/manager tells the system what to do.
   - Example: run full sequence, market intel only, compliance only.

2. Autonomous manager mode:
   - Manager reads the incoming file and infers whether the run needs the full sequence or only selected workers.
   - If instruction text is present, it takes precedence.
   - If no instruction is present, the manager can infer routing from directive text inside the document.

## What Is Already Implemented

### Core pipeline

1. `main.py` supports autonomous runs.
2. Provider preflight exists for LM Studio and Hermes.
3. Hermes transport support exists in the agent base layer.
4. Parallel analysis has timeout protection.
5. Pipeline recursion guard exists.
6. Production check script exists.
7. Tests are in place and passing.

### Autonomous inbox worker

1. Files dropped into the inbox folder are picked up automatically.
2. Files move through:
   - `pending`
   - `processing`
   - `archive`
   - `failed`
3. A control folder exists for ad-hoc commands:
   - `pause`
   - `resume`
   - `status`
   - `cancel_current_run`
   - `send_latest_report`
4. A `REQUEST.json` file can define per-run behavior.
5. Google Drive synced folder support is configured.

### Routing intelligence

1. `route_mode=full` forces the full sequence.
2. `route_mode=targeted` runs selected workers and auto-adds dependencies.
3. `route_mode=auto` lets the manager infer the route from instruction text or document text.
4. The manager plan is recorded in run metadata.

### UI/backend contract

1. A backend contract document exists for Claude UI.
2. The frontend should not call Hermes directly.
3. The backend should expose upload, run, status, artifact, and control endpoints.

## Important Files

1. [CLAUDE_UI_BACKEND_CONTRACT.md](./CLAUDE_UI_BACKEND_CONTRACT.md)
2. [HANDOFF_NEXT.md](./HANDOFF_NEXT.md)
3. [README.md](./README.md)
4. [main.py](./main.py)
5. [workflow/graph.py](./workflow/graph.py)
6. [workflow/supervisor.py](./workflow/supervisor.py)
7. [workflow/state.py](./workflow/state.py)
8. [tools/inbox_worker.py](./tools/inbox_worker.py)
9. [scripts/setup_google_drive_inbox.sh](./scripts/setup_google_drive_inbox.sh)

## Runtime Paths

Current Google Drive inbox structure:

1. Pending: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/pending`
2. Processing: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/processing`
3. Archive: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/archive`
4. Failed: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/failed`
5. Control: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/control`

## Environment Variables

### Core provider

1. `LLM_PROVIDER`
2. `LM_STUDIO_BASE_URL`
3. `LM_STUDIO_MODEL`
4. `HERMES_BASE_URL`
5. `HERMES_MODEL`

### Inbox worker

1. `SF_INBOX_DIR`
2. `SF_PROCESSING_DIR`
3. `SF_ARCHIVE_DIR`
4. `SF_FAILED_DIR`
5. `SF_CONTROL_DIR`
6. `SF_TRIGGER_MODE`
7. `SF_TRIGGER_FILE`
8. `SF_POLL_SEC`
9. `SF_INBOX_MAX_FILES`
10. `SF_PROVIDER`
11. `SF_POST_CREDIT_MODE`
12. `SF_HUMAN_GATE`
13. `SF_ROUTE_MODE`
14. `SF_FORCE_AUTONOMOUS`
15. `SF_FORCE_FAST`
16. `SF_SKIP_PREFLIGHT`
17. `SF_RUN_TIMEOUT_SEC`
18. `SF_NO_WEB_RESEARCH`
19. `SF_NOTIFY_CHANNEL`
20. `SF_NOTIFY_TARGET`

### Routing overrides

1. `SF_INTENT`
2. `SF_AUDIENCE`

## Request Contract

### `REQUEST.json`

Place this in the inbox folder to control the next run.

```json
{
  "intent": "memo_only",
  "route_mode": "auto",
  "manager_instruction": "market intel only",
  "workers": ["market_intel"],
  "post_credit": "stop",
  "human_gate": "approve",
  "audience": "credit_committee",
  "fast": true,
  "autonomous": true,
  "skip_preflight": false,
  "no_web_research": true,
  "timeout_sec": 1800
}
```

### Routing behavior

1. `route_mode=full`
   - Run the full sequence.

2. `route_mode=targeted`
   - Run only requested workers.
   - Dependencies are auto-added.

3. `route_mode=auto`
   - Use `manager_instruction` if provided.
   - Otherwise inspect directive text in the document.
   - Otherwise default to full sequence.

## Backend/UI Contract

The frontend should bind to backend endpoints, not the engine directly.

### Required API endpoints

1. `POST /api/files`
2. `POST /api/runs`
3. `GET /api/runs/:run_id`
4. `GET /api/runs/:run_id/artifacts`
5. `POST /api/control`
6. `GET /api/health`

### UI placeholders

1. Upload panel.
2. Google Drive attach panel.
3. Run configuration form.
4. Worker multi-select for targeted routes.
5. Manager instruction input for auto routes.
6. Run progress/timeline.
7. Artifact download table.
8. Control buttons for run management.

## JSON Schemas

See [CLAUDE_UI_BACKEND_CONTRACT.md](./CLAUDE_UI_BACKEND_CONTRACT.md) for the full schema definitions.

## Validation Status

Last verified:

1. Python compile checks passed.
2. Test suite passed.
3. Inbox worker control commands were verified in foreground mode.
4. Google Drive folder structure was created and wired into `.env`.

## Known Runtime Caveats

1. Launchd/background service handling was unreliable in this workspace because of path and permissions issues with the `Documents/...Claude Projects...` location.
2. Foreground/launch-from-shell worker flow is verified.
3. Background worker behavior should be rechecked after any path, permission, or shell profile changes.

## Open Work

1. Finish the Claude UI frontend against the backend contract.
2. Build the backend API layer that serves the frontend and bridges to the current engine.
3. Add persistent run tracking and artifact indexing if the UI needs a run history page.
4. Decide whether Google Drive should be:
   - just a synced source folder, or
   - a true API-connected picker inside the UI.
5. Tighten the manager inference rules if more document types need explicit routing.

## Resume Commands

1. Read this file first.
2. Read [CLAUDE_UI_BACKEND_CONTRACT.md](./CLAUDE_UI_BACKEND_CONTRACT.md).
3. Check current status:
   - `./scripts/inbox_worker_status.sh`
4. Verify tests:
   - `./.venv/bin/pytest -q`
5. Verify compile:
   - `python3 -m py_compile main.py workflow/*.py tools/*.py agents/*.py prompts/*.py config.py`

## Working Rule

Do not drift into new architecture unless it is needed to complete the current objective. Keep the frontend contract, inbox automation, and engine routing aligned.

