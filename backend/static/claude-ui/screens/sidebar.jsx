function Sidebar({ route, setRoute, runningCount, queuedCount, runtime }) {
  const items = [
  { id: "home", label: "Dashboard", ico: "Home" },
  { id: "new", label: "New job", ico: "Plus" },
  { id: "active", label: "Active", ico: "Play", badge: runningCount },
  { id: "queue", label: "Queue & history", ico: "List", badge: queuedCount }];

  const tools = [
  { id: "integrations", label: "Integrations", ico: "Plug" },
  { id: "settings", label: "Settings", ico: "Settings" }];
  const rt = runtime?.runtime || {};
  const wk = runtime?.worker || {};
  const health = runtime?.health || {};
  const model = rt.model || "unknown";
  const provider = rt.provider || "local";
  const host = (rt.base_url || "").replace(/^https?:\/\//i, "") || "127.0.0.1";
  const runtimeReady = health.ok === true || health.ready === true;
  const runtimeState = runtimeReady ? "ready" : "runtime down";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" style={{ backgroundColor: "rgb(255, 91, 57)" }}>SF</div>
        <div>
          <div className="brand-name">SF Agentic AI</div>
          <div className="brand-sub">Local Automation</div>
        </div>
      </div>

      <div className="nav-label">Workspace</div>
      {items.map((it) => {
        const Icon = I[it.ico];
        return (
          <button
            type="button"
            key={it.id}
            className={cls("nav-item", route === it.id && "active")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRoute(it.id); }}
          >
            <Icon className="nav-ico" />
            <span>{it.label}</span>
            {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
          </button>);

      })}

      <div className="nav-label" style={{ marginTop: 18 }}>Configuration</div>
      {tools.map((it) => {
        const Icon = I[it.ico];
        return (
          <button
            type="button"
            key={it.id}
            className={cls("nav-item", route === it.id && "active")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRoute(it.id); }}
          >
            <Icon className="nav-ico" />
            <span>{it.label}</span>
          </button>);

      })}

      <div className="sidebar-foot">
        <div className="worker-card">
          <div className="worker-row">
            <span className="worker-dot" style={{ background: runtimeReady ? "var(--ok)" : "var(--err)" }} />
            <span className="worker-label">Runtime</span>
            <span style={{ marginLeft: "auto", color: runtimeReady ? "var(--ok)" : "var(--err)" }} className="mono">{provider}</span>
          </div>
          <div className="worker-meta">
            model&nbsp;&nbsp;{model}<br />
            host&nbsp;&nbsp;&nbsp;{host}<br />
            state&nbsp;&nbsp;{runtimeState}<br />
            worker&nbsp;{wk.paused ? "paused" : wk.running ? "running" : "idle"}<br />
            queue&nbsp;&nbsp;{queuedCount} pending
          </div>
        </div>
      </div>
    </aside>);

}
window.Sidebar = Sidebar;
