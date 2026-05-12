function Queue({ onOpen, searchQuery = "" }) {
  const [filter, setFilter] = React.useState("all");
  const query = String(searchQuery || "").trim().toLowerCase();
  const matchesQuery = (j) => {
    if (!query) return true;
    const artifactNames = (j.artifacts || []).map((a) => a.name).join(" ");
    return [j.run_id, j.run_name, j.intent, j.route_mode, j.status, j.version_label, artifactNames]
      .join(" ")
      .toLowerCase()
      .includes(query);
  };
  const filtered = QUEUE.filter(j => (filter === "all" || j.status === filter) && matchesQuery(j));
  const localTokens = QUEUE.reduce((sum, j) => sum + Number(j.tokens?.total || j.tokens?.in || 0), 0);
  const cloudUsd = QUEUE.reduce((sum, j) => sum + Number(j.cost_usd || 0), 0);
  const completedCount = QUEUE.filter(j => j.status === "completed").length;
  const failedCount = QUEUE.filter(j => j.status === "failed").length;
  const successRate = QUEUE.length ? Math.round((completedCount / QUEUE.length) * 100) : 0;
  const artifactCount = QUEUE.reduce((sum, j) => sum + Number(j.artifacts_count || 0), 0);
  const exportCsv = () => {
    const cols = ["run_id", "version", "name", "intent", "route", "status", "when", "artifacts", "tokens", "cloud_usd"];
    const rows = filtered.map((j) => [
      j.run_id,
      j.version_label || "",
      j.run_name || "",
      j.intent || "",
      j.route_mode || "",
      j.status || "",
      j.when || "",
      j.artifacts_count || 0,
      j.tokens?.total || 0,
      j.cost_usd || 0,
    ]);
    const csv = [cols, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sf-agentic-ai-runs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = {
    all: QUEUE.length,
    scheduled: QUEUE.filter(j => j.status === "scheduled").length,
    running:   QUEUE.filter(j => j.status === "running").length,
    queued:    QUEUE.filter(j => j.status === "queued").length,
    completed: QUEUE.filter(j => j.status === "completed").length,
    failed:    QUEUE.filter(j => j.status === "failed").length,
  };

  return (
    <div data-screen-label="03 Queue">
      <h1 className="h1">Queue & history <span className="h1-serif">— everything the worker has touched</span></h1>
      <p className="sub" style={{ marginBottom: 20 }}>Filter, replay, or re-dispatch any past run.</p>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <KPI label="Jobs"         value={String(QUEUE.length)} trend={query ? `${filtered.length} match search` : "local history"} />
        <KPI label="Artifacts"    value={String(artifactCount)} trend="preview/download ready" up />
        <KPI label="Success rate" value={QUEUE.length ? `${successRate}%` : "—"} trend={`${completedCount} done / ${failedCount} failed`} />
        <KPI label="Spend"   value={(localTokens > 0 || cloudUsd > 0) ? `${localTokens.toLocaleString()} tok / $${cloudUsd.toFixed(2)}` : "—"} trend="local tokens + cloud USD" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
        {["all","scheduled","running","queued","completed","failed"].map(s => (
          <button key={s} className={cls("btn btn-sm", filter === s ? "btn-primary" : "btn-ghost")}
            onClick={() => setFilter(s)} style={{ textTransform: "capitalize" }}>
            {s} <span className="mono" style={{ opacity: 0.7, marginLeft: 4 }}>{counts[s]}</span>
          </button>
        ))}
        <span style={{ flex: 1 }}/>
        <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}><I.Download size={12}/> Export CSV</button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 100 }}>Run ID</th>
              <th>Name</th>
              <th style={{ width: 130 }}>Intent</th>
              <th style={{ width: 90 }}>Route</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 100 }}>When</th>
              <th style={{ width: 120 }}>Duration</th>
              <th style={{ width: 120 }}>Spend</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(j => {
              const meta = intentMeta(j.intent);
              const Icon = I[meta.ico];
              return (
                <tr key={j.run_id} className="row" onClick={() => onOpen(j)}>
                  <td className="mono">{j.run_id}</td>
                  <td style={{ maxWidth: 340 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.run_name}</div>
                    <div className="dim mono" style={{ fontSize: 10.5 }}>{j.version_label || "v1.0"} · {j.artifacts_count || 0} files</div>
                  </td>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--fg-1)" }}><Icon size={13}/> {meta.name}</span></td>
                  <td><span className="mono dim" style={{ fontSize: 11 }}>{j.route_mode}</span></td>
                  <td>
                    <span className={"pill " + (j.status === "completed" ? "done" : j.status)}>
                      <span className="dot"/>
                      {j.status === "completed" ? "done" : j.status}
                    </span>
                  </td>
                  <td className="dim mono" style={{ fontSize: 11.5 }}>{j.when}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{j.eta}</td>
                  <td className="mono" style={{ fontSize: 11.5 }}>
                    {Number(j.tokens?.total || 0) > 0
                      ? `${Number(j.tokens.total).toLocaleString()} tok`
                      : Number(j.cost_usd || 0) > 0
                        ? `$${Number(j.cost_usd).toFixed(2)}`
                        : "—"}
                  </td>
                  <td><I.Chevron size={14} className="dim"/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, trend, up }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className={cls("kpi-trend", up && "up")}>{trend}</div>
    </div>
  );
}

window.Queue = Queue;
window.KPI = KPI;
