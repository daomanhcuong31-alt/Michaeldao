# Michael Dao's Agentic AI Flow — Architecture

## TL;DR

```
┌─────────────────┐    HTTPS    ┌──────────────────┐   long-poll    ┌──────────────────┐
│   Browser UI    │ ──────────▶ │   Cloud API      │ ◀───────────── │  Hermes worker │
│  (this folder)  │ ◀────────── │ (Node + SQLite/  │ ─────────────▶ │  (your laptop)   │
│                 │   SSE/WS    │   Postgres)      │   claim/stream │                  │
└─────────────────┘             └──────────────────┘                └──────────────────┘
        │                                │                                   │
        │                                │                                   ▼
        │                                │                          ┌──────────────────┐
        │                                │                          │  Tools           │
        │                                │                          │  • Google Drive  │
        │                                │                          │  • OneDrive      │
        │                                │                          │  • Google Search │
        │                                │                          │  • ChatGPT       │
        │                                │                          │  • Perplexity    │
        │                                │                          │  • Browser/Scrape│
        │                                │                          │  • Anthropic     │
        │                                ▼                          └──────────────────┘
        │                       ┌─────────────────┐
        │                       │  Object store   │  (S3/R2/local) — input + output blobs
        │                       └─────────────────┘
        │                                │
        ▼                                ▼
   Telegram bot ◀──────── outbound notifications
```

## Why this shape

**Critical constraint:** Your Hermes worker runs on your **laptop** (behind NAT, dynamic IP, sleeps). The cloud cannot reach in. So the worker must **pull**, not be pushed to.

**Three layers, three responsibilities:**

| Layer       | Lives where                | Does                                                                 |
|-------------|----------------------------|----------------------------------------------------------------------|
| UI          | Cloud (static — Vercel/CF) | Submit jobs, watch progress, browse history. Stateless.              |
| API         | Cloud (small VM / Render)  | Job queue, auth, blob URLs, SSE fan-out, Telegram dispatch.          |
| Worker      | Your laptop                | Claims jobs, runs the agent, calls tools, streams events back.       |

**Auth model (solo user):** single bearer token (`AGENTFLOW_API_KEY`) shared between UI, API, and worker. No OAuth, no users table — you're the only one. If you later add teammates, swap to magic-link email auth without touching the worker.

## Job lifecycle

```
   pending ──▶ claimed ──▶ running ──▶ awaiting_review ──▶ uploading ──▶ done
      │           │           │              │                 │
      └───────────┴───────────┴──────────────┴─────────────────┴──▶ failed / cancelled
```

1. UI POSTs `/jobs` → API stores it as `pending`.
2. Worker long-polls `/worker/claim` → API returns one `pending` job, marks it `claimed`.
3. Worker streams `step`, `log`, `tool_call` events to `/worker/jobs/:id/events`.
4. API fans those out to any UI that's subscribed to that job's SSE stream.
5. Worker uploads output blobs by requesting presigned URLs from `/worker/jobs/:id/upload-url`.
6. Worker POSTs final status (`done` / `failed`) → API triggers Telegram notification.

## Tools

Tools are **registered in the worker, not the API**. The API only knows tool *names* (for display) — the actual execution lives next to the model. This keeps secrets on your laptop.

Built-in tools (defined in `WORKER.md`):
- `google_drive` — read/list/upload (Drive OAuth lives on laptop)
- `onedrive` — same shape, MS Graph
- `google_search` — Programmable Search Engine API
- `chatgpt` — OpenAI Chat Completions, used as a sub-agent for second opinions
- `perplexity` — Perplexity Sonar API for research-with-citations
- `browser` — headless Chrome via Playwright
- `anthropic` — Claude as the planner (this is the "main brain")
- `telegram` — direct from worker for status pings (optional; API also does this)

You can add more by dropping a file in `worker/tools/` — see `WORKER.md`.

## Build order (recommended)

1. **`mock-server.js`** boots → UI works end-to-end against fake data. (You can ship the UI today.)
2. **Real API** (replace mock with `server.js`) backed by SQLite. UI doesn't change at all.
3. **Worker skeleton** (`worker/main.py` or `worker/main.ts`) — claims jobs, prints them, posts fake events. Proves the loop.
4. **Hook Hermes** — replace the fake event loop with your actual agent run.
5. **Add tools one at a time** — start with Google Drive (you'll use it most), then Telegram, then research tools.

Each step is independently testable. You never have a broken end-to-end.

## Files in this folder

```
backend/
├── README.md              ← you are here
├── API.md                 ← every endpoint, in human language
├── openapi.yaml           ← machine-readable spec (feed to your coding model!)
├── WORKER.md              ← worker protocol + tool plugin shape
├── mock-server.js         ← run this NOW to test the UI
├── api-client.js          ← drop into the frontend, replaces hard-coded data
└── examples/
    ├── worker.skeleton.py ← starter for Hermes integration
    └── curl.sh            ← every endpoint as a curl command
```

## Workflow advice (UX → engineering handoff)

A few things I'd push you on, from experience:

1. **Don't let the UI shape the API; let the API shape the UI.** Right now the UI is hard-coded with sample data. Before your coding model wires anything, read `API.md` and decide if those payload shapes feel right. Cheap to change now, expensive in 2 weeks.

2. **Build the worker as a separate process, not a thread of the API.** Even on one laptop. It makes deploying the API to the cloud trivial because the worker doesn't move.

3. **Idempotency keys on `POST /jobs`.** Otherwise your "Dispatch" button double-submits when the network blips and you get duplicate Q1 board packs.

4. **Stream events, don't poll.** SSE is one line of code per side and feels 10× better than polling.

5. **Speaking of UI tweaks — defer them.** Right now the UI is "good enough to develop against." Resist the urge to polish until you've run 5 real jobs through it. You'll find issues that no amount of design review surfaces.

6. **One thing the design is missing that you'll want within a week:** a "rerun with edits" flow. When a job finishes wrong, you want to tweak the prompt and re-dispatch with the same inputs. Easy to add later — flag it for v2.
