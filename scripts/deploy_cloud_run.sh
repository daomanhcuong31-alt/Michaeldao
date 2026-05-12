#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=my-project REGION=asia-southeast1 SF_API_KEY=... SF_UI_ORIGINS=https://app.example.com ./scripts/deploy_cloud_run.sh sf-agentic-ai
# Optional:
#   PUBLIC=0  # deploy private (requires IAM/IAP access)

SERVICE="${1:-sf-agentic-ai}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-asia-southeast1}"
PUBLIC="${PUBLIC:-1}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required (env var or active gcloud project)." >&2
  exit 1
fi

if [[ "${PUBLIC}" == "1" ]]; then
  AUTH_FLAG="--allow-unauthenticated"
else
  AUTH_FLAG="--no-allow-unauthenticated"
fi

gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --source . \
  --cpu 1 \
  --memory 2Gi \
  --timeout 3600 \
  --concurrency 20 \
  --min-instances 1 \
  --max-instances 3 \
  --no-cpu-throttling \
  ${AUTH_FLAG} \
  --set-env-vars "PYTHONPYCACHEPREFIX=/tmp/pycache,SF_UI_ORIGINS=${SF_UI_ORIGINS:-*},SF_API_KEY=${SF_API_KEY:-}"

