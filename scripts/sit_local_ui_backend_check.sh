#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
BASE_URL="${BASE_URL:-http://$HOST:$PORT}"
EVIDENCE_DIR="${EVIDENCE_DIR:-data/local/sit}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$EVIDENCE_DIR/$STAMP"
SIT_WAIT_SECONDS="${SIT_WAIT_SECONDS:-180}"

mkdir -p "$OUT_DIR"

failures=0

say() {
  printf '%s\n' "$*"
}

record_fail() {
  failures=$((failures + 1))
  say "FAIL $*"
}

record_pass() {
  say "PASS $*"
}

http_get() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl --noproxy "*" -s -o "$out" -w "%{http_code}" "$BASE_URL$path" || true)"
  printf '%s' "$code"
}

http_post_json() {
  local path="$1"
  local body="$2"
  local out="$3"
  local code
  code="$(curl --noproxy "*" -s -o "$out" -w "%{http_code}" \
    -H "content-type: application/json" \
    -d "$body" \
    "$BASE_URL$path" || true)"
  printf '%s' "$code"
}

run_status() {
  local file="$1"
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status", ""))' "$file"
}

wait_run_terminal() {
  local run_id="$1"
  local out="$2"
  local deadline=$((SECONDS + SIT_WAIT_SECONDS))
  local code status
  while (( SECONDS <= deadline )); do
    code="$(http_get "/api/runs/$run_id" "$out")"
    if [[ "$code" != "200" ]]; then
      sleep 2
      continue
    fi
    status="$(run_status "$out")"
    case "$status" in
      succeeded|completed|failed|cancelled)
        return 0
        ;;
    esac
    sleep 2
  done
  return 1
}

json_check() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json
import sys

path, expr = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
safe_names = {
    "data": data,
    "any": any,
    "all": all,
    "bool": bool,
    "dict": dict,
    "int": int,
    "isinstance": isinstance,
    "len": len,
    "list": list,
    "str": str,
}
ok = bool(eval(expr, {"__builtins__": {}, **safe_names}, safe_names))
sys.exit(0 if ok else 1)
PY
}

say "SIT evidence: $OUT_DIR"

health_file="$OUT_DIR/health.json"
code="$(http_get "/api/health" "$health_file")"
if [[ "$code" == "200" ]] && json_check "$health_file" "data.get('ok') is True and data.get('ready') is True and bool(data.get('preflight'))"; then
  record_pass "health endpoint ready"
else
  record_fail "health endpoint not ready (http=$code)"
fi

ui_config_file="$OUT_DIR/ui-config.json"
code="$(http_get "/api/ui-config" "$ui_config_file")"
if [[ "$code" == "200" ]] && json_check "$ui_config_file" "isinstance(data.get('defaults'), dict) and isinstance(data.get('worker_registry'), list) and isinstance(data.get('model_registry'), list)"; then
  record_pass "ui-config has defaults, worker registry, and model registry"
else
  record_fail "ui-config contract invalid (http=$code)"
fi

integrations_file="$OUT_DIR/integrations.json"
code="$(http_get "/api/integrations" "$integrations_file")"
if [[ "$code" == "200" ]] && json_check "$integrations_file" "isinstance(data.get('items'), list) and bool(data.get('ui_config')) and any(x.get('provider') == 'agent_provider' for x in data.get('items', []))"; then
  record_pass "integrations payload renders required runtime/config data"
else
  record_fail "integrations payload missing required fields (http=$code)"
fi

index_file="$OUT_DIR/claude-ui-index.html"
code="$(http_get "/static/claude-ui/index.html" "$index_file")"
if [[ "$code" == "200" ]] && grep -q 'screens/integrations.jsx' "$index_file" && grep -q 'backend/api-client.js' "$index_file" && grep -q 'window.__AGENTFLOW_API__' "$index_file"; then
  record_pass "Claude UI index includes integrations screen and API client prerequisites"
else
  record_fail "Claude UI index missing integrations prerequisites (http=$code)"
fi

for asset in \
  "/static/claude-ui/backend/api-client.js" \
  "/static/claude-ui/data.jsx" \
  "/static/claude-ui/screens/integrations.jsx"
do
  asset_name="$(basename "$asset")"
  code="$(http_get "$asset" "$OUT_DIR/$asset_name")"
  if [[ "$code" == "200" ]]; then
    record_pass "static asset reachable: $asset"
  else
    record_fail "static asset unavailable: $asset (http=$code)"
  fi
done

create_body="$(cat <<'JSON'
{
  "run_name": "SIT Local Smoke v1.0",
  "intent": "memo_only",
  "route_mode": "targeted",
  "workers": ["ingestion"],
  "post_credit": "stop",
  "human_gate": "stop",
  "autonomous": true,
  "fast": true,
  "skip_preflight": true,
  "no_web_research": true,
  "text": "TERM SHEET - SIT SMOKE\nBorrower: SIT Test Borrower\nFacility Type: Term Loan\nAmount: USD 1,000,000\nCurrency: USD\nTenor: 1 year\nPricing: SOFR + 1.00%\nSecurity: Unsecured\nCovenants:\n- DSCR minimum 1.20x\nGoverning Law: Singapore Law",
  "output_formats": ["txt"]
}
JSON
)"
create_file="$OUT_DIR/create-run.json"
code="$(http_post_json "/api/runs" "$create_body" "$create_file")"
if [[ "$code" == "200" ]] && json_check "$create_file" "bool(data.get('run_id')) and data.get('status') == 'queued' and bool(data.get('status_url'))"; then
  run_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["run_id"])' "$create_file")"
  record_pass "run creation accepted: $run_id"
else
  run_id=""
  record_fail "run creation failed (http=$code)"
fi

if [[ -n "$run_id" ]]; then
  detail_file="$OUT_DIR/create-run-detail.json"
  code="$(http_get "/api/runs/$run_id" "$detail_file")"
  if [[ "$code" == "200" ]] && json_check "$detail_file" "data.get('run_id') and data.get('version_label') == 'v1.0' and data.get('request', {}).get('run_name') == 'SIT Local Smoke v1.0'"; then
    record_pass "run detail persisted with v1.0 metadata"
  else
    record_fail "run detail metadata invalid (http=$code)"
  fi

  final_detail_file="$OUT_DIR/create-run-final.json"
  if wait_run_terminal "$run_id" "$final_detail_file" && json_check "$final_detail_file" "data.get('status') in {'succeeded', 'completed'} and data.get('return_code') == 0 and any((a.get('kind') == 'credit_memo' and a.get('validation_status') == 'ok' and int(a.get('size_bytes') or 0) > 0) for a in data.get('artifacts', []))"; then
    record_pass "created run completed with artifacts"
  else
    record_fail "created run did not complete successfully with a non-empty credit memo within ${SIT_WAIT_SECONDS}s"
  fi

  rerun_file="$OUT_DIR/rerun.json"
  code="$(http_post_json "/api/runs/$run_id/rerun" "{}" "$rerun_file")"
  if [[ "$code" == "200" ]] && json_check "$rerun_file" "bool(data.get('run_id')) and data.get('source_run_id')"; then
    rerun_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["run_id"])' "$rerun_file")"
    rerun_detail="$OUT_DIR/rerun-detail.json"
    code="$(http_get "/api/runs/$rerun_id" "$rerun_detail")"
    if [[ "$code" == "200" ]] && json_check "$rerun_detail" "data.get('source_run_id') and data.get('version_label') == 'v1.1' and data.get('request', {}).get('run_name') == 'SIT Local Smoke v1.1'"; then
      record_pass "rerun creates lineage and bumps run_name/version to v1.1"
    else
      record_fail "rerun version metadata invalid (http=$code)"
    fi

    rerun_final="$OUT_DIR/rerun-final.json"
    if wait_run_terminal "$rerun_id" "$rerun_final" && json_check "$rerun_final" "data.get('status') in {'succeeded', 'completed'} and data.get('return_code') == 0 and any((a.get('kind') == 'credit_memo' and a.get('validation_status') == 'ok' and int(a.get('size_bytes') or 0) > 0) for a in data.get('artifacts', []))"; then
      record_pass "rerun completed with artifacts"
    else
      record_fail "rerun did not complete successfully with a non-empty credit memo within ${SIT_WAIT_SECONDS}s"
    fi
  else
    record_fail "rerun endpoint failed (http=$code)"
  fi
fi

runs_file="$OUT_DIR/runs.json"
code="$(http_get "/api/runs?limit=100" "$runs_file")"
artifact_pick="$OUT_DIR/artifact-pick.json"
preferred_run="${rerun_id:-${run_id:-}}"
if [[ "$code" == "200" ]] && python3 - "$runs_file" "$artifact_pick" "$preferred_run" <<'PY'
import json
import sys

runs_path, out_path, preferred_run = sys.argv[1], sys.argv[2], sys.argv[3]
with open(runs_path, "r", encoding="utf-8") as f:
    runs = json.load(f).get("runs", [])
if preferred_run:
    runs = sorted(runs, key=lambda r: 0 if r.get("run_id") == preferred_run else 1)
for run in runs:
    arts = run.get("artifacts") or []
    if str(run.get("status")) in {"succeeded", "completed"} and arts:
        art = next(
            (
                a for a in arts
                if str(a.get("kind")) == "credit_memo"
                and str(a.get("validation_status")) == "ok"
                and int(a.get("size_bytes") or 0) > 0
            ),
            None,
        )
        if not art:
            continue
        result = {
            "run_id": run.get("run_id"),
            "status": run.get("status"),
            "artifact_id": art.get("artifact_id") or art.get("name"),
            "name": art.get("name"),
            "version_label": art.get("version_label") or art.get("version"),
        }
        with open(out_path, "w", encoding="utf-8") as out:
            json.dump(result, out, indent=2)
        sys.exit(0)
sys.exit(1)
PY
then
  picked_run="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["run_id"])' "$artifact_pick")"
  picked_artifact="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["artifact_id"])' "$artifact_pick")"
  artifacts_file="$OUT_DIR/artifacts.json"
  code="$(http_get "/api/runs/$picked_run/artifacts" "$artifacts_file")"
  if [[ "$code" == "200" ]] && json_check "$artifacts_file" "data.get('artifacts_count', 0) >= 1 and len(data.get('artifacts', [])) >= 1"; then
    record_pass "artifact listing returned artifacts for run $picked_run"
  else
    record_fail "artifact listing failed for run $picked_run (http=$code)"
  fi

  preview_file="$OUT_DIR/artifact-preview.json"
  code="$(http_get "/api/artifacts/$picked_run/$picked_artifact/preview" "$preview_file")"
  if [[ "$code" == "200" ]] && json_check "$preview_file" "bool(data.get('kind')) and bool(str(data.get('content') or '').strip()) and bool(data.get('version_label'))"; then
    record_pass "artifact preview returned content and version metadata"
  else
    record_fail "artifact preview failed for $picked_artifact (http=$code)"
  fi
else
  record_fail "no succeeded run with artifacts available for listing/preview"
fi

say "SIT failures: $failures"
if [[ "$failures" -ne 0 ]]; then
  exit 1
fi
