#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
./scripts/local_ui_stack_status.sh || true
