// backend/mock-server.js — RECONCILED 2026-04-28
// Routes now match CLAUDE_UI_BACKEND_CONTRACT.md (/api/* prefix, run terminology)
// Run: node mock-server.js
// Auth: Authorization: Bearer dev-key

const http = require("http");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 4000;
const KEY  = process.env.AGENTFLOW_API_KEY || "dev-key";

// ── In-memory state ──────────────────────────────────────────────────────────
const runs = new Map();
const files = new Map();
const subscribers = new Map(); // run_id → Set<res>
let runCounter = 456;
let fileCounter = 100;

const WORKERS = ["ingestion", "market_intel", "analysis_parallel", "financial_modeler", "memo_architect"];

function seedRun(name, status, progress_percent, route_mode = "auto") {
  const run_id = "run_" + (runCounter++);
  runs.set(run_id, {
    run_id, run_name: name, status,
    route_mode,
    planned_workers: WORKERS.slice(0, 4),
    completed_steps: status === "completed" ? WORKERS.slice(0, 4) : WORKERS.slice(0, Math.floor(progress_percent / 25)),
    current_agent:   status === "running" ? WORKERS[Math.floor(progress_percent / 25)] : "",
    progress_percent,
    quality_gate_decision: "",
    last_error: status === "failed" ? "429 rate-limit on translation API" : "",
    manager_plan: { mode: "full", workers: WORKERS.slice(0, 4), reason: "auto-default-full" },
    artifacts_count: status === "completed" ? 3 : 0,
    artifacts: status === "completed" ? [
      { artifact_id: "art_" + runCounter, run_id, name: "CC_Memo_" + name.replace(/\s/g,"_") + ".txt",
        kind: "credit_memo", mime_type: "text/plain", size_bytes: 22345,
        download_url: "/api/artifacts/art_" + runCounter + "/download",
        created_at: new Date().toISOString() }
    ] : [],
    config: { intent: "memo_only", route_mode, provider: "hermes", timeout_sec: 1800 },
    inputs: [],
    created_at: new Date(Date.now() - Math.random() * 7200_000).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

seedRun("Q1 2026 Board Pack",          "running",   62);
seedRun("Customer Transcript Analysis","queued",     0);
seedRun("Competitor Pricing Research", "queued",     0,  "targeted");
seedRun("Deal A — Memo",               "completed",  100);
seedRun("Deal B — Full E2E",           "completed",  100);
seedRun("Weekly Metrics Deck",         "completed",  100);
seedRun("FAQ Translation",             "failed",     25);

// ── Helpers ──────────────────────────────────────────────────────────────────
const send = (res, code, body, extra = {}) => {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    ...extra,
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise(ok => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => { try { ok(JSON.parse(b)); } catch { ok({}); } });
});
const auth = (req) => (req.headers.authorization || "") === `Bearer ${KEY}` ||
                      (new URL(req.url, "http://x").searchParams.get("token") === KEY);

// ── SSE broadcast ─────────────────────────────────────────────────────────────
function broadcast(run_id, event, data) {
  const subs = subscribers.get(run_id); if (!subs) return;
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const r of subs) { try { r.write(line); } catch {} }
}

// ── Routes ────────────────────────────────────────────────────────────────────
const R = (method, re, fn) => ({ method, re, fn });
const routes = [
  R("OPTIONS", /.*/, (q, s) => send(s, 204, "")),

  // Files
  R("POST", /^\/api\/files$/, async (req, res) => {
    // In mock we just return a fake FileReference — real impl parses multipart
    const fid = "file_" + (fileCounter++);
    const ref = { id: fid, name: "mock_file.pdf", source: "upload",
                  mime_type: "application/pdf", size_bytes: 123456,
                  download_url: `/api/files/${fid}/download` };
    files.set(fid, ref);
    send(res, 200, { files: [ref] });
  }),

  // Create run
  R("POST", /^\/api\/runs$/, async (req, res) => {
    const body = await readBody(req);
    if (!body.idempotency_key) return send(res, 400, { error: { code: "VALIDATION_ERROR", message: "idempotency_key required" } });
    for (const r of runs.values()) if (r.idempotency_key === body.idempotency_key)
      return send(res, 200, { run_id: r.run_id, status: r.status, created_at: r.created_at });

    const run_id = "run_" + (runCounter++);
    const now = new Date().toISOString();
    const workers = body.config?.route_mode === "targeted"
      ? (body.config.target_workers || [])
      : WORKERS.slice(0, 4);

    const run = {
      run_id, run_name: body.run_name || body.text_input?.slice(0,60) || "Untitled",
      idempotency_key: body.idempotency_key,
      status: "queued", progress_percent: 0,
      route_mode: body.config?.route_mode || "auto",
      planned_workers: workers, completed_steps: [], current_agent: "",
      quality_gate_decision: "", last_error: "",
      manager_plan: { mode: body.config?.route_mode || "auto", workers, reason: "ui-submitted" },
      artifacts_count: 0, artifacts: [],
      config: body.config || {}, inputs: body.inputs || [],
      created_at: now, updated_at: now,
    };
    runs.set(run_id, run);
    setTimeout(() => simulateRun(run_id), 600);
    send(res, 201, { run_id, status: "queued", created_at: now });
  }),

  // List runs
  R("GET", /^\/api\/runs(\?.*)?$/, (req, res) => {
    const status = new URL(req.url, "http://x").searchParams.get("status");
    const items = [...runs.values()].filter(r => !status || r.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    send(res, 200, { items, next: null });
  }),

  // Get run
  R("GET", /^\/api\/runs\/([^/]+)$/, (req, res, m) => {
    const r = runs.get(m[1]); if (!r) return send(res, 404, { error: { code: "NOT_FOUND" } });
    send(res, 200, r);
  }),

  // SSE stream
  R("GET", /^\/api\/runs\/([^/]+)\/events$/, (req, res, m) => {
    res.writeHead(200, {
      "content-type": "text/event-stream", "cache-control": "no-cache",
      "connection": "keep-alive", "access-control-allow-origin": "*",
    });
    res.write("retry: 3000\n\n");
    const id = m[1];
    if (!subscribers.has(id)) subscribers.set(id, new Set());
    subscribers.get(id).add(res);
    req.on("close", () => subscribers.get(id)?.delete(res));
  }),

  // Artifacts
  R("GET", /^\/api\/runs\/([^/]+)\/artifacts$/, (req, res, m) => {
    const r = runs.get(m[1]); if (!r) return send(res, 404, {});
    send(res, 200, { artifacts: r.artifacts || [] });
  }),

  // Control
  R("POST", /^\/api\/control$/, async (req, res) => {
    const { action, run_id } = await readBody(req);
    const r = run_id ? runs.get(run_id) : [...runs.values()].find(r => r.status === "running");
    if (action === "pause"   && r) { r.status = "paused";   broadcast(r.run_id, "status", { status: "paused" }); }
    if (action === "resume"  && r) { r.status = "running";  broadcast(r.run_id, "status", { status: "running" }); }
    if (action === "cancel_current_run" && r) { r.status = "cancelled"; broadcast(r.run_id, "status", { status: "cancelled" }); }
    send(res, 200, { ok: true, run_id: r?.run_id });
  }),

  // Health
  R("GET", /^\/api\/health$/, (req, res) =>
    send(res, 200, { ok: true, provider: "hermes", ready: true })),

  // Integrations
  R("GET", /^\/api\/integrations$/, (req, res) =>
    send(res, 200, {
      google_drive: { connected: true, account: "michael@dao.studio" },
      onedrive:     { connected: false },
      google_search:{ connected: true },
      chatgpt:      { connected: true },
      perplexity:   { connected: true, model: "sonar-pro" },
      browser:      { connected: true },
      anthropic:    { connected: true },
      telegram:     { connected: true, channel: "@michael_dao_alerts" },
      slack:        { connected: false },
    })),

  // Me
  R("GET", /^\/api\/me$/, (req, res) =>
    send(res, 200, { name: "Michael Dao", email: "michael@dao.studio",
                     plan: "Solo · self-hosted", budget_usd: 100, spent_usd: 28.40 })),

  // Worker: claim
  R("POST", /^\/worker\/claim$/, async (req, res) => {
    const pending = [...runs.values()].find(r => r.status === "queued");
    if (!pending) return send(res, 204, "");
    pending.status = "running"; broadcast(pending.run_id, "status", { status: "running" });
    send(res, 200, pending);
  }),

  R("POST", /^\/worker\/heartbeat$/, (req, res) => send(res, 200, { ok: true })),
];

// ── Mock agent simulation ─────────────────────────────────────────────────────
function simulateRun(run_id) {
  const r = runs.get(run_id); if (!r) return;
  r.status = "running"; broadcast(run_id, "status", { status: "running" });
  let i = 0;
  const tick = setInterval(() => {
    if (i >= r.planned_workers.length) {
      clearInterval(tick);
      r.status = "completed"; r.progress_percent = 100; r.current_agent = "";
      const art = { artifact_id: "art_" + runCounter, run_id,
        name: `CC_Memo_${r.run_name.replace(/\s/g,"_")}.txt`,
        kind: "credit_memo", mime_type: "text/plain", size_bytes: 22345,
        download_url: `/api/artifacts/art_${runCounter}/download`, created_at: new Date().toISOString() };
      r.artifacts.push(art); r.artifacts_count++;
      broadcast(run_id, "artifact", art);
      broadcast(run_id, "status",   { status: "completed" });
      return;
    }
    const agent = r.planned_workers[i];
    r.current_agent = agent;
    broadcast(run_id, "step",     { agent, status: "running" });
    broadcast(run_id, "log",      { ts: new Date().toISOString(), level: "tool", msg: `${agent}: started` });
    setTimeout(() => {
      r.completed_steps.push(agent);
      broadcast(run_id, "step",   { agent, status: "done" });
      broadcast(run_id, "log",    { ts: new Date().toISOString(), level: "ok", msg: `${agent}: done` });
    }, 1000);
    r.progress_percent = Math.round(((i + 1) / r.planned_workers.length) * 100);
    broadcast(run_id, "progress", { progress_percent: r.progress_percent, current_agent: agent });
    i++;
  }, 1800);
}

// ── Server ────────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (!auth(req)) return send(res, 401, { error: { code: "UNAUTHENTICATED" } });
  for (const r of routes) {
    if (req.method !== r.method) continue;
    const m = req.url.match(r.re);
    if (m) return r.fn(req, res, m);
  }
  send(res, 404, { error: { code: "NOT_FOUND", message: req.method + " " + req.url } });
}).listen(PORT, () => {
  console.log(`✓  mock agentic-flow API  →  http://localhost:${PORT}`);
  console.log(`   auth  Bearer ${KEY}`);
  console.log(`   test  curl -H "Authorization: Bearer ${KEY}" http://localhost:${PORT}/api/health`);
});
