# Worker Protocol — Hermes on your laptop

The worker is a **long-running process** on your laptop that:
1. Long-polls the cloud API for new jobs.
2. Claims one job at a time (or N if you set concurrency > 1).
3. Runs the agent loop using Hermes + tools.
4. Streams events back to the cloud.
5. Uploads artifacts via presigned URLs.
6. Reports completion.

## Loop, in pseudocode

```python
while True:
    job = api.claim(worker_id, version, tools_available)   # long-poll, 25s
    if not job: continue

    try:
        api.event(job.id, "status", {"status": "running"})
        ctx = AgentContext(job)

        for step in plan(job):   # Hermes's planner produces steps
            api.event(job.id, "step", {"index": step.i, "title": step.title, "status": "running"})
            result = run_step(step, ctx)   # may call tools — each tool call → log event
            api.event(job.id, "step", {"index": step.i, "status": "done", "detail": result.summary})
            api.event(job.id, "progress", {"pct": step.i / len(plan), "eta_sec": estimate(...)})

        if job.config.pause_for_review:
            api.event(job.id, "status", {"status": "awaiting_review"})
            wait_for_approval(job.id)   # poll /jobs/:id every 5s

        artifacts = upload_outputs(ctx.outputs, job.id)
        api.finish(job.id, status="done", artifacts=artifacts, tokens=ctx.tokens, cost_usd=ctx.cost)

    except Exception as e:
        api.finish(job.id, status="failed", error=str(e))
```

## Tool plugin shape

Drop a file into `worker/tools/` named `<tool>.py` (or `.ts`). Each tool exports:

```python
# worker/tools/perplexity.py

NAME = "perplexity"
DISPLAY = "Perplexity Research"
DESCRIPTION = "Research with citations using Perplexity Sonar"
ENV_REQUIRED = ["PERPLEXITY_API_KEY"]

PARAMS_SCHEMA = {  # JSON-schema, used by planner to construct calls
  "type": "object",
  "properties": {
    "query": {"type": "string"},
    "model": {"type": "string", "enum": ["sonar","sonar-pro"], "default": "sonar"}
  },
  "required": ["query"]
}

def call(params, ctx):
    # ctx provides: ctx.api (event emitter), ctx.secrets, ctx.cache
    ctx.api.event("log", {"level": "tool", "msg": f"perplexity.search({params['query']!r})"})
    resp = httpx.post("https://api.perplexity.ai/chat/completions", json={...},
                      headers={"Authorization": f"Bearer {ctx.secrets['PERPLEXITY_API_KEY']}"})
    return {
      "answer": resp.json()["choices"][0]["message"]["content"],
      "citations": resp.json()["citations"],
    }
```

The worker auto-registers everything in `worker/tools/`. Disabling a tool = remove the file or set `ENABLED = False`.

## Built-in tools (suggested implementations)

| Tool             | Backing API                              | Auth                          | Notes |
|------------------|------------------------------------------|-------------------------------|-------|
| `google_drive`   | Google Drive v3                          | OAuth user (one-time, on laptop) | List/read/upload. Use service account if multiple Drives. |
| `onedrive`       | Microsoft Graph                          | OAuth user                    | Same surface as Drive. |
| `google_search`  | Programmable Search Engine               | API key + cse_id              | $5/1000 queries. |
| `chatgpt`        | OpenAI Chat Completions                  | API key                       | Used as a sub-agent — Claude calls ChatGPT for second opinion or specific strengths. |
| `perplexity`     | Perplexity Sonar                         | API key                       | Best for research with citations. |
| `browser`        | Playwright (local, headless)             | none                          | For sites that block APIs. |
| `anthropic`      | Anthropic Messages API                   | API key                       | The planner. |
| `telegram`       | Bot API                                  | Bot token                     | Direct from worker for ultra-fast pings; API does the "official" notifications. |

## Concurrency

Run multiple workers if you want concurrent jobs:
```bash
WORKER_ID=mac-1 python worker/main.py &
WORKER_ID=mac-2 python worker/main.py &
```
The API doesn't care — `/worker/claim` is atomic per request.

## Secrets

Store as env vars on the laptop. **Never** put them in the cloud API. The cloud only knows tool *names*; the worker knows how to actually call them.

```bash
# ~/.agentflow/env
AGENTFLOW_API_URL=https://api.michaeldao.io
AGENTFLOW_API_KEY=ag-flow-…
ANTHROPIC_API_KEY=sk-ant-…
OPENAI_API_KEY=sk-…
PERPLEXITY_API_KEY=pplx-…
GOOGLE_OAUTH_TOKEN_FILE=~/.agentflow/google.json
TELEGRAM_BOT_TOKEN=…
TELEGRAM_CHAT_ID=…
```

## Health & observability

- Worker POSTs `/worker/heartbeat` every 30s with `{ status, queue_depth, current_job_id }`.
- The sidebar's "Hermes worker / online" dot is driven by recency of last heartbeat (< 60s = green).
- Every event is persisted; the Job Detail "Full log" screen replays them.
