# Claude Design Update Brief (SF Agentic AI Local UI)

## Goal
Improve local operator UX for one-person use:
- faster access
- fewer clicks
- clear output format control
- inline artifact preview

## Backend Contract Already Live
Use these endpoints (all implemented in local backend):
- `GET /api/ui-config`
- `PUT /api/ui-config`
- `POST /api/runs`
- `POST /api/runs/{run_id}/rerun`
- `GET /api/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/logs`
- `GET /api/runs/{run_id}/artifacts`
- `GET /api/artifacts/{run_id}/{filename}`
- `GET /api/artifacts/{run_id}/{filename}/preview`

## New Run Payload Keys To Support
- `output_formats: string[]` where each item is one of:
  - `txt`
  - `docx`
  - `xlsx`
  - `pdf`
  - `pptx`

## UX Requirements For Next UI Pass
1. New Run should be single-screen in "Simple" mode.
2. Keep only essential controls visible by default:
   - intent
   - upload/drop input
   - optional instruction
   - output format chips
   - dispatch
3. Advanced controls should be collapsible (not separate screens).
4. Queue rows should open run detail in one click.
5. Artifact preview should be one click from:
   - dashboard recent artifacts
   - run detail artifact list
6. Remove/disable any connector actions that are not implemented yet.
7. Keep status polling lightweight (avoid overlapping requests).

## Preview Rendering Rules
Use `/preview` endpoint response:
- `kind`: `text | table | unsupported`
- `content`: render in readable monospaced block
- `truncated`: if true, show "preview truncated"

## Known Runtime Constraint
- `pptx` export depends on `python-pptx` package.
- If not installed, backend returns export warning artifact; UI should show it as a normal artifact.

## Visual/Interaction Direction
- Keep current visual style.
- Prioritize information density and speed over decorative interactions.
- Avoid dead clicks and hidden primary actions.
