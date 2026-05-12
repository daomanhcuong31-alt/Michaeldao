# worker/main.py — Hermes worker skeleton
# Drop your Hermes agent run inside `execute_job()`. Everything else (claiming,
# event streaming, artifact upload) is already wired.
#
# Install:  pip install httpx
# Run:      AGENTFLOW_API_URL=… AGENTFLOW_API_KEY=… python worker/main.py

import os, time, json, uuid, traceback, importlib, pathlib
import httpx

API_URL = os.environ["AGENTFLOW_API_URL"]
API_KEY = os.environ["AGENTFLOW_API_KEY"]
WORKER_ID = os.environ.get("WORKER_ID", "laptop-1")

H = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# ── Tool registry ────────────────────────────────────────────────────────────
TOOLS = {}
def load_tools():
    tdir = pathlib.Path(__file__).parent / "tools"
    for f in tdir.glob("*.py"):
        if f.stem.startswith("_"): continue
        mod = importlib.import_module(f"tools.{f.stem}")
        if getattr(mod, "ENABLED", True):
            TOOLS[mod.NAME] = mod
    print(f"[worker] loaded tools: {list(TOOLS)}")

# ── API helpers ──────────────────────────────────────────────────────────────
def emit(job_id, event, data):
    httpx.post(f"{API_URL}/worker/jobs/{job_id}/events",
               json={"event": event, "data": data}, headers=H, timeout=10)

def heartbeat():
    httpx.post(f"{API_URL}/worker/heartbeat", headers=H,
               json={"worker_id": WORKER_ID, "tools_available": list(TOOLS)},
               timeout=10)

def claim_job():
    try:
        r = httpx.post(f"{API_URL}/worker/claim", headers=H,
                       json={"worker_id": WORKER_ID, "version": "0.1.0", "tools_available": list(TOOLS)},
                       timeout=30)
        if r.status_code == 204: return None
        return r.json()
    except Exception as e:
        print(f"[worker] claim error: {e}")
        return None

def upload_artifact(job_id, path, kind):
    size = pathlib.Path(path).stat().st_size
    sign = httpx.post(f"{API_URL}/worker/jobs/{job_id}/upload-url", headers=H,
                     json={"filename": pathlib.Path(path).name, "kind": kind, "size": size}).json()
    with open(path, "rb") as f:
        httpx.put(sign["put_url"], content=f.read())
    return {"name": pathlib.Path(path).name, "kind": kind, "size": size, "url": sign["blob_id"]}

def finish(job_id, status, **kw):
    httpx.post(f"{API_URL}/worker/jobs/{job_id}/finish", headers=H,
               json={"status": status, **kw}, timeout=30)

# ── The actual job runner — wire Hermes here ───────────────────────────────
def execute_job(job):
    """
    REPLACE THE BODY of this function with your Hermes agent run.

    `job` is the full job document from the API. Use:
       emit(job["id"], "step",    {"index": i, "title": "...", "status": "running"|"done"})
       emit(job["id"], "log",     {"ts": ..., "level": "info|tool|ok|warn|err", "msg": "..."})
       emit(job["id"], "progress",{"pct": 0..1, "eta_sec": int})

    Call tools via:  TOOLS["perplexity"].call({"query": "..."}, ctx)
    """
    jid = job["id"]
    emit(jid, "log", {"level": "info", "msg": f"Hermes worker starting · planner={job['config']['planner']}"})

    # === START: replace with Hermes integration ============================
    plan = ["Resolve inputs", "Run planner", "Execute steps", "Upload artifacts"]
    for i, title in enumerate(plan):
        emit(jid, "step", {"index": i, "title": title, "status": "running"})
        time.sleep(1)
        emit(jid, "step", {"index": i, "title": title, "status": "done"})
        emit(jid, "progress", {"pct": (i+1)/len(plan)})
    # === END: replace with Hermes integration ==============================

    # Example: upload a result file
    # artifact = upload_artifact(jid, "/tmp/result.pptx", "PPTX")
    # finish(jid, "done", artifacts=[artifact], tokens={"in": 0, "out": 0}, cost_usd=0.0)
    finish(jid, "done", artifacts=[], tokens={"in": 0, "out": 0}, cost_usd=0.0)

# ── Main loop ────────────────────────────────────────────────────────────────
def main():
    load_tools()
    last_hb = 0
    while True:
        if time.time() - last_hb > 30:
            try: heartbeat(); last_hb = time.time()
            except: pass
        job = claim_job()
        if not job:
            time.sleep(1); continue
        print(f"[worker] claimed {job['id']}: {job['name']}")
        try:
            execute_job(job)
        except Exception as e:
            traceback.print_exc()
            finish(job["id"], "failed", error=str(e))

if __name__ == "__main__":
    main()
