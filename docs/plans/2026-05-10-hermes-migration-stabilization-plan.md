# SF Agentic AI Hermes Migration Stabilization Plan

Goal
- Move the project from Hermes-first runtime to reliable Hermes/local runtime, with repeatable checks and clear fallback.

Current baseline (validated)
- Hermes gateway health: OK.
- Hermes gateway health: FAIL (connection refused on 127.0.0.1:18000).
- Focused regression tests: 17 passed (with `PYTHONPATH=.`).
- Repo has many uncommitted changes (including runtime/data artifacts and code).

## Phase 1 — Freeze and clean working baseline
1) Create a safety branch from current state.
2) Separate code/config changes from runtime artifacts (`data/api/*`, logs, pid files).
3) Update `.gitignore` to exclude volatile local runtime files if missing.
4) Commit a clean “post-migration baseline” snapshot.

Success criteria
- `git status` only shows intentional files.
- Clean commit history for migration work.

## Phase 2 — Make provider selection deterministic
1) Keep one canonical variable for runtime provider: `LLM_PROVIDER`.
2) Align `SF_PROVIDER` usage in worker/backend wrappers to default to `LLM_PROVIDER` unless explicitly overridden.
3) Add startup print/log line in `main.py` and backend run launch showing:
- provider
- base_url
- model
4) Normalize run scripts:
- `run_sf.sh` => `LLM_PROVIDER=lm_studio`
- `run_hermes.sh` => `LLM_PROVIDER=hermes`
- add `run_hermes.sh` => `LLM_PROVIDER=hermes`

Success criteria
- No ambiguity about which provider is active per run.
- All three scripts execute the same argument contract.

## Phase 3 — Repair Hermes path (root cause: gateway not running)
1) Confirm Hermes service process and bound port (expected 18000).
2) If different port/base path, update `.env`:
- `HERMES_BASE_URL`
- `HERMES_MODEL`
3) Re-run diagnostics:
- `./.venv/bin/python diagnose_gateways.py`
4) Run end-to-end sample via Hermes:
- `LLM_PROVIDER=hermes python3 main.py --sample --post-credit stop --human-gate approve --autonomous`

Success criteria
- Hermes preflight passes.
- Sample run produces non-empty artifact in `data/output`.

## Phase 4 — Verify cloud/Ollama strategy explicitly
1) Decide supported production providers now:
- local only (lm_studio/hermes)
- or include cloud fallback.
2) If Ollama is needed, add explicit OpenAI-compatible config path and healthcheck branch (if not already).
3) Document non-goals (e.g., Hermes cloud mode currently unstable) to avoid repeated trial/error.

Success criteria
- One documented “blessed” runtime path.
- Optional secondary fallback path with clear trigger rules.

## Phase 5 — UAT and operational hardening
1) Run backend/UI smoke (`status_ui.command`, open UI, run sample job, rerun, artifact download).
2) Run inbox-worker smoke with `REQUEST.json` using provider override and without override.
3) Verify scheduling/control commands still work.
4) Capture evidence in a dated UAT note.

Success criteria
- End-to-end flows pass for UI + worker.
- Versioned artifacts and logs remain consistent.

## Phase 6 — Documentation and handoff refresh
1) Update `README.md`, `SETUP_GUIDE.md`, `HANDOFF_NEXT.md` to reflect Hermes-first or dual-provider reality.
2) Add a short “Provider Quick Matrix” table:
- provider
- base URL
- health endpoint
- run script
- known caveats
3) Add a one-command preflight script for operators.

Success criteria
- New session can start from docs only, no tribal context.

## Immediate next execution order (tomorrow)
1) Branch + clean working tree.
2) Add deterministic provider logs and `run_hermes.sh`.
3) Start Hermes gateway and pass diagnostics.
4) Run Hermes sample and UI smoke.
5) Update docs and commit.

## Commands reference
- Diagnostics:
- `PYTHONPYCACHEPREFIX=/tmp/pycache ./.venv/bin/python diagnose_gateways.py`
- Tests:
- `PYTHONPATH=. PYTHONPYCACHEPREFIX=/tmp/pycache ./.venv/bin/pytest -q tests/test_healthcheck.py tests/test_intent_router.py tests/test_parallel_analysis.py tests/test_supervisor_routing.py`
- Hermes run:
- `./run_hermes.sh stop`
- Hermes run (after gateway up):
- `LLM_PROVIDER=hermes python3 main.py --sample --post-credit stop --human-gate approve --autonomous`
