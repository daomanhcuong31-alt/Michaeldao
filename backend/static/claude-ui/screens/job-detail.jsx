function JobDetail({ job, artifacts = [], onBack, onRerun, onDuplicate, onControl, onPauseEdit, onPreviewArtifact, onOpenJob }) {
  const meta  = intentMeta(job.intent || "memo_only");
  const Icon  = I[meta.ico];
  const req = job.request || {};
  const isDone   = ["completed", "succeeded"].includes(String(job.status || ""));
  const isFailed = job.status === "failed";
  const outputArtifacts = artifacts.length ? artifacts : getArtifactsForRun(job.run_id);
  const versionLabel = job.version_label || outputArtifacts[0]?.version_label || "v1.0";
  const lineageRoot = job.lineage_root_run_id || job.source_run_id || job.run_id;
  const versionRank = (label) => String(label || "v0")
    .replace(/^v/i, "")
    .split(".")
    .map((n) => Number(n) || 0)
    .reduce((acc, n, idx) => acc + n / Math.pow(1000, idx), 0);
  const versionHistory = (QUEUE || [])
    .filter((j) => {
      const root = j.lineage_root_run_id || j.source_run_id || j.run_id;
      return root === lineageRoot || j.run_id === lineageRoot || j.run_id === job.run_id;
    })
    .sort((a, b) => versionRank(b.version_label) - versionRank(a.version_label) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const detailRun = ACTIVE_RUN.run_id === job.run_id
    ? ACTIVE_RUN
    : {
        planned_workers: [],
        log: [],
        inputs: [],
        last_error: job.error || "",
        config: {},
      };
  const plannedWorkers = detailRun.planned_workers && detailRun.planned_workers.length
    ? detailRun.planned_workers
    : ["ingestion", "market_intel", "analysis_parallel", "memo_architect"];

  return (
    <div data-screen-label="04 Run Detail">
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 14 }}>
        <I.Chevron size={12} style={{ transform: "rotate(180deg)" }}/> Back to queue
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <div className="mono dim" style={{ fontSize: 11, letterSpacing: "0.08em" }}>RUN · {job.run_id}</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{job.run_name}</h1>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span className={"pill " + (job.status === "completed" ? "done" : job.status)}>
              <span className="dot"/> {job.status}
            </span>
            <span className="pill"><Icon size={11}/> {meta.name}</span>
            <span className="pill mono" style={{ fontSize: 10.5 }}>{versionLabel}</span>
            <span className="pill mono" style={{ fontSize: 10.5 }}>{job.route_mode}</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{job.when} · {job.eta}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onRerun && onRerun(job.run_id)}><I.Refresh size={12}/> Re-run</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onDuplicate && onDuplicate(job.run_id)}><I.Copy size={12}/> Duplicate</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPauseEdit && onPauseEdit(job.run_id)}><I.Pencil size={12}/> Pause & edit</button>
          {isDone && outputArtifacts[0]?.download_url && (
            <a className="btn btn-primary btn-sm" href={outputArtifacts[0].download_url}>
              <I.Download size={12}/> Download latest
            </a>
          )}
        </div>
      </div>

      {isFailed && (
        <div className="card card-pad" style={{ marginBottom: 16,
          borderColor: "color-mix(in oklab, var(--err) 30%, var(--line))",
          background: "color-mix(in oklab, var(--err) 6%, var(--bg-1))" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: "var(--err)" }}><I.X size={18}/></span>
            <div>
              <div style={{ fontWeight: 500 }}>Run failed · {job.eta}</div>
              <div className="dim mono" style={{ fontSize: 11.5, marginTop: 4 }}>
                {detailRun.last_error || "Unexpected error — check the log below"}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => onRerun && onRerun(job.run_id)}><I.Refresh size={12}/> Retry</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {isDone && (
            <section className="card">
              <div className="card-head">
                <h3>Output artifacts</h3>
                <span className="pill done" style={{ marginLeft: "auto" }}><span className="dot"/> {outputArtifacts.length} files · uploaded</span>
              </div>
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {outputArtifacts.length === 0 && (
                  <div className="dim mono" style={{ fontSize: 11 }}>
                    No artifacts recorded for this run yet.
                  </div>
                )}
                {outputArtifacts.map((a, i) => {
                  const invalid = a.path_status === "empty" || a.validation_status === "invalid_empty" || Number(a.size_bytes || 0) === 0;
                  return (
                    <div className="file-row" key={i}>
                      <div className="file-ico">{fileExt(a.name)}</div>
                      <div className="file-meta">
                        <div className="file-name">{a.name}</div>
                        <div className="file-size">
                          {fmtBytes(a.size_bytes)} · {a.kind} · {a.version_label || a.version || versionLabel}
                          {invalid ? " · EMPTY OUTPUT - review run log" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onPreviewArtifact && onPreviewArtifact(a)} title={invalid ? "Preview empty artifact" : "Preview artifact"}><I.Eye size={12}/></button>
                        {a.download_url ? (
                          <a href={a.download_url} className="btn btn-ghost btn-sm" title="Download artifact"><I.Download size={12}/></a>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-sm" title="Download unavailable" disabled><I.Download size={12}/></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h3>Worker pipeline</h3></div>
            <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 6 }}>
              <div className="trace">
                {plannedWorkers.map((wid, i) => {
                  const w = workerMeta(wid);
                  const status = isDone ? "done" : (isFailed && i >= 2 ? "failed" : "done");
                  return (
                    <div className={cls("trace-step", status)} key={wid}>
                      <span className="trace-marker">
                        {status === "done" ? <I.Check size={12}/> : status === "failed" ? <I.X size={12}/> : (i+1)}
                      </span>
                      <div className="trace-body">
                        <div className="trace-title">{w.label}</div>
                        <div className="trace-detail">{w.desc}</div>
                      </div>
                      <span className={"pill " + (status === "done" ? "done" : status === "failed" ? "failed" : "")}>
                        <span className="dot"/> {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3>Full log</h3></div>
            <div className="card-pad">
              <div className="logblock">
                {(detailRun.log || []).map(({ ts, level, msg }, i) => (
                  <div key={i}><span className="l-ts">[{ts}]</span> <span className={"l-" + level}>{level.toUpperCase().padEnd(4)}</span> {msg}</div>
                ))}
                {isDone   && <div><span className="l-ts">[done]</span> <span className="l-ok">OK  </span> artifacts uploaded · run complete</div>}
                {isFailed && <div><span className="l-ts">[err]</span>  <span className="l-err">ERR </span> {detailRun.last_error || "halting"}</div>}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card">
            <div className="card-head"><h3>Run config</h3></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
              {[
                ["Intent",       meta.name],
                ["Route mode",   job.route_mode],
                ["Provider",     req.llm_provider || detailRun?.config?.provider || "lm_studio"],
                ["Audience",     req.audience || detailRun?.config?.audience || "credit_committee"],
                ["Human gate",   req.human_gate || "approve"],
                ["Post credit",  req.post_credit || "stop"],
                ["Autonomous",   req.autonomous === false ? "no" : "yes"],
              ].map(([k,v]) => (
                <div key={k} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8 }}>
                  <span className="dim mono" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Version history</h3>
              <span className="dim mono" style={{ marginLeft: "auto", fontSize: 11 }}>{versionHistory.length || 1} version{(versionHistory.length || 1) === 1 ? "" : "s"}</span>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(versionHistory.length ? versionHistory : [job]).map((v) => {
                const versionArtifacts = getArtifactsForRun(v.run_id);
                const latestArtifact = versionArtifacts.find((a) => a.download_url) || versionArtifacts[0];
                const current = v.run_id === job.run_id;
                return (
                  <div className="file-row" key={v.run_id} style={{ alignItems: "flex-start" }}>
                    <div className="file-ico">{v.version_label || "v1.0"}</div>
                    <div className="file-meta">
                      <div className="file-name" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {v.run_name || v.run_id}
                        {current && <span className="pill done"><span className="dot"/> current</span>}
                      </div>
                      <div className="file-size">
                        {v.status} · {v.when || "—"} · {v.artifacts_count || versionArtifacts.length || 0} files
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="file-x"
                        title="Open this version"
                        disabled={current}
                        onClick={() => onOpenJob && onOpenJob(v)}
                      >
                        <I.Chevron size={14}/>
                      </button>
                      {latestArtifact?.download_url ? (
                        <a href={latestArtifact.download_url} className="file-x" title="Download latest artifact for this version"><I.Download size={14}/></a>
                      ) : (
                        <button type="button" className="file-x" title="No artifact for this version" disabled><I.Download size={14}/></button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="dim mono" style={{ fontSize: 10.5 }}>
                Version names use v1.0, v1.1, v1.2 style lineage. Use rerun for controlled version bumps.
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h3>Inputs</h3></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(detailRun.inputs || []).map((f, i) => (
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
            <div className="card-head"><h3>Controls</h3></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onControl && onControl("send_latest_report", job.run_id)}>
                <I.Send size={13}/> Send latest report
              </button>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onRerun && onRerun(job.run_id)}>
                <I.Refresh size={13}/> Re-run with same config
              </button>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onDuplicate && onDuplicate(job.run_id)}>
                <I.Copy size={13}/> Duplicate & edit
              </button>
              {!isDone && !isFailed && (
                <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", color: "var(--err)" }} onClick={() => onControl && onControl("cancel_current_run", job.run_id)}>
                  <I.Stop size={13}/> Cancel run
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

window.JobDetail = JobDetail;
