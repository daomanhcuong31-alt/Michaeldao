const state = {
  uploadedFiles: [],
  selectedRunId: "",
  runPollTimer: null,
  apiKey: "",
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  if (state.apiKey) headers["x-sf-api-key"] = state.apiKey;

  const resp = await fetch(url, {
    headers,
    ...options,
  });
  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const data = await resp.json();
      if (data?.detail) detail = data.detail;
    } catch (_e) {}
    throw new Error(detail);
  }
  return resp.json();
}

function selectedWorkers() {
  return [...document.querySelectorAll(".workerCheck:checked")].map((el) => el.value);
}

function renderUploadedFiles() {
  if (!state.uploadedFiles.length) {
    $("uploadedFiles").textContent = "No uploaded files yet.";
    return;
  }
  $("uploadedFiles").innerHTML = state.uploadedFiles
    .map((f) => `<div><strong>${escapeHtml(f.original_name)}</strong> <span class="muted">(${f.file_id})</span></div>`)
    .join("");
}

function renderRunMeta(run) {
  if (!run) {
    $("currentRunMeta").textContent = "No run selected.";
    return;
  }
  const req = run.request || {};
  $("currentRunMeta").innerHTML = `
    <div><strong>Run:</strong> ${escapeHtml(run.run_id)}</div>
    <div><strong>Status:</strong> ${escapeHtml(run.status)}</div>
    <div><strong>Intent:</strong> ${escapeHtml(req.intent || "")}</div>
    <div><strong>Audience:</strong> ${escapeHtml(req.audience || "")}</div>
    <div><strong>Created:</strong> ${escapeHtml(run.created_at || "")}</div>
    <div><strong>Started:</strong> ${escapeHtml(run.started_at || "-")}</div>
    <div><strong>Finished:</strong> ${escapeHtml(run.finished_at || "-")}</div>
  `;
}

function renderArtifacts(runId, artifacts) {
  if (!artifacts || !artifacts.length) {
    $("artifacts").textContent = "No artifacts yet.";
    return;
  }
  $("artifacts").innerHTML = artifacts
    .map(
      (a) =>
        `<div>
          <a href="${escapeHtml(a.download_url)}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a>
          <span class="muted"> (${a.size_bytes} bytes)</span>
        </div>`,
    )
    .join("");
}

function renderRunsList(runs) {
  if (!runs || !runs.length) {
    $("runs").textContent = "No runs yet.";
    return;
  }
  $("runs").innerHTML = runs
    .map((run) => {
      const active = run.run_id === state.selectedRunId ? "active" : "";
      return `<div class="run-item ${active}" data-run-id="${escapeHtml(run.run_id)}">
        <div><strong>${escapeHtml(run.run_id)}</strong></div>
        <div>Status: ${escapeHtml(run.status)}</div>
        <div class="muted">${escapeHtml(run.created_at || "")}</div>
      </div>`;
    })
    .join("");

  [...document.querySelectorAll(".run-item")].forEach((el) => {
    el.addEventListener("click", () => {
      const runId = el.getAttribute("data-run-id");
      if (!runId) return;
      state.selectedRunId = runId;
      loadRun(runId);
      loadRuns();
    });
  });
}

async function checkHealth() {
  try {
    const data = await fetchJson("/api/health");
    $("healthBadge").textContent = data.ok
      ? `Healthy: ${data.provider} / ${data.model}`
      : `Unhealthy: ${data.preflight?.error || "preflight failed"}`;
    $("healthBadge").style.borderColor = data.ok ? "#1e4d3f88" : "#8c2b2188";
  } catch (error) {
    $("healthBadge").textContent = `Health check failed: ${error.message}`;
    $("healthBadge").style.borderColor = "#8c2b2188";
  }
}

async function uploadFiles() {
  const input = $("fileInput");
  if (!input.files.length) return;

  const body = new FormData();
  [...input.files].forEach((f) => body.append("files", f));
  $("runCreateStatus").textContent = "Uploading files...";
  try {
    const headers = state.apiKey ? { "x-sf-api-key": state.apiKey } : {};
    const resp = await fetch("/api/files", { method: "POST", body, headers });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    state.uploadedFiles = [...state.uploadedFiles, ...(data.files || [])];
    renderUploadedFiles();
    $("runCreateStatus").textContent = `Uploaded ${data.files?.length || 0} file(s).`;
    input.value = "";
  } catch (error) {
    $("runCreateStatus").textContent = `Upload failed: ${error.message}`;
  }
}

function buildRunPayload() {
  return {
    intent: $("intent").value,
    audience: $("audience").value,
    route_mode: $("routeMode").value,
    workers: selectedWorkers(),
    manager_instruction: $("managerInstruction").value.trim(),
    post_credit: $("postCredit").value,
    human_gate: "approve",
    autonomous: $("autonomous").checked,
    fast: $("fastMode").checked,
    skip_preflight: $("skipPreflight").checked,
    no_web_research: $("noWebResearch").checked,
    file_ids: state.uploadedFiles.map((f) => f.file_id),
    text: $("textInput").value.trim(),
    sample: $("sampleMode").checked,
  };
}

async function createRun() {
  const payload = buildRunPayload();
  $("runCreateStatus").textContent = "Starting run...";
  try {
    const data = await fetchJson("/api/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.selectedRunId = data.run_id;
    $("runCreateStatus").textContent = `Run created: ${data.run_id}`;
    await loadRuns();
    await loadRun(data.run_id);
    startPolling();
  } catch (error) {
    $("runCreateStatus").textContent = `Run create failed: ${error.message}`;
  }
}

async function loadRuns() {
  try {
    const data = await fetchJson("/api/runs?limit=100");
    renderRunsList(data.runs || []);
  } catch (error) {
    $("runs").textContent = `Failed to load runs: ${error.message}`;
  }
}

async function loadRun(runId) {
  if (!runId) return;
  try {
    const run = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
    renderRunMeta(run);
    const artifacts = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/artifacts`);
    renderArtifacts(runId, artifacts.artifacts || []);
    const logs = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/logs?max_lines=220`);
    const combined = [
      "STDOUT:",
      ...(logs.stdout_lines || []),
      "",
      "STDERR:",
      ...(logs.stderr_lines || []),
    ].join("\n");
    $("logs").textContent = combined || "No logs yet.";
  } catch (error) {
    $("currentRunMeta").textContent = `Failed to load run: ${error.message}`;
  }
}

function startPolling() {
  if (state.runPollTimer) clearInterval(state.runPollTimer);
  state.runPollTimer = setInterval(async () => {
    if (!state.selectedRunId) return;
    await loadRun(state.selectedRunId);
    await loadRuns();
  }, 4000);
}

async function sendControl(action) {
  const payload = {
    action,
    notify: true,
    run_id: action === "cancel_current_run" ? state.selectedRunId : "",
  };
  try {
    const resp = await fetchJson("/api/control", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    $("controlStatus").textContent = `Control accepted: ${resp.action}`;
  } catch (error) {
    $("controlStatus").textContent = `Control failed: ${error.message}`;
  }
}

function bindEvents() {
  const remembered = localStorage.getItem("sf_api_key") || "";
  state.apiKey = remembered;
  $("apiKeyInput").value = remembered;
  $("apiKeyInput").addEventListener("change", () => {
    state.apiKey = $("apiKeyInput").value.trim();
    localStorage.setItem("sf_api_key", state.apiKey);
  });

  $("uploadBtn").addEventListener("click", uploadFiles);
  $("startRunBtn").addEventListener("click", createRun);
  $("refreshRunsBtn").addEventListener("click", loadRuns);
  [...document.querySelectorAll(".controlBtn")].forEach((btn) => {
    btn.addEventListener("click", () => sendControl(btn.getAttribute("data-action")));
  });
  $("workerStartBtn").addEventListener("click", startWorker);
  $("workerStopBtn").addEventListener("click", stopWorker);
  $("workerStatusBtn").addEventListener("click", loadWorkerStatus);
}

function prettyResult(result) {
  if (!result) return "No response.";
  const lines = [];
  lines.push(`ok=${result.ok} return_code=${result.return_code}`);
  if (result.stdout) {
    lines.push("stdout:");
    lines.push(result.stdout);
  }
  if (result.stderr) {
    lines.push("stderr:");
    lines.push(result.stderr);
  }
  if (result.error) lines.push(`error: ${result.error}`);
  return lines.join("\n");
}

async function loadWorkerStatus() {
  try {
    const data = await fetchJson("/api/system/worker/status");
    $("workerStatus").textContent = prettyResult(data.result);
  } catch (error) {
    $("workerStatus").textContent = `Failed to read worker status: ${error.message}`;
  }
}

async function startWorker() {
  try {
    const data = await fetchJson("/api/system/worker/start", { method: "POST", body: JSON.stringify({}) });
    $("workerStatus").textContent = prettyResult(data.result);
  } catch (error) {
    $("workerStatus").textContent = `Start worker failed: ${error.message}`;
  }
}

async function stopWorker() {
  try {
    const data = await fetchJson("/api/system/worker/stop", { method: "POST", body: JSON.stringify({}) });
    $("workerStatus").textContent = prettyResult(data.result);
  } catch (error) {
    $("workerStatus").textContent = `Stop worker failed: ${error.message}`;
  }
}

async function init() {
  bindEvents();
  renderUploadedFiles();
  await checkHealth();
  await loadRuns();
  await loadWorkerStatus();
  startPolling();
  setInterval(checkHealth, 15000);
}

init();
