# Release Notes — Hermes Migration Stabilization (2026-05-10)

## Summary
This checkpoint finalizes migration from OpenClaw-oriented naming/runtime to Hermes-first workflow in sf-agentic-ai.

## Key changes
- Rebranded project references from OpenClaw -> Hermes in tracked source/docs/config.
- Canonicalized runtime script to `run_hermes.sh` and removed legacy `run_openclaw.sh`.
- Renamed base provider test to `tests/test_base_hermes.py` and removed OpenClaw-named test file.
- Fixed `workflow/parallel_analysis.py` fallback behavior when manager worker plan is empty.
- Rebuilt `diagnose_gateways.py` and aligned provider diagnostics messaging to Hermes-first flow.
- Updated env templates and docs for Hermes provider defaults and runbook paths.

## QA gates run
- Shell syntax: pass
- Targeted pytest suite: pass (15 tests)
- Gateway diagnostics: LM Studio reachable; Hermes endpoint requires runtime service exposure on configured health path.

## Operational note
Hermes gateway and backend may contend for the same local port in some launch modes. Use explicit start/stop sequencing per runbook when switching runtime modes.
