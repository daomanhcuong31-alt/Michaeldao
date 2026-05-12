#!/usr/bin/env bash
# Every endpoint, as a curl command. Useful for poking the mock server (or the real one).
# Source your env first:
#   export AGENTFLOW_API_URL=http://localhost:4000
#   export AGENTFLOW_API_KEY=dev-key

H="Authorization: Bearer $AGENTFLOW_API_KEY"

# ── UI side ───────────────────────────────────────────────────────────────────

# Create a job
curl -s -X POST "$AGENTFLOW_API_URL/jobs" -H "$H" -H "content-type: application/json" -d '{
  "idempotency_key": "'"$(uuidgen)"'",
  "task_type": "ppt",
  "prompt": "Build a Q1 board pack from the linked Drive folder",
  "inputs": { "files": [], "drive_link": "https://drive.google.com/...", "urls": [] },
  "output": { "drive": {"enabled": true, "folder": "/Reports/2026-Q1"}, "telegram": {"enabled": true} },
  "config": { "planner": "claude-sonnet-4.5", "max_steps": 40, "time_budget_sec": 1200,
              "tools_allowed": ["google_drive","perplexity","browser","chatgpt"] }
}'

# List jobs
curl -s "$AGENTFLOW_API_URL/jobs" -H "$H"

# Get one job
curl -s "$AGENTFLOW_API_URL/jobs/JOB-1042" -H "$H"

# Subscribe to live events (SSE)
curl -N "$AGENTFLOW_API_URL/jobs/JOB-1042/events?token=$AGENTFLOW_API_KEY"

# Sign an upload URL
curl -s -X POST "$AGENTFLOW_API_URL/uploads/sign" -H "$H" -H "content-type: application/json" \
  -d '{"filename":"q1.xlsx","size":284000,"content_type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'

# Cancel a job
curl -s -X POST "$AGENTFLOW_API_URL/jobs/JOB-1042/cancel" -H "$H"

# Integrations dashboard
curl -s "$AGENTFLOW_API_URL/integrations" -H "$H"

# ── Worker side ───────────────────────────────────────────────────────────────

# Claim next job
curl -s -X POST "$AGENTFLOW_API_URL/worker/claim" -H "$H" -H "content-type: application/json" \
  -d '{"worker_id":"laptop-1","version":"0.1.0","tools_available":["google_drive","perplexity"]}'

# Heartbeat
curl -s -X POST "$AGENTFLOW_API_URL/worker/heartbeat" -H "$H" -H "content-type: application/json" \
  -d '{"worker_id":"laptop-1","queue_depth":2}'

# Push an event
curl -s -X POST "$AGENTFLOW_API_URL/worker/jobs/JOB-1042/events" -H "$H" -H "content-type: application/json" \
  -d '{"event":"step","data":{"index":3,"title":"Generating slides","status":"running"}}'

# Finish a job
curl -s -X POST "$AGENTFLOW_API_URL/worker/jobs/JOB-1042/finish" -H "$H" -H "content-type: application/json" \
  -d '{"status":"done","artifacts":[],"tokens":{"in":32481,"out":14902},"cost_usd":0.42}'
