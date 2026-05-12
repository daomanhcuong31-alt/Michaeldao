#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
./scripts/start_local_ui_stack.sh
sleep 1
open "http://127.0.0.1:8000/" || true
