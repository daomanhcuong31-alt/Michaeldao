# SF Agentic AI

Phase 2 architecture hardening introduces channel-agnostic intent routing, explicit audience templates, a mandatory human gate, and deterministic controller rubric logic.

## New Intents

- `memo_only` (default when unclear)
- `memo_plus_distribution`
- `memo_plus_holdbook`
- `full_e2e`

Intent is routed via `workflow/intent_router.py` and can be called from CLI now, with reusable normalization for future channel inputs.

## Audience Selection

Supported audience templates:
- `credit_committee`
- `ceo`
- `chief_cibg`
- `external_client`

Selection is explicit with `--audience` and persisted in memo metadata (`*.metadata.json`) under `audience`, `audience_template_key`, and `audience_profile_selected`.

## Mandatory Human Gate

After memo generation and senior advisor review, a mandatory gate decision is required:
- `approve`
- `revise` (one controlled revision pass only)
- `stop`

`stop` terminates cleanly; memo + metadata artifacts remain saved in `data/output`.

For non-interactive operations, use `--autonomous` to:
- auto-approve when gate input is not explicitly provided,
- avoid interactive prompts,
- continue post-credit planning even when advisor decision is `ESCALATE_TO_HUMAN` (recorded in metadata as `autonomous_override_escalation=true`).

## Post-Credit Branching

Branching runs only after gate approval:
- Distribution path: investor suitability + distribution advisory, with Perplexity research if enabled.
- Holdbook path: operations implementation plan only.
- Full E2E (`hybrid`): both paths with sequencing and status logging.

## Controller Rubric

Senior advisor now applies deterministic dimensions:
- factual coherence
- legal consistency
- financial completeness
- audience-fit
- actionability

Decision thresholds:
- `APPROVE`: all dimensions `>= 7` and total `>= 38`
- `REVISE`: all dimensions `>= 5` and total `>= 28`
- `ESCALATE_TO_HUMAN`: otherwise

Output metadata includes concise rationale under `controller_decision_why`.

## Quick Run Examples

```bash
python3 main.py --sample --intent memo_only --audience credit_committee --post-credit stop
python3 main.py --sample --intent memo_plus_distribution --audience ceo --post-credit distribution
python3 main.py --sample --intent memo_plus_holdbook --audience chief_cibg --post-credit holdbook
python3 main.py --sample --intent full_e2e --audience credit_committee --post-credit hybrid
```

## Backend API (UI Bridge)

Backend bridge is available for frontend integration and keeps `main.py` as the execution engine.

Start backend:

```bash
./run_backend.sh
```

One-click local startup (recommended):

```bash
./open_ui.command
```

Optional helper launchers:

```bash
./status_ui.command
./stop_ui.command
```

This starts backend in background (if not running) and opens the UI automatically.
Important: run that command from the project folder (`sf-agentic-ai`). If you are in another directory, use the absolute path to this repo's `open_ui.command`.
Startup now auto-repairs stale backend listeners: if an older process is serving `/api/health` but missing `/api/ui-config`, it force-restarts to the current backend build.
Local stack helpers:
- `./scripts/local_ui_stack_status.sh`
- `./scripts/stop_local_ui_stack.sh`

Or:

```bash
uvicorn backend.api:app --host 127.0.0.1 --port 8000
```

Required endpoints:
- `POST /api/files`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/logs`
- `GET /api/runs/{run_id}/artifacts`
- `POST /api/control`
- `GET /api/health`
- `GET /api/system/worker/status`
- `POST /api/system/worker/start`
- `POST /api/system/worker/stop`

Full request/response schemas:
- `CLAUDE_UI_BACKEND_CONTRACT.md`
- Deployment guide: `DEPLOYMENT.md`
- Cloud Run helper script: `scripts/deploy_cloud_run.sh`

Built-in UI:
- Open `http://127.0.0.1:8000/` after starting backend.
- UI supports upload, run config, run history, live status/log tail, artifact download, and control actions.
- Default route now serves the integrated Claude Design dashboard (`/static/claude-ui/index.html`).
- Supported upload types: `pdf, txt, md, csv, tsv, json, doc/docx, ppt/pptx, xls/xlsx, png, jpg, jpeg`.
- Integrations page now saves/tests local config (Google Drive, Telegram, standing instruction, knowledge notes).
- Run detail supports `Re-run` with same inputs + config.

Optional macOS app launcher generation:

```bash
./scripts/create_macos_launcher_app.sh
```

Generated app path:
- `dist/SF Agentic AI Launcher.app`

CORS for separate frontend host:
- `SF_UI_ORIGINS=http://localhost:3000,https://your-domain`

Optional API guard:
- Set `SF_API_KEY=<strong-random-value>` to require `X-SF-API-KEY` on all `/api/*` calls.
- Built-in UI has an API key field in the header.

Optional explicit gate control:

```bash
python3 main.py --sample --human-gate approve --post-credit distribution
python3 main.py --sample --human-gate revise --post-credit stop
python3 main.py --sample --human-gate stop --post-credit stop
```

## Operator Fast Path (Fail-Fast)

Use the local runner script for the shortest reliable loop:

```bash
./run_sf.sh stop
./run_sf.sh distribution
./run_sf.sh holdbook
./run_sf.sh hybrid
```

Runner behavior:
- Checks LM Studio `/v1/models` (max 3 retries, fail-fast on unreachable endpoint).
- Activates `.venv`.
- Runs `python3 main.py --sample --post-credit <mode> --human-gate approve --autonomous`.
- Prints latest artifacts from `data/output`.

Hermes gateway fast path:

```bash
./run_hermes.sh stop
./run_hermes.sh distribution
./run_hermes.sh holdbook
```

Runner behavior:
- Loads `.env` if present.
- Checks Hermes `/health` (max 3 retries, fail-fast on unreachable endpoint).
- Sets `LLM_PROVIDER=hermes`.
- Runs `python3 main.py --sample --post-credit <mode> --human-gate approve --autonomous`.

Fast mode (short latency profile):

```bash
python3 main.py --sample --post-credit stop --human-gate approve --fast
```

Fast mode reduces token budgets/timeouts and trims non-critical elaboration while preserving memo/post-credit artifact flow.

Mode meaning:
- `stop`: generate memo + metadata only; no post-credit stage.
- `distribution`: run memo, then distribution advisory path.
- `holdbook`: run memo, then holdbook operations path.

## Preflight Health Check

`main.py` now runs a lightweight preflight by default before pipeline execution:
- validates configured provider endpoint format.
- `lm_studio`: checks `/v1/models` reachability and warns if configured model ID is not listed.
- `hermes`: checks `/health` reachability and defers model validation to Hermes infer runtime.

To bypass this check (not recommended for local ops):

```bash
python3 main.py --sample --skip-preflight
```

## Autonomous CLI Mode

Use for unattended runs:

```bash
python3 main.py --sample --intent full_e2e --post-credit hybrid --autonomous --fast
```

Behavior:
- no interactive input prompts,
- gate defaults to approve when not explicitly set,
- escalation confirmation prompt is skipped (autonomous override proceeds with warning + metadata marker).

## Production Validation

Run the production check harness before release:

```bash
./scripts/production_check.sh stop
```

What it runs:
- compile checks (`py_compile`),
- unit tests (`pytest -q`),
- shell validation (`bash -n`),
- autonomous runtime smoke test.

Optional:
- `RUN_RUNTIME=1 ./scripts/production_check.sh stop` to include live runtime smoke.

## Timeout and Guardrail Environment Variables

- Global:
  - `LLM_TIMEOUT_SEC` (default `60`)
  - `LLM_MAX_TOKENS` (default `4096`)
- Market intelligence hard timeout override:
  - `MARKET_INTEL_TIMEOUT_SEC` (default inherits global)
- Per-agent overrides:
  - `<AGENT>_TIMEOUT_SEC` and `<AGENT>_MAX_TOKENS`
  - Examples: `MARKET_INTEL_MAX_TOKENS`, `COMPLIANCE_TIMEOUT_SEC`
- Fast mode clamps:
  - `FAST_LLM_TIMEOUT_SEC` (default `35`, or `55` when `LLM_PROVIDER=hermes`)
  - `FAST_LLM_MAX_TOKENS` (default `900`)
- Pipeline execution guard:
  - `PIPELINE_RECURSION_LIMIT` (default `40`) to prevent runaway routing loops.

## Quick Troubleshooting (LM Studio Down)

If runner exits with LM Studio unreachable:
1. Open LM Studio and start local server on the configured host/port.
2. Confirm model service responds: `curl http://127.0.0.1:1234/v1/models`.
3. Confirm `.env` alignment:
   - `LM_STUDIO_BASE_URL=http://127.0.0.1:1234/v1`
   - `LM_STUDIO_MODEL=<your-loaded-model-id-or-alias>`
4. Re-run `./run_sf.sh <mode>`.

## Hermes Workflow

Use this when model access is routed through Hermes gateway rather than direct LM Studio.

1. Ensure gateway is running and model is configured in Hermes model registry.
2. In `.env`:
   - `LLM_PROVIDER=hermes`
   - `HERMES_BASE_URL=http://127.0.0.1:18789`
   - `HERMES_MODEL=lmstudio/qwen/qwen3.5-9b` (or your configured `provider/model`)
3. Validate endpoint:
   - `curl http://127.0.0.1:18789/health`
   - Optional model sanity: `hermes models status --json`
4. Run:
   - `./run_hermes.sh stop` (or `distribution|holdbook|hybrid`)

## Zero-Touch Folder Automation (Recommended)

If you do not want to run per-file terminal commands, use the inbox worker.
You drop files into a folder (local folder or Google Drive synced folder), and worker runs automatically.

Setup once:

1. Configure `.env` inbox paths (`SF_INBOX_DIR` etc.).  
   Example Google Drive local sync path:
   - `SF_INBOX_DIR=~/Library/CloudStorage/GoogleDrive-<your-account>/My Drive/SF Inbox`
   - Quick auto-setup for Google Drive:
     - `./scripts/setup_google_drive_inbox.sh`
     - Or custom base folder:
       - `./scripts/setup_google_drive_inbox.sh "$HOME/My Drive/SF Agentic Inbox"`
2. Install background service:
   - `./scripts/install_inbox_worker_launchd.sh`
3. Check status/logs:
   - `./scripts/inbox_worker_status.sh`
4. If `launchd` is blocked by macOS permissions (common when project is in `Documents`), use shell background mode instead:
   - `./scripts/start_inbox_worker_background.sh`
   - stop: `./scripts/stop_inbox_worker_background.sh`

Daily use:
- Drop files into `SF_INBOX_DIR`.
- Worker picks them up automatically (`SF_TRIGGER_MODE=auto`).
- Processed files move to `SF_ARCHIVE_DIR`.
- Failed files move to `SF_FAILED_DIR` with logs.
- Control commands go to `SF_CONTROL_DIR`.

Per-run instruction file (optional):
- Put `REQUEST.json` in `SF_INBOX_DIR` before/with files.
- Worker applies it to the next run and archives it with that run.
- Example:

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
  "no_web_research": true
}
```

Routing behavior:
- `route_mode=full` -> full sequence (`ingestion -> market_intel -> analysis_parallel -> memo_architect`).
- `route_mode=targeted` + `workers` -> run only requested workers with required dependencies auto-added.
- `route_mode=auto` -> manager infers route from `manager_instruction`/`instruction` text.

Ad-hoc control commands (no file upload required):
- Drop a JSON file into `SF_CONTROL_DIR` with one of these actions:
  - `pause`
  - `resume`
  - `status`
  - `cancel_current_run`
  - `send_latest_report`
- Example:

```json
{ "action": "send_latest_report", "notify": true }
```

- Processed commands are moved to:
  - `SF_CONTROL_DIR/processed`
  - `SF_CONTROL_DIR/failed`

Controls:
- Stop service: `./scripts/inbox_worker_stop.sh`
- Foreground run (debug): `./run_inbox_worker.sh`
- Single batch run (debug): `./run_inbox_worker.sh --once`
- Background mode logs:
  - `data/inbox/worker.bg.stdout.log`
  - `data/inbox/worker.bg.stderr.log`

Optional notification back to your chat:
- Set `SF_NOTIFY_CHANNEL` and `SF_NOTIFY_TARGET` in `.env`.
- Worker sends start/success/failure status via `hermes message send`.

## Expected Artifacts

Generated under `data/output`:
- `CC_Memo_<borrower>_<timestamp>.txt`
- `CC_Memo_<borrower>_<timestamp>.metadata.json`
- Post-credit (when mode is `distribution` or `holdbook`):
  - `PostCredit_<borrower>_<timestamp>.json`
  - `PostCredit_<borrower>_<timestamp>.md`


## Hermes Agent Workflow (recommended)

Run the full Hermes-first workflow with QA gates + autonomous UAT:

```bash
./scripts/agent_workflow.sh hermes stop 0
```

Arguments:
- arg1 provider: `hermes` (or `lm_studio`)
- arg2 post-credit mode: `stop|distribution|holdbook|hybrid`
- arg3 max UAT cases: `0` means run all

Fast sanity run (1 case only):

```bash
./scripts/agent_workflow.sh hermes stop 1
```

Standalone UAT runner:

```bash
./.venv/bin/python scripts/run_uat.py --provider hermes --mode stop --max-cases 5
```

Outputs:
- UAT checkpoints in `data/checkpoints/`
- latest symlink: `data/checkpoints/LATEST_CHECKPOINT.md`
