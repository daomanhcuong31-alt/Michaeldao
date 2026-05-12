# Next Session Handoff

Start with `HANDOFF_20260430.md`, especially `Resume Update - 2026-04-30 12:38 +08`.

Immediate resume steps:
1. Run `./status_ui.command`.
2. If backend is down, run `./open_full_stack.command` from Finder/Terminal.
3. Confirm LM Studio local server is running on `http://localhost:1234/v1` with model `qwen/qwen3.5-9b`.
4. Hard refresh Chrome with `Cmd+Shift+R` if the browser still loads old `20260430_0030` assets.
5. Run real-file UAT through the UI: upload/paste source, choose output format, run, preview, download, rerun, and verify the Job Detail `Version history` panel.

Current priority: real business UAT and remaining usability polish, not basic render fixes. Settings has already been redesigned into logical sections, and primary routes plus Job Detail passed browser route smoke.

## Resume Update - 2026-04-30 Non-Credit UAT Hardening

Implemented after autonomous UAT review:
- Non-credit work products are now first-class runtime intents: `analysis_brief`, `ops_sop`, `meeting_minutes`, `pipeline_report`, `market_intel`, `data_analysis`.
- Backend request handling now normalizes output family from report profile/template/intent and passes it to `main.py` as structured CLI args, not only manager-note text.
- Supervisor routing now avoids full credit-memo pipeline for SOP/minutes/pipeline/data/market-intel outputs. `admin_ops` maps to ingestion + output writer; `data_analyst` maps to ingestion + analysis + output writer.
- Memo Architect now behaves as a generic Output Architect. It writes/falls back to SOP, meeting minutes, pipeline report, data analysis, market intel, or credit memo based on output family.
- Output filenames and artifact kinds are now family-aware: e.g. `SOP_*` => `sop`, `MeetingMinutes_*` => `meeting_minutes`, no forced `CC_Memo_*` for non-credit runs.
- Version labels now default to `v1` instead of `v1.0`; reruns still bump to `v1.1`, `v1.2`, etc.
- Non-credit local runs avoid credit-style revision loops. They use one bounded writer attempt, deterministic fallback if LM Studio times out, and deterministic local QA instead of Senior Advisor LLM retries.
- UI report profiles now map to matching intents; selecting SOP/minutes/pipeline changes dispatch intent and report family.

Validation completed:
- `py_compile` passed for patched backend/main/workflow/agent files.
- `pytest tests/test_intent_router.py tests/test_supervisor_routing.py tests/test_main_output_guard.py tests/test_backend_api.py` => `26 passed`.
- Live API UAT meeting-minutes run produced `MeetingMinutes_NOT PROVIDED_20260430_204255.txt`, artifact kind `meeting_minutes`, version `v1`.
- Live API UAT SOP run produced `SOP_NOT PROVIDED_20260430_210517.txt`, artifact kind `sop`, version `v1`.
- Headless Chrome render smoke loaded UI build `20260430_1845` and showed SOP / Meeting minutes / Pipeline report labels without a rendered screen error.

Known remaining UAT items:
- Local Qwen/LM Studio still timed out on short non-credit prompts in the live smoke. Fallback output is now correct family, but prose quality depends on LM Studio responsiveness/model choice.
- Ingestion still uses structured-finance extraction terms; for mature production, create family-specific extraction schemas for SOP/minutes/pipeline/data instead of borrower/facility fields.
- Dashboard still shows historical old `CC_Memo_*` artifacts from prior tests. New artifacts are family-aware, but old history is not migrated.
- Background `nohup` backend launched from this sandbox may be cleaned up after command exit. If backend is down in a new terminal, run `./open_full_stack.command` or `./open_ui.command` from Terminal/Finder.
