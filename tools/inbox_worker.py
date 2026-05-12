"""
Autonomous inbox worker for SF Agentic AI.

Drop files into SF_INBOX_DIR and the worker runs the pipeline automatically.
Optional marker-trigger mode is supported via SF_TRIGGER_MODE=marker.

Advanced controls:
- REQUEST.json inside inbox for per-batch run options.
- JSON command files in SF_CONTROL_DIR for pause/resume/status/cancel/report actions.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

SUPPORTED_EXTS = {".pdf", ".txt", ".doc", ".docx", ".png", ".jpg", ".jpeg"}
REQUEST_FILE_NAME = "REQUEST.json"


def _env_bool(name: str, default: str = "false") -> bool:
    return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, floor: Optional[int] = None) -> int:
    try:
        value = int(str(os.getenv(name, str(default))).strip())
    except ValueError:
        value = default
    if floor is not None:
        value = max(floor, value)
    return value


def _now() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _mkdir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _notify(message: str):
    channel = str(os.getenv("SF_NOTIFY_CHANNEL", "")).strip()
    target = str(os.getenv("SF_NOTIFY_TARGET", "")).strip()
    if not channel or not target:
        return
    try:
        subprocess.run(
            [
                "hermes",
                "message",
                "send",
                "--channel",
                channel,
                "--target",
                target,
                "--message",
                message[:3500],
            ],
            check=False,
            capture_output=True,
            text=True,
        )
    except Exception:
        pass


def _read_json(path: Path) -> Dict:
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("json root must be an object")
    return data


def _list_pending(inbox_dir: Path, max_files: int) -> List[Path]:
    files: List[Path] = []
    for p in sorted(inbox_dir.iterdir()):
        if not p.is_file():
            continue
        if p.name.startswith("."):
            continue
        if p.name == REQUEST_FILE_NAME:
            continue
        if p.suffix.lower() not in SUPPORTED_EXTS:
            continue
        files.append(p)
        if len(files) >= max_files:
            break
    return files


def _acquire_lock(lock_path: Path):
    if lock_path.exists():
        try:
            pid = int(lock_path.read_text().strip())
            os.kill(pid, 0)
            raise RuntimeError(f"worker already running with pid {pid}")
        except ProcessLookupError:
            lock_path.unlink(missing_ok=True)
        except ValueError:
            lock_path.unlink(missing_ok=True)

    lock_path.write_text(str(os.getpid()))

    def _cleanup(*_args):
        lock_path.unlink(missing_ok=True)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, _cleanup)
    signal.signal(signal.SIGTERM, _cleanup)


def _should_trigger(trigger_mode: str, trigger_file: Path) -> bool:
    mode = (trigger_mode or "auto").strip().lower()
    if mode == "auto":
        return True
    if mode == "marker":
        if trigger_file.exists():
            try:
                trigger_file.unlink(missing_ok=True)
            except Exception:
                pass
            return True
        return False
    return True


def _load_request(inbox_dir: Path) -> Dict:
    request_path = inbox_dir / REQUEST_FILE_NAME
    if not request_path.exists():
        return {}
    try:
        data = _read_json(request_path)
        request_path.unlink(missing_ok=True)
        return data
    except Exception as e:
        _notify(f"SF worker: invalid REQUEST.json ignored ({e}).")
        bad_dir = _mkdir(inbox_dir / "_invalid_requests")
        bad_name = f"REQUEST_{_now()}.invalid.json"
        shutil.move(str(request_path), str(bad_dir / bad_name))
        return {}


def _bool_from_request(key: str, req: Dict, env_name: str, default: str) -> bool:
    if key in req:
        value = req.get(key)
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"1", "true", "yes", "on"}
    return _env_bool(env_name, default)


def _build_cmd(files: List[Path], request: Dict) -> tuple[List[str], Dict[str, str], int]:
    provider = str(request.get("provider") or os.getenv("SF_PROVIDER", os.getenv("LLM_PROVIDER", "hermes"))).strip() or "hermes"
    post_credit = str(request.get("post_credit") or os.getenv("SF_POST_CREDIT_MODE", "stop")).strip().lower() or "stop"
    human_gate = str(request.get("human_gate") or os.getenv("SF_HUMAN_GATE", "approve")).strip().lower() or "approve"
    intent = str(request.get("intent") or os.getenv("SF_INTENT", "memo_only")).strip().lower() or "memo_only"
    audience = str(request.get("audience") or os.getenv("SF_AUDIENCE", "credit_committee")).strip().lower() or "credit_committee"
    route_mode = str(request.get("route_mode") or os.getenv("SF_ROUTE_MODE", "auto")).strip().lower() or "auto"
    manager_instruction = str(
        request.get("manager_instruction")
        or request.get("instruction")
        or request.get("task")
        or ""
    ).strip()
    workers = request.get("workers") or request.get("target_workers") or []
    if isinstance(workers, str):
        workers = [w.strip() for w in workers.split(",") if w.strip()]
    elif not isinstance(workers, list):
        workers = []
    workers_csv = ",".join([str(w).strip() for w in workers if str(w).strip()])

    cmd = [
        sys.executable,
        "main.py",
        "--intent",
        intent,
        "--audience",
        audience,
        "--route-mode",
        route_mode,
        "--post-credit",
        post_credit,
        "--human-gate",
        human_gate,
    ]
    if workers_csv:
        cmd.extend(["--workers", workers_csv])
    if manager_instruction:
        cmd.extend(["--manager-note", manager_instruction])

    text = str(request.get("text") or "").strip()
    if files:
        cmd.extend(["--files", *[str(p) for p in files]])
    elif text:
        cmd.extend(["--text", text])
    else:
        # Explicit no-input request -> run sample path in autonomous mode.
        cmd.append("--sample")

    if _bool_from_request("autonomous", request, "SF_FORCE_AUTONOMOUS", "true"):
        cmd.append("--autonomous")
    if _bool_from_request("fast", request, "SF_FORCE_FAST", "true"):
        cmd.append("--fast")
    if _bool_from_request("skip_preflight", request, "SF_SKIP_PREFLIGHT", "false"):
        cmd.append("--skip-preflight")
    if _bool_from_request("no_web_research", request, "SF_NO_WEB_RESEARCH", "false"):
        cmd.append("--no-web-research")

    env = dict(os.environ)
    env["LLM_PROVIDER"] = provider
    env.setdefault("PYTHONPYCACHEPREFIX", "/tmp/pycache")

    run_timeout_sec = _env_int("SF_RUN_TIMEOUT_SEC", 1800, floor=120)
    if "timeout_sec" in request:
        try:
            run_timeout_sec = max(120, int(request.get("timeout_sec")))
        except (TypeError, ValueError):
            pass

    return cmd, env, run_timeout_sec


def _latest_output_summary(output_dir: Path) -> str:
    if not output_dir.exists():
        return "No output folder found yet."

    files = sorted([p for p in output_dir.iterdir() if p.is_file()], key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        return "No output files found yet."

    top = files[:6]
    lines = ["Latest output files:"]
    for p in top:
        stamp = datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"- {p.name} ({stamp})")

    latest_txt = next((p for p in files if p.suffix.lower() in {".txt", ".md"}), None)
    if latest_txt is not None:
        try:
            preview = latest_txt.read_text(encoding="utf-8", errors="ignore")[:800].strip()
            if preview:
                lines.append("")
                lines.append("Preview:")
                lines.append(preview)
        except Exception:
            pass

    return "\n".join(lines)


def _write_status(status_path: Path, state: Dict):
    payload = {
        "timestamp": datetime.now().isoformat(),
        "paused": bool(state.get("paused")),
        "current_run": state.get("current_run"),
        "current_pid": state.get("current_pid"),
        "last_result": state.get("last_result"),
    }
    status_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _handle_control_commands(state: Dict, control_dir: Path, active_proc: Optional[subprocess.Popen] = None):
    done_dir = _mkdir(control_dir / "processed")
    bad_dir = _mkdir(control_dir / "failed")
    status_path = Path(os.getenv("SF_STATUS_FILE", "./data/inbox/worker.status.json")).expanduser()
    _mkdir(status_path.parent)

    command_files = sorted([p for p in control_dir.glob("*.json") if p.is_file()])
    for path in command_files:
        try:
            cmd = _read_json(path)
            action = str(cmd.get("action", "")).strip().lower()
            notify = bool(cmd.get("notify", True))
            message = ""

            if action == "pause":
                state["paused"] = True
                message = "SF worker paused."
            elif action == "resume":
                state["paused"] = False
                message = "SF worker resumed."
            elif action == "status":
                message = (
                    f"SF worker status: paused={state.get('paused')}, "
                    f"current_run={state.get('current_run')}, pid={state.get('current_pid')}, "
                    f"last_result={state.get('last_result')}"
                )
            elif action == "cancel_current_run":
                if active_proc is not None and active_proc.poll() is None:
                    active_proc.terminate()
                    message = f"SF worker requested cancel for run {state.get('current_run')} (pid={active_proc.pid})."
                else:
                    message = "SF worker cancel ignored: no active run."
            elif action == "send_latest_report":
                summary = _latest_output_summary(Path("./data/output"))
                message = f"SF worker report request:\n{summary}"
            else:
                raise ValueError(f"unsupported action: {action or '<missing>'}")

            _write_status(status_path, state)
            if notify:
                _notify(message)
            dest = done_dir / f"{path.stem}.{_now()}.json"
            shutil.move(str(path), str(dest))
            print(f"[inbox-worker] control action={action} handled")
        except Exception as e:
            fail_dest = bad_dir / f"{path.stem}.{_now()}.json"
            try:
                shutil.move(str(path), str(fail_dest))
                (fail_dest.with_suffix(fail_dest.suffix + ".error.txt")).write_text(str(e), encoding="utf-8")
            except Exception:
                pass
            _notify(f"SF worker: failed to process control file {path.name}: {e}")


def _run_pipeline(files: List[Path], request: Dict, state: Dict, control_dir: Path) -> subprocess.CompletedProcess:
    cmd, env, run_timeout_sec = _build_cmd(files, request)
    print(f"[inbox-worker] running: {' '.join(cmd)}")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    state["current_pid"] = proc.pid

    deadline = time.time() + run_timeout_sec
    cancelled = False
    timed_out = False
    while proc.poll() is None:
        _handle_control_commands(state, control_dir, active_proc=proc)
        if proc.poll() is not None:
            break
        if time.time() >= deadline:
            timed_out = True
            proc.terminate()
            break
        time.sleep(2)

    if proc.poll() is None:
        cancelled = True
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()

    stdout, stderr = proc.communicate()
    returncode = proc.returncode

    if timed_out:
        timeout_msg = "Pipeline timed out after configured timeout."
        stdout = (stdout or "") + f"\n{timeout_msg}\n"
        stderr = (stderr or "") + f"\n{timeout_msg}\n"
        returncode = 124
    elif cancelled and returncode == 0:
        returncode = 130

    state["current_pid"] = None
    return subprocess.CompletedProcess(args=cmd, returncode=returncode, stdout=stdout or "", stderr=stderr or "")


def _move_group(files: List[Path], base_dir: Path, run_tag: str) -> Path:
    run_dir = _mkdir(base_dir / run_tag)
    for src in files:
        dst = run_dir / src.name
        i = 1
        while dst.exists():
            dst = run_dir / f"{src.stem}_{i}{src.suffix}"
            i += 1
        shutil.move(str(src), str(dst))
    return run_dir


def process_once(state: Dict) -> bool:
    inbox_dir = _mkdir(Path(os.getenv("SF_INBOX_DIR", "./data/inbox/pending")).expanduser())
    processing_dir = _mkdir(Path(os.getenv("SF_PROCESSING_DIR", "./data/inbox/processing")).expanduser())
    archive_dir = _mkdir(Path(os.getenv("SF_ARCHIVE_DIR", "./data/inbox/archive")).expanduser())
    failed_dir = _mkdir(Path(os.getenv("SF_FAILED_DIR", "./data/inbox/failed")).expanduser())
    control_dir = _mkdir(Path(os.getenv("SF_CONTROL_DIR", "./data/inbox/control")).expanduser())

    max_files = _env_int("SF_INBOX_MAX_FILES", 20, floor=1)
    trigger_mode = str(os.getenv("SF_TRIGGER_MODE", "auto"))
    trigger_file = Path(os.getenv("SF_TRIGGER_FILE", "./data/inbox/TRIGGER")).expanduser()

    _handle_control_commands(state, control_dir)
    if state.get("paused"):
        return False

    request = _load_request(inbox_dir)
    files = _list_pending(inbox_dir, max_files=max_files)
    request_only = bool(request) and not files and bool(str(request.get("text", "")).strip())

    if not files and not request_only:
        return False

    if not _should_trigger(trigger_mode, trigger_file):
        return False

    run_tag = _now()
    state["current_run"] = run_tag

    if files:
        processing_run_dir = _move_group(files, processing_dir, run_tag)
        processing_files = sorted([p for p in processing_run_dir.iterdir() if p.is_file()])
    else:
        processing_run_dir = _mkdir(processing_dir / run_tag)
        processing_files = []

    if request:
        try:
            (processing_run_dir / REQUEST_FILE_NAME).write_text(json.dumps(request, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass

    _notify(f"SF worker: started run {run_tag} with {len(processing_files)} file(s).")
    result = _run_pipeline(processing_files, request=request, state=state, control_dir=control_dir)

    out_tail = (result.stdout or "")[-1800:]
    err_tail = (result.stderr or "")[-800:]

    if result.returncode == 0:
        final_dir = _mkdir(archive_dir / run_tag)
        for p in processing_files:
            shutil.move(str(p), str(final_dir / p.name))
        try:
            req_file = processing_run_dir / REQUEST_FILE_NAME
            if req_file.exists():
                shutil.move(str(req_file), str(final_dir / REQUEST_FILE_NAME))
        except Exception:
            pass
        try:
            processing_run_dir.rmdir()
        except Exception:
            pass

        state["last_result"] = {"run_tag": run_tag, "status": "success", "code": 0}
        _notify(f"SF worker: run {run_tag} completed successfully.\n{out_tail}")
        print(f"[inbox-worker] run {run_tag} success")
        state["current_run"] = None
        return True

    final_dir = _mkdir(failed_dir / run_tag)
    for p in processing_files:
        shutil.move(str(p), str(final_dir / p.name))
    try:
        req_file = processing_run_dir / REQUEST_FILE_NAME
        if req_file.exists():
            shutil.move(str(req_file), str(final_dir / REQUEST_FILE_NAME))
    except Exception:
        pass
    try:
        (final_dir / "run.stdout.log").write_text(result.stdout or "", encoding="utf-8")
        (final_dir / "run.stderr.log").write_text(result.stderr or "", encoding="utf-8")
    except Exception:
        pass
    try:
        processing_run_dir.rmdir()
    except Exception:
        pass

    state["last_result"] = {"run_tag": run_tag, "status": "failed", "code": result.returncode}
    _notify(
        f"SF worker: run {run_tag} FAILED (code={result.returncode}).\n"
        f"stdout tail:\n{out_tail}\n\nstderr tail:\n{err_tail}"
    )
    print(f"[inbox-worker] run {run_tag} failed: code={result.returncode}")
    state["current_run"] = None
    return True


def main():
    parser = argparse.ArgumentParser(description="Autonomous inbox worker for SF Agentic AI")
    parser.add_argument("--once", action="store_true", help="Process at most one batch and exit")
    args = parser.parse_args()

    lock_path = Path(os.getenv("SF_INBOX_LOCK_FILE", "./data/inbox/worker.lock")).expanduser()
    _mkdir(lock_path.parent)
    _acquire_lock(lock_path)

    control_dir = _mkdir(Path(os.getenv("SF_CONTROL_DIR", "./data/inbox/control")).expanduser())
    _mkdir(control_dir / "processed")
    _mkdir(control_dir / "failed")

    poll_sec = _env_int("SF_POLL_SEC", 15, floor=2)
    print(f"[inbox-worker] started (poll={poll_sec}s)")

    state: Dict = {
        "paused": False,
        "current_run": None,
        "current_pid": None,
        "last_result": None,
    }

    try:
        if args.once:
            process_once(state)
            return

        while True:
            try:
                handled = process_once(state)
                if not handled:
                    time.sleep(poll_sec)
            except Exception as e:
                print(f"[inbox-worker] error: {e}")
                _notify(f"SF worker error: {e}")
                time.sleep(poll_sec)
    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
