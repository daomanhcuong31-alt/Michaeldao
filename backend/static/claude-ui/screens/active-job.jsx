function Stat({ label, value }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 2, fontFeatureSettings: '"tnum"' }}>{value}</div>
    </div>
  );
}

function ActiveJob({ run, artifacts = [], onControl, onPauseEdit, onPreviewArtifact }) {
  const [progress, setProgress] = React.useState(run.progress_percent || 0);
  const [completedSteps, setCompleted] = React.useState([...(run.completed_steps || [])]);
  const [currentAgent, setCurrent] = React.useState(run.current_agent || "");
  const [log, setLog] = React.useState([...(run.log || [])]);

  React.useEffect(() => {
    setProgress(run.progress_percent || 0);
    setCompleted([...(run.completed_steps || [])]);
    setCurrent(run.current_agent || "");
    setLog([...(run.log || [])]);
  }, [run]);

  const workers = run.planned_workers;
  const intentMeta_ = intentMeta(run.config?.intent || "memo_only");

  return (
    <div data-screen-label="02 Active Run">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div className="mono dim" style={{ fontSize: 11, letterSpacing: "0.08em" }}>RUN · {run.run_id}</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{run.run_name}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span className={"pill " + (run.status === "succeeded" ? "done" : run.status === "failed" ? "failed" : "running")}><span className="dot"/> {run.status || "running"}</span>
            <span className="pill"><I.Brain size={11}/> {run.route_mode}</span>
            <span className="pill">{intentMeta_.name}</span>
            {run.manager_plan?.reason && (
              <span className="dim mono" style={{ fontSize: 11 }}>plan: {run.manager_plan.reason}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onControl && onControl("pause", run.run_id)}><I.Pause size={12}/> Pause</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPauseEdit && onPauseEdit(run.run_id)}><I.Pencil size={12}/> Pause & edit</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onControl && onControl("resume", run.run_id)}><I.Play size={12}/> Resume</button>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--err)" }} onClick={() => onControl && onControl("cancel_current_run", run.run_id)}><I.Stop size={12}/> Cancel</button>
        </div>
      </div>

      {/* Progress hero */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div>
            <div className="mono dim" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              current agent
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 3 }}>
              {workerMeta(currentAgent).label}
              <span className="muted" style={{ fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
                — {workerMeta(currentAgent).desc}
              </span>
            </div>
          </div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em" }}>
            {Math.round(progress)}<span className="dim" style={{ fontSize: 18 }}>%</span>
          </div>
        </div>
        <div className="progress"><div className="progress-bar" style={{ width: progress + "%" }}/></div>
        <div className="mono dim" style={{ fontSize: 11, marginTop: 8 }}>
          {completedSteps.length}/{workers.length} workers done
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        {/* Worker trace */}
        <section className="card">
          <div className="card-head">
            <h3>Worker pipeline</h3>
            <span className="dim mono" style={{ fontSize: 11, marginLeft: "auto" }}>
              {run.manager_plan?.mode || "auto"} mode
            </span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1.4s ease-in-out infinite", marginLeft: 6 }}/>
          </div>
          <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
            <div className="trace">
              {workers.map((wid, i) => {
                const isDone    = completedSteps.includes(wid);
                const isRunning = currentAgent === wid && !isDone;
                const status    = isDone ? "done" : isRunning ? "running" : "pending";
                const w         = workerMeta(wid);
                return (
                  <div className={cls("trace-step", status)} key={wid}>
                    <span className="trace-marker" style={{ position: "relative" }}>
                      {isDone ? <I.Check size={12}/> : (i+1)}
                    </span>
                    <div className="trace-body">
                      <div className="trace-title">{w.label}</div>
                      <div className="trace-detail">{w.desc}</div>
                    </div>
                    <span className={"pill " + (isDone ? "done" : isRunning ? "running" : "")}>
                      <span className="dot"/>
                      {isDone ? "done" : isRunning ? "running" : "waiting"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gate decision */}
          {run.quality_gate_decision && (
            <div className="card-pad" style={{ borderTop: "1px dashed var(--line)", paddingTop: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: "var(--warn)" }}><I.Eye size={16}/></span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>Quality gate: {run.quality_gate_decision}</div>
                  <div className="dim mono" style={{ fontSize: 11 }}>human_gate=approve required</div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}><I.Check size={12}/> Approve</button>
              </div>
            </div>
          )}

          {/* Error alert */}
          {run.last_error && (
            <div className="card-pad" style={{
              borderTop: "1px dashed var(--line)",
              background: "color-mix(in oklab, var(--err) 6%, var(--bg-1))",
              borderColor: "color-mix(in oklab, var(--err) 30%, var(--line))"
            }}>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "var(--err)" }}><I.X size={16}/></span>
                <div className="mono" style={{ fontSize: 12 }}>{run.last_error}</div>
              </div>
            </div>
          )}

          {(["succeeded", "completed"].includes(String(run.status || "")) && artifacts.length > 0) && (
            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-head">
                <h3>Ready artifacts</h3>
                <span className="pill done" style={{ marginLeft: "auto" }}><span className="dot"/> {artifacts.length}</span>
              </div>
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {artifacts.map((a, i) => (
                  <div className="file-row" key={i}>
                    <div className="file-ico">{fileExt(a.name)}</div>
                    <div className="file-meta">
                      <div className="file-name">{a.name}</div>
                      <div className="file-size">{fmtBytes(a.size_bytes)} · {a.kind || "output"}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPreviewArtifact && onPreviewArtifact(a)}><I.Eye size={12} /></button>
                      {a.download_url ? <a href={a.download_url} className="btn btn-ghost btn-sm"><I.Download size={12} /></a> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none" }}>
            <h3>Live log</h3>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}
              onClick={() => navigator.clipboard && navigator.clipboard.writeText((log || []).map((l) => `[${l.ts}] ${l.level.toUpperCase()} ${l.msg}`).join("\n"))}>
              <I.Copy size={12}/> Copy
            </button>
          </div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            <div className="logblock">
              {log.map((l, i) => (
                <div key={i}>
                  <span className="l-ts">[{l.ts}]</span>{" "}
                  <span className={"l-" + l.level}>{l.level.toUpperCase().padEnd(4)}</span>{" "}
                  {l.msg}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head"><h3>Inputs</h3><span className="dim mono" style={{ marginLeft: "auto", fontSize: 11 }}>{run.inputs.length} items</span></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {run.inputs.map((f, i) => (
                <div className="file-row" key={i}>
                  <div className="file-ico">{f.source === "google_drive" ? "DRV" : fileExt(f.name)}</div>
                  <div className="file-meta">
                    <div className="file-name">{f.name}</div>
                    <div className="file-size">{fmtBytes(f.size_bytes)} · {f.source}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3>Config</h3></div>
            <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Stat label="Provider"  value={run.config?.provider || "lm_studio"} />
              <Stat label="Intent"    value={run.config?.intent || "—"} />
              <Stat label="Audience"  value={run.config?.audience || "—"} />
              <Stat label="Timeout"   value={(run.config?.timeout_sec || 1800) + "s"} />
              <Stat label="Tokens"    value={Number(run.tokens?.total || run.tokens?.in || 0) > 0 ? Number(run.tokens.total || run.tokens.in || 0).toLocaleString() : "—"} />
              <Stat label="Cloud USD" value={Number(run.cost_usd || 0) > 0 ? `$${Number(run.cost_usd).toFixed(2)}` : "—"} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.Stat = Stat;
window.ActiveJob = ActiveJob;
