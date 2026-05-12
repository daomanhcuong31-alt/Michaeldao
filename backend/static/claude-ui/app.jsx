// Main app — routing, state, live API integration
const { useState, useEffect } = React;

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error("Screen render error:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <section className="card">
          <div className="card-head"><h3>Screen Error</h3></div>
          <div className="card-pad">
            <div className="mono" style={{ color: "var(--err)", marginBottom: 8 }}>
              Failed to render this screen.
            </div>
            <div className="dim" style={{ fontSize: 12 }}>
              {String(this.state.error?.message || this.state.error || "Unknown error")}
            </div>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function Dashboard({ setRoute, onOpenJob, onPreviewArtifact, searchQuery = "" }) {
  const go = (e, next) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRoute(next);
  };
  const query = String(searchQuery || "").trim().toLowerCase();
  const visibleJobs = QUEUE.filter((j) => {
    if (!query) return true;
    const artifactNames = (j.artifacts || []).map((a) => a.name).join(" ");
    return [j.run_id, j.run_name, j.intent, j.route_mode, j.status, j.version_label, artifactNames]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  return (
    <div data-screen-label="00 Dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="h1">Workspace dashboard <span className="h1-serif">— latest worker activity</span></h1>
          <p className="sub">Drop a file, paste a Drive link, or describe the task. The worker takes it from there.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={(e) => go(e, "new")}><I.Plus size={14} /> New job</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <KPI label="Running" value={String(QUEUE.filter((q) => q.status === "running").length)} trend={ACTIVE_RUN.run_id || "-"} />
        <KPI label="Queued" value={String(QUEUE.filter((q) => q.status === "queued").length)} trend="waiting list" />
        <KPI label="Done" value={String(QUEUE.filter((q) => q.status === "succeeded" || q.status === "completed").length)} trend="from local history" up />
        <KPI label="Failed" value={String(QUEUE.filter((q) => q.status === "failed").length)} trend="needs review" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <section className="card">
          <div className="card-head">
            <h3>Active right now</h3>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={(e) => go(e, "active")}>Open <I.Chevron size={12} /></button>
          </div>
          <div className="card-pad">
            <div className="mono dim" style={{ fontSize: 11, letterSpacing: "0.08em" }}>RUN · {ACTIVE_RUN.run_id}</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4, marginBottom: 14 }}>{ACTIVE_RUN.run_name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11.5 }} className="mono">
              <span className="dim">agent: {ACTIVE_RUN.current_agent || "—"} · {ACTIVE_RUN.route_mode || "auto"}</span>
              <span>{ACTIVE_RUN.progress_percent || 0}%</span>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: (ACTIVE_RUN.progress_percent || 0) + "%" }} /></div>
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              {(ACTIVE_RUN.inputs || []).slice(0, 3).map((f, i) =>
              <div key={i} className="chip">{f.source === "google_drive" ? "DRV" : fileExt(f.name)} · {f.name && f.name.length > 18 ? f.name.slice(0, 16) + "…" : f.name}</div>
              )}
              {(ACTIVE_RUN.inputs || []).length > 3 && <div className="chip">+{(ACTIVE_RUN.inputs || []).length - 3}</div>}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Recent artifacts</h3>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}><I.Download size={12} /></button>
          </div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {RECENT_ARTIFACTS.length === 0 && <div className="dim mono" style={{ fontSize: 11 }}>No artifacts yet</div>}
            {RECENT_ARTIFACTS.map((a, i) => {
              const invalid = a.path_status === "empty" || a.validation_status === "invalid_empty" || Number(a.size_bytes || 0) === 0;
              return (
            <div className="file-row" key={i}>
                <div className="file-ico">{fileExt(a.name)}</div>
                <div className="file-meta">
                  <div className="file-name">{a.name}</div>
                  <div className="file-size">{fmtBytes(a.size_bytes)} · {a.kind}{invalid ? " · EMPTY OUTPUT" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="file-x" onClick={() => onPreviewArtifact && onPreviewArtifact(a)} title="Preview">
                    <I.Eye size={14} />
                  </button>
                  {a.download_url ? (
                    <a href={a.download_url} className="file-x" title="Download"><I.Download size={14} /></a>
                  ) : (
                    <button type="button" className="file-x" title="Download unavailable" disabled><I.Download size={14} /></button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20 }}>
        <section className="card">
          <div className="card-head">
            <h3>Recent jobs</h3>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={(e) => go(e, "queue")}>See all <I.Chevron size={12} /></button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 96 }}>Job</th>
                <th>Description</th>
                <th style={{ width: 130 }}>Type</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 110 }}>When</th>
                <th style={{ width: 130 }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.slice(0, 6).map((j) => {
                const meta = intentMeta(j.intent);
                const Icon = I[meta.ico];
                const statusCls = j.status === "completed" || j.status === "succeeded" ? "done" : j.status;
                const artifactCount = Number(j.artifacts_count || getArtifactsForRun(j.run_id).length || 0);
                return (
                  <tr
                    key={j.run_id}
                    className="row"
                    onClick={() => onOpenJob && onOpenJob(j)}
                    title="Open run details and artifacts"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && onOpenJob) {
                        e.preventDefault();
                        onOpenJob(j);
                      }
                    }}
                  >
                    <td className="mono">{j.run_id}</td>
                    <td>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380 }}>{j.run_name}</div>
                      <div className="dim mono" style={{ fontSize: 10.5 }}>{j.version_label || "v1.0"}</div>
                    </td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={13} /> {meta.name}</span></td>
                    <td><span className={"pill " + statusCls}><span className="dot" /> {j.status}</span></td>
                    <td className="dim mono" style={{ fontSize: 11.5 }}>{j.when}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {artifactCount > 0 && getArtifactsForRun(j.run_id)[0]?.download_url ? (
                        <a
                          href={getArtifactsForRun(j.run_id)[0].download_url}
                          onClick={(e) => e.stopPropagation()}
                          className="mono"
                          title="Download latest artifact"
                        >
                          {j.eta} · {artifactCount} files
                        </a>
                      ) : (
                        <span>{j.eta}{artifactCount > 0 ? ` · ${artifactCount} files` : ""}</span>
                      )}
                    </td>
                  </tr>);
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>);
}

function Toast({ show, title, body, onClose }) {
  return (
    <div className={cls("toast", show && "show")} role="status">
      <div className="toast-ico"><I.Telegram size={14} /></div>
      <div style={{ flex: 1 }}>
        <div className="toast-title">{title}</div>
        <div className="toast-body">{body}</div>
      </div>
      <button onClick={onClose} className="ico-btn" style={{ width: 22, height: 22 }}><I.X size={12} /></button>
    </div>);
}

function ArtifactPreviewModal({ open, artifact, loading, error, data, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(10,10,10,.55)",
      zIndex: 90,
      display: "grid",
      placeItems: "center",
      padding: 20,
    }}>
      <div className="card" style={{ width: "min(1000px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="card-head">
          <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artifact?.name || "Artifact preview"}</h3>
          <span className="pill mono" style={{ marginLeft: 8 }}>{artifact?.mime_type || fileExt(artifact?.name || "")}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}><I.X size={12} /> Close</button>
        </div>
        <div className="card-pad" style={{ overflow: "auto", minHeight: 360 }}>
          {loading && <div className="dim mono">Loading preview…</div>}
          {!loading && error && <div className="mono" style={{ color: "var(--err)" }}>{error}</div>}
          {!loading && !error && (
            <pre className="logblock" style={{ whiteSpace: "pre-wrap", margin: 0, minHeight: 280 }}>
              {data?.content || "(No preview content)"}
            </pre>
          )}
          {!loading && data?.truncated && (
            <div className="dim mono" style={{ marginTop: 8, fontSize: 11 }}>
              Preview truncated. Download full file for complete content.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function initialRouteFromUrl() {
  const allowed = new Set(["home", "new", "active", "queue", "detail", "integrations", "settings"]);
  try {
    const url = new URL(window.location.href);
    const requested = String(url.searchParams.get("route") || "").trim();
    if (requested === "detail" && !String(url.searchParams.get("run_id") || "").trim()) return "home";
    return allowed.has(requested) ? requested : "home";
  } catch (_) {
    return "home";
  }
}

function initialRunIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("run_id") || "").trim();
  } catch (_) {
    return "";
  }
}

function App() {
  const [route, setRoute] = useState(initialRouteFromUrl);
  const [openJob, setOpenJob] = useState(null);
  const [newDraft, setNewDraft] = useState(null);
  const [toast, setToast] = useState({ show: false, title: "", body: "" });
  const [preview, setPreview] = useState({
    open: false,
    artifact: null,
    loading: false,
    error: "",
    data: null,
  });
  const [apiKey, setApiKey] = useState(localStorage.getItem("sf_api_key") || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [tweaks, setTweak] = (window.useTweaks || ((d) => [d, () => {}]))(window.__TWEAKS__);
  const runsRefreshInFlight = React.useRef(false);
  const detailRefreshInFlight = React.useRef(false);
  const systemRefreshInFlight = React.useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.accent = tweaks.accent;
  }, [tweaks.theme, tweaks.accent]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (route === "home") {
        url.searchParams.delete("route");
        url.searchParams.delete("run_id");
      } else {
        url.searchParams.set("route", route);
        if (route === "detail" && openJob?.run_id) {
          url.searchParams.set("run_id", openJob.run_id);
        } else if (route !== "detail") {
          url.searchParams.delete("run_id");
        }
      }
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}
  }, [route, openJob?.run_id]);

  const showToast = (title, body) => {
    setToast({ show: true, title, body });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4500);
  };

  const rerender = () => setVersion((v) => v + 1);
  const _bumpVersionLabel = (name) => {
    const raw = String(name || "").trim();
    if (!raw) return "v1";
    const match = raw.match(/(?:^|\s)v(\d+(?:\.\d+)*)\s*$/i);
    if (match) {
      const parts = match[1].split(".").map((n) => Number(n)).filter((n) => Number.isFinite(n));
      if (parts.length) {
        parts[parts.length - 1] += 1;
        return raw.replace(/(?:^|\s)v(\d+(?:\.\d+)*)\s*$/i, ` v${parts.join(".")}`).trim();
      }
    }
    return `${raw} v1.1`;
  };
  const clickRoute = (e, next) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRoute(next);
  };

  async function refreshRunDetail(runId) {
    if (!runId) return;
    if (detailRefreshInFlight.current) return;
    detailRefreshInFlight.current = true;
    try {
      const run = await Api.getRun(runId);
      const logs = await Api.getRunLogs(runId, 120);
      const art = await Api.getArtifacts(runId);
      applyRunDetail(run, logs, art.artifacts || []);
      rerender();
    } catch (e) {
      showToast("Run detail refresh failed", String(e.message || e));
    } finally {
      detailRefreshInFlight.current = false;
    }
  }

  async function refreshRuns() {
    if (runsRefreshInFlight.current) return;
    runsRefreshInFlight.current = true;
    try {
      const list = await Api.listRuns(50);
      const runs = list.runs || [];
      applyRuns(runs);
      const requestedDetailRunId = route === "detail" ? initialRunIdFromUrl() : "";
      if (requestedDetailRunId && !openJob) {
        const detailJob = (window.QUEUE || []).find((j) => j.run_id === requestedDetailRunId);
        if (detailJob) {
          setOpenJob(detailJob);
          await refreshRunDetail(requestedDetailRunId);
          return;
        }
      }
      if (runs.length > 0) {
        const candidate = runs.find((r) => r.status === "running") || runs[0];
        const shouldFetchDetail =
          candidate.status === "running" ||
          route === "active" ||
          route === "detail";
        if (shouldFetchDetail) {
          await refreshRunDetail(candidate.run_id);
        } else {
          rerender();
        }
      } else {
        rerender();
      }
    } catch (e) {
      showToast("Run list refresh failed", String(e.message || e));
    } finally {
      runsRefreshInFlight.current = false;
    }
  }

  async function refreshSystem(silent = true) {
    if (systemRefreshInFlight.current) return;
    systemRefreshInFlight.current = true;
    try {
      const results = await Promise.allSettled([
        Api.health(),
        Api.getIntegrations(),
        Api.getMe(),
        Api.getWorkerStatus(),
        Api.getUiConfig(),
      ]);
      const [healthRes, integrationsRes, meRes, workerRes, uiCfgRes] = results;
      const health = healthRes.status === "fulfilled" ? healthRes.value : null;
      const integrations = integrationsRes.status === "fulfilled" ? integrationsRes.value : null;
      const me = meRes.status === "fulfilled" ? meRes.value : null;
      const workerStatus = workerRes.status === "fulfilled" ? workerRes.value : null;
      const uiConfig = uiCfgRes.status === "fulfilled" ? uiCfgRes.value : null;

      if (health || integrations || me || workerStatus) {
        applyRuntime({ health, integrations, me, workerStatus });
        if (uiConfig) applyUiConfig(uiConfig);
        rerender();
        return;
      }

      if (!silent) {
        const err = healthRes.status === "rejected"
          ? healthRes.reason
          : integrationsRes.status === "rejected"
            ? integrationsRes.reason
            : meRes.status === "rejected"
              ? meRes.reason
              : workerRes.status === "rejected"
                ? workerRes.reason
                : uiCfgRes.status === "rejected"
                  ? uiCfgRes.reason
                  : new Error("Unknown runtime refresh failure");
        showToast("Backend runtime refresh failed", String(err.message || err));
      }
    } finally {
      systemRefreshInFlight.current = false;
    }
  }

  useEffect(() => {
    const s = document.getElementById("splash");
    if (s) { s.classList.add("hide"); setTimeout(() => s.remove(), 350); }
    refreshRuns();
    refreshSystem(false);
    const runsTimer = setInterval(refreshRuns, 10000);
    const sysTimer = setInterval(() => refreshSystem(true), 20000);
    return () => {
      clearInterval(runsTimer);
      clearInterval(sysTimer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("sf_api_key", apiKey || "");
    window.__SF_API_KEY = apiKey || "";
  }, [apiKey]);

  const handleDispatch = async (cfg) => {
    try {
      const localFiles = (cfg.inputs || []).map((x) => x._file).filter(Boolean);
      const knowledgeFiles = (cfg.knowledge_inputs || []).map((x) => x._file).filter(Boolean);
      let fileIds = [];
      let knowledgeFileIds = [];
      if (localFiles.length > 0) {
        const uploaded = await Api.uploadFiles(localFiles);
        fileIds = uploaded.map((f) => f.file_id);
      }
      if (knowledgeFiles.length > 0) {
        const uploadedKnowledge = await Api.uploadFiles(knowledgeFiles);
        knowledgeFileIds = uploadedKnowledge.map((f) => f.file_id);
      }
      const c = cfg.config || {};
      const defaults = UI_RUNTIME?.ui_config?.defaults || {};
      const standingInstruction = String(UI_RUNTIME?.ui_config?.standing_instruction || "");
      const knowledgeBaseNotes = String(UI_RUNTIME?.ui_config?.knowledge_base_notes || "");
      const payload = {
        intent: c.intent || "memo_only",
        audience: c.audience || defaults.audience || "credit_committee",
        route_mode: c.route_mode || defaults.route_mode || "auto",
        workers: Array.isArray(c.target_workers) ? c.target_workers : [],
        manager_instruction: c.manager_instruction || "",
        post_credit: c.post_credit || defaults.post_credit || "stop",
        human_gate: c.human_gate || defaults.human_gate || "approve",
        autonomous: c.autonomous !== false,
        fast: c.fast === true,
        skip_preflight: c.skip_preflight === true,
        no_web_research: c.no_web_research === true,
        file_ids: fileIds,
        text: cfg.text_input || "",
        sample: fileIds.length === 0 && !(cfg.text_input || "").trim(),
        run_name: cfg.run_name || "",
        standing_instruction: standingInstruction,
        knowledge_base_notes: knowledgeBaseNotes,
        output_formats: Array.isArray(c.output_formats) ? c.output_formats : [],
        report_length_words: Number(c.report_length_words || 0),
        report_format: String(c.report_format || ""),
        sop_format: String(c.sop_format || ""),
        credit_decision_mode: String(c.credit_decision_mode || "analysis_only"),
        credit_thresholds: c.credit_thresholds || {},
        condition_precedents: String(c.condition_precedents || ""),
        adhoc_criteria: String(c.adhoc_criteria || ""),
        market_intel_instruction: String(c.market_intel_instruction || ""),
        structured_output_instruction: String(c.structured_output_instruction || ""),
        rag_instruction: String(c.rag_instruction || ""),
        output_template_id: String(c.output_template_id || ""),
        knowledge_file_ids: knowledgeFileIds,
        custom_intent: String(c.custom_intent || ""),
        drive_source_link: String(c.drive_source_link || ""),
        onedrive_source_link: String(c.onedrive_source_link || ""),
        extra_thresholds: Array.isArray(c.extra_thresholds) ? c.extra_thresholds : [],
        llm_provider: String(c.llm_provider || ""),
        llm_model: String(c.llm_model || c.provider || ""),
        llm_base_url: String(c.llm_base_url || ""),
        timeout_sec: Number(c.timeout_sec || 0),
        scheduled_at: String(c.scheduled_at || ""),
      };
      const created = await Api.createRun(payload);
      const scheduled = created.status === "scheduled";
      showToast(
        (scheduled ? "Run scheduled · " : "Run dispatched · ") + created.run_id,
        scheduled ? `Scheduled for ${created.scheduled_at || c.scheduled_at}` : "Sent to local worker"
      );
      setRoute(scheduled ? "queue" : "active");
      await refreshRuns();
      await refreshRunDetail(created.run_id);
    } catch (e) {
      showToast("Dispatch failed", String(e.message || e));
    }
  };

  const handleOpenJob = async (job) => {
    setOpenJob(job);
    setRoute("detail");
    await refreshRunDetail(job.run_id);
    const fresh = (window.QUEUE || []).find((j) => j.run_id === job.run_id);
    if (fresh) setOpenJob(fresh);
  };

  const handleRerun = async (runId) => {
    try {
      const created = await Api.rerunRun(runId);
      showToast("Rerun queued · " + created.run_id, "Using same input + config");
      setRoute("active");
      await refreshRuns();
      await refreshRunDetail(created.run_id);
    } catch (e) {
      showToast("Rerun failed", String(e.message || e));
    }
  };

  const handleSaveUiConfig = async (nextConfig) => {
    try {
      const resp = await Api.putUiConfig(nextConfig);
      applyUiConfig(resp.ui_config || nextConfig);
      showToast("Settings saved", "Production configuration updated");
      await refreshSystem(true);
    } catch (e) {
      showToast("Save settings failed", String(e.message || e));
    }
  };

  const handleTestIntegration = async (provider) => {
    try {
      const resp = await Api.testIntegration(provider);
      const state = resp.status || (resp.ok ? "ready" : "not ready");
      showToast(`Test ${provider}: ${state}`, resp.ok ? "Connection looks good" : "Please review credentials/settings");
      await refreshSystem(true);
    } catch (e) {
      showToast(`Test ${provider} failed`, String(e.message || e));
    }
  };

  const handleControl = async (action, runId) => {
    try {
      const targetRunId = runId || ACTIVE_RUN.run_id;
      await Api.control(action, targetRunId);
      showToast(`Control sent: ${action}`, targetRunId ? `run ${targetRunId}` : "global control");
      await refreshRuns();
      if (targetRunId) await refreshRunDetail(targetRunId);
    } catch (e) {
      showToast(`Control failed: ${action}`, String(e.message || e));
    }
  };

  const handleDuplicate = async (runId) => {
    try {
      const run = await Api.getRun(runId);
      setNewDraft({
        run_id: run.run_id,
        request: {
          ...(run.request || {}),
          run_name: _bumpVersionLabel((run.request || {}).run_name || run.run_name || run.run_id),
        },
        inputs: run.inputs || [],
      });
      setRoute("new");
      showToast("Draft loaded", "Edit settings and dispatch a new run");
    } catch (e) {
      showToast("Duplicate failed", String(e.message || e));
    }
  };

  const handlePauseAndEdit = async (runId) => {
    try {
      await handleControl("pause", runId);
      await handleDuplicate(runId);
    } catch (e) {
      showToast("Pause/edit failed", String(e.message || e));
    }
  };

  const handlePreviewArtifact = async (artifact) => {
    if (!artifact || !artifact.run_id || !artifact.name) return;
    setPreview({ open: true, artifact, loading: true, error: "", data: null });
    try {
      const data = await Api.getArtifactPreview(artifact.run_id, artifact.name);
      setPreview({ open: true, artifact, loading: false, error: "", data });
    } catch (e) {
      setPreview({
        open: true,
        artifact,
        loading: false,
        error: String(e.message || e),
        data: null,
      });
    }
  };

  const runningCount = QUEUE.filter((j) => j.status === "running").length;
  const queuedCount = QUEUE.filter((j) => j.status === "queued").length;
  const latestRun = QUEUE[0] || null;
  const latestArtifact = RECENT_ARTIFACTS[0] || null;
  const activeArtifacts = getArtifactsForRun(ACTIVE_RUN.run_id);
  const openJobArtifacts = openJob ? getArtifactsForRun(openJob.run_id) : [];

  const crumbs = {
    home: [["Workspace"], ["Dashboard", true]],
    new: [["Workspace"], ["New run", true]],
    active: [["Workspace"], ["Active"], [ACTIVE_RUN.run_id, true]],
    queue: [["Workspace"], ["Queue & history", true]],
    detail: [["Workspace"], ["Queue"], [openJob?.run_id || "—", true]],
    integrations: [["Configuration"], ["Integrations", true]],
    settings: [["Configuration"], ["Settings", true]]
  }[route] || [];

  return (
    <div className="app" data-ver={version}>
      <Sidebar route={route} setRoute={(r) => { setRoute(r); setOpenJob(null); }}
      runningCount={runningCount} queuedCount={queuedCount} runtime={UI_RUNTIME} />

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            {crumbs.map(([txt, last], i) =>
            <React.Fragment key={i}>
                {last ? <b>{txt}</b> : <span>{txt}</span>}
                {i < crumbs.length - 1 && <span className="crumb-sep">/</span>}
              </React.Fragment>
            )}
          </div>
          <div className="topbar-spacer" />
          <input
            className="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, files, prompts…"
          />
          <input className="search mono" style={{ maxWidth: 180 }} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="x-sf-api-key (optional)" />
          <button type="button" className="ico-btn" onClick={(e) => { e.preventDefault(); refreshRuns(); }} title="Refresh"><I.Refresh size={16} /></button>
          <button type="button" className="ico-btn" onClick={(e) => { e.preventDefault(); setTweak("theme", tweaks.theme === "dark" ? "light" : "dark"); }} title="Toggle theme">
            {tweaks.theme === "dark" ? <I.Sun size={16} /> : <I.Moon size={16} />}
          </button>
          <div style={{ width: 1, height: 22, background: "var(--line)", marginLeft: 4, marginRight: 4 }} />
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", color: "var(--accent-fg)",
            display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 11, backgroundColor: "rgb(255, 91, 58)" }}>SF</div>
        </header>

        <div className="content">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-pad" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={(e) => clickRoute(e, "new")}><I.Plus size={12} /> New run</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); latestRun && handleRerun(latestRun.run_id); }} disabled={!latestRun}>
                <I.Refresh size={12} /> Re-run latest
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => clickRoute(e, "queue")}><I.List size={12} /> Queue</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => clickRoute(e, "integrations")}><I.Plug size={12} /> Integrations</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => clickRoute(e, "settings")}><I.Settings size={12} /> Defaults</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); latestArtifact && handlePreviewArtifact(latestArtifact); }} disabled={!latestArtifact}>
                <I.Eye size={12} /> Preview latest
              </button>
              <span style={{ marginLeft: "auto" }} className="dim mono">
                {runningCount} running · {queuedCount} queued
              </span>
            </div>
          </div>
          <ScreenErrorBoundary>
            {route === "home" && <Dashboard setRoute={setRoute} onOpenJob={handleOpenJob} onPreviewArtifact={handlePreviewArtifact} searchQuery={searchQuery} />}
            {route === "new" && <NewJob onSubmit={handleDispatch} runtime={UI_RUNTIME} initialDraft={newDraft} />}
            {route === "active" && <ActiveJob run={ACTIVE_RUN} artifacts={activeArtifacts} onControl={handleControl} onPauseEdit={handlePauseAndEdit} onPreviewArtifact={handlePreviewArtifact} />}
            {route === "queue" && <Queue onOpen={handleOpenJob} searchQuery={searchQuery} />}
            {route === "detail" && openJob && <JobDetail job={openJob} artifacts={openJobArtifacts} onBack={() => setRoute("queue")} onRerun={handleRerun} onDuplicate={handleDuplicate} onControl={handleControl} onPauseEdit={handlePauseAndEdit} onPreviewArtifact={handlePreviewArtifact} onOpenJob={handleOpenJob} />}
            {route === "integrations" && <Integrations runtime={UI_RUNTIME} onSaveConfig={handleSaveUiConfig} onTest={handleTestIntegration} />}
            {route === "settings" && <Settings runtime={UI_RUNTIME} onSaveConfig={handleSaveUiConfig} />}
          </ScreenErrorBoundary>
        </div>
      </div>

      <Toast {...toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      <ArtifactPreviewModal
        open={preview.open}
        artifact={preview.artifact}
        loading={preview.loading}
        error={preview.error}
        data={preview.data}
        onClose={() => setPreview({ open: false, artifact: null, loading: false, error: "", data: null })}
      />

      {window.TweaksPanel &&
      <TweaksPanel title="Tweaks">
          <TweakSection title="Theme">
            <TweakRadio
            label="Mode"
            value={tweaks.theme}
            onChange={(v) => setTweak("theme", v)}
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
          </TweakSection>
          <TweakSection title="Accent color">
            <TweakRadio
            label="Hue"
            value={tweaks.accent}
            onChange={(v) => setTweak("accent", v)}
            options={[
            { value: "lime", label: "Lime" },
            { value: "orange", label: "Orange" },
            { value: "violet", label: "Violet" },
            { value: "cyan", label: "Cyan" },
            { value: "rose", label: "Rose" }]
            } />
          </TweakSection>
        </TweaksPanel>
      }
    </div>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
