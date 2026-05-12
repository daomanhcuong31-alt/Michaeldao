function Integrations({ runtime, onSaveConfig, onTest }) {
  const uiCfg = runtime?.ui_config || {};
  const queue = runtime?.queue || {};
  const items = Array.isArray(runtime?.integrations) ? runtime.integrations : [];

  const cloudProviderMeta = Array.isArray(window.CLOUD_API_PROVIDER_META) && window.CLOUD_API_PROVIDER_META.length
    ? window.CLOUD_API_PROVIDER_META
    : [
        { id: "perplexity", label: "Perplexity", description: "Search-first cloud model for market intel.", endpoint: "https://api.perplexity.ai", docs_url: "https://docs.perplexity.ai/" },
        { id: "gemini", label: "Gemini", description: "Google model for broad reasoning and extraction.", endpoint: "https://generativelanguage.googleapis.com", docs_url: "https://ai.google.dev/gemini-api/docs" },
        { id: "chatgpt", label: "ChatGPT", description: "OpenAI model connector for drafting and analysis.", endpoint: "https://api.openai.com/v1", docs_url: "https://platform.openai.com/docs" },
        { id: "claude", label: "Claude", description: "Anthropic model connector for long-form synthesis.", endpoint: "https://api.anthropic.com", docs_url: "https://docs.anthropic.com/" },
        { id: "tavily", label: "Tavily", description: "Search and retrieval connector for research workflows.", endpoint: "https://api.tavily.com", docs_url: "https://docs.tavily.com/" },
      ];

  const [saveState, setSaveState] = React.useState("");
  const [gdEnabled, setGdEnabled] = React.useState(Boolean(uiCfg.google_drive?.enabled));
  const [gdSource, setGdSource] = React.useState(uiCfg.google_drive?.source_folder_id || "");
  const [gdOutput, setGdOutput] = React.useState(uiCfg.google_drive?.output_folder || "/AgenticFlow/Outputs");
  const [gdServiceFile, setGdServiceFile] = React.useState(uiCfg.google_drive?.service_account_file || "");
  const [odEnabled, setOdEnabled] = React.useState(Boolean(uiCfg.onedrive?.enabled));
  const [odSource, setOdSource] = React.useState(uiCfg.onedrive?.source_path || "");
  const [odOutput, setOdOutput] = React.useState(uiCfg.onedrive?.output_path || "/SF-Agentic-AI/Outputs");
  const [tgEnabled, setTgEnabled] = React.useState(Boolean(uiCfg.telegram?.enabled));
  const [tgChannel, setTgChannel] = React.useState(uiCfg.telegram?.channel || "");
  const [cloudApis, setCloudApis] = React.useState(() => _normalizeCloudApis(uiCfg.cloud_apis, cloudProviderMeta));

  React.useEffect(() => {
    setGdEnabled(Boolean(uiCfg.google_drive?.enabled));
    setGdSource(uiCfg.google_drive?.source_folder_id || "");
    setGdOutput(uiCfg.google_drive?.output_folder || "/AgenticFlow/Outputs");
    setGdServiceFile(uiCfg.google_drive?.service_account_file || "");
    setOdEnabled(Boolean(uiCfg.onedrive?.enabled));
    setOdSource(uiCfg.onedrive?.source_path || "");
    setOdOutput(uiCfg.onedrive?.output_path || "/SF-Agentic-AI/Outputs");
    setTgEnabled(Boolean(uiCfg.telegram?.enabled));
    setTgChannel(uiCfg.telegram?.channel || "");
    setCloudApis(_normalizeCloudApis(uiCfg.cloud_apis, cloudProviderMeta));
  }, [runtime?.ui_config]);

  const statusByProvider = React.useMemo(() => {
    const map = {};
    for (const item of items) {
      if (item && item.provider) map[item.provider] = item;
    }
    return map;
  }, [items]);

  const updateCloudApi = (providerId, patch) => {
    setCloudApis((prev) => {
      const current = prev?.[providerId] || {};
      return {
        ...prev,
        [providerId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const saveAll = () => {
    const next = {
      ...uiCfg,
      google_drive: {
        ...(uiCfg.google_drive || {}),
        enabled: gdEnabled,
        source_folder_id: gdSource,
        output_folder: gdOutput,
        service_account_file: gdServiceFile,
      },
      onedrive: {
        ...(uiCfg.onedrive || {}),
        enabled: odEnabled,
        source_path: odSource,
        output_path: odOutput,
      },
      telegram: {
        ...(uiCfg.telegram || {}),
        enabled: tgEnabled,
        channel: tgChannel,
      },
      cloud_apis: _serializeCloudApis(cloudApis, cloudProviderMeta),
    };
    setSaveState("saving");
    Promise.resolve(onSaveConfig && onSaveConfig(next))
      .then(() => {
        setSaveState("saved");
        setTimeout(() => setSaveState(""), 2500);
      })
      .catch((err) => {
        setSaveState("error");
        window.alert(String(err.message || err));
      });
  };

  return (
    <div data-screen-label="05 Integrations">
      <h1 className="h1">Integrations <span className="h1-serif">— working controls, not mock</span></h1>
      <p className="sub" style={{ marginBottom: 22 }}>
        Connector settings only. Business instructions, knowledge base, RAG, and market intel files are in Settings > Knowledge.
      </p>

      <div className="int-grid" style={{ marginBottom: 16 }}>
        <IntegrationTile
          name="Google Drive"
          description="Drive folder source and output handoff."
          connected={Boolean(statusByProvider.google_drive?.connected)}
          statusText={statusByProvider.google_drive?.status || (gdEnabled ? "configured" : "off")}
          icon={<I.Drive size={22} />}
          body={
            <>
              <FieldRow
                label="Enabled"
                control={<button type="button" className={cls("toggle", gdEnabled && "on")} aria-pressed={gdEnabled} onClick={() => setGdEnabled((v) => !v)} />}
              />
              <FieldRow label="Source folder ID" control={<input className="input mono" value={gdSource} onChange={(e) => setGdSource(e.target.value)} />} />
              <FieldRow label="Output folder" control={<input className="input mono" value={gdOutput} onChange={(e) => setGdOutput(e.target.value)} />} />
              <FieldRow
                label="Service account file"
                control={<input className="input mono" value={gdServiceFile} onChange={(e) => setGdServiceFile(e.target.value)} placeholder="/absolute/path/to/service-account.json" />}
              />
            </>
          }
          actions={
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTest && onTest("google_drive")}><I.Link size={12} /> Test</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const folderId = String(gdSource || "").trim();
                  const url = folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : "https://drive.google.com/";
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                <I.Link size={12} /> Open
              </button>
            </>
          }
        />

        <IntegrationTile
          name="OneDrive"
          description="Local backend path or cloud entry point."
          connected={Boolean(statusByProvider.onedrive?.connected)}
          statusText={statusByProvider.onedrive?.status || (odEnabled ? "configured" : "off")}
          icon={<I.OneDrive size={22} />}
          body={
            <>
              <FieldRow
                label="Enabled"
                control={<button type="button" className={cls("toggle", odEnabled && "on")} aria-pressed={odEnabled} onClick={() => setOdEnabled((v) => !v)} />}
              />
              <FieldRow label="Source path" control={<input className="input mono" value={odSource} onChange={(e) => setOdSource(e.target.value)} placeholder="/Users/you/OneDrive/Inbox" />} />
              <FieldRow label="Output path" control={<input className="input mono" value={odOutput} onChange={(e) => setOdOutput(e.target.value)} placeholder="/Users/you/OneDrive/Outputs" />} />
            </>
          }
          actions={
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTest && onTest("onedrive")}><I.Link size={12} /> Test</button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const raw = String(odSource || "").trim();
                  if (/^https?:\/\//i.test(raw)) {
                    window.open(raw, "_blank", "noopener,noreferrer");
                    return;
                  }
                  window.open("https://onedrive.live.com/", "_blank", "noopener,noreferrer");
                }}
              >
                <I.Link size={12} /> Open
              </button>
            </>
          }
        />

        <IntegrationTile
          name="Telegram"
          description="Optional notification channel."
          connected={Boolean(statusByProvider.telegram?.connected)}
          statusText={statusByProvider.telegram?.status || (tgEnabled ? "configured" : "off")}
          icon={<I.Telegram size={22} />}
          body={
            <>
              <FieldRow
                label="Enabled"
                control={<button type="button" className={cls("toggle", tgEnabled && "on")} aria-pressed={tgEnabled} onClick={() => setTgEnabled((v) => !v)} />}
              />
              <FieldRow label="Channel" control={<input className="input mono" value={tgChannel} onChange={(e) => setTgChannel(e.target.value)} placeholder="@your_channel" />} />
            </>
          }
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTest && onTest("telegram")}><I.Link size={12} /> Test</button>
          }
        />

        <IntegrationTile
          name="Agent provider"
          description="Current runtime provider and model health."
          connected={Boolean(statusByProvider.agent_provider?.connected)}
          statusText={statusByProvider.agent_provider?.status || "unknown"}
          icon={<I.Brain size={22} />}
          body={
            <>
              <FieldRow label="Provider" control={<div className="mono" style={{ fontSize: 11.5 }}>{statusByProvider.agent_provider?.provider_mode || runtime?.runtime?.provider || "—"}</div>} />
              <FieldRow label="Base URL" control={<div className="mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{statusByProvider.agent_provider?.base_url || runtime?.runtime?.base_url || "—"}</div>} />
              <FieldRow label="Model" control={<div className="mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{statusByProvider.agent_provider?.model || runtime?.runtime?.model || "—"}</div>} />
            </>
          }
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTest && onTest("agent_provider")}><I.Refresh size={12} /> Test</button>
          }
        />
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Cloud Model API Connectors</h3>
          <div className="dim mono" style={{ marginLeft: "auto", fontSize: 11 }}>
            One card per provider; one config object in the backend.
          </div>
        </div>
        <div className="card-pad">
          <div className="int-grid">
            {cloudProviderMeta.map((meta) => {
              const providerKey = meta.id;
              const item = statusByProvider[`cloud_${providerKey}`] || {};
              const cfg = cloudApis[providerKey] || {};
              const connected = Boolean(item.connected) || (Boolean(cfg.enabled) && Boolean(String(cfg.api_key || "").trim()));
              const statusText = item.status || (cfg.enabled ? (String(cfg.api_key || "").trim() ? "configured" : "disabled") : "off");
              return (
                <IntegrationTile
                  key={providerKey}
                  name={meta.label}
                  description={meta.description}
                  connected={connected}
                  statusText={statusText}
                  icon={providerIconFor(providerKey)}
                  body={
                    <>
                      <FieldRow
                        label="Enabled"
                        control={<button type="button" className={cls("toggle", Boolean(cfg.enabled) && "on")} aria-pressed={Boolean(cfg.enabled)} onClick={() => updateCloudApi(providerKey, { enabled: !Boolean(cfg.enabled) })} />}
                      />
                      <FieldRow
                        label="API key"
                        control={<input className="input mono" value={cfg.api_key || ""} onChange={(e) => updateCloudApi(providerKey, { api_key: e.target.value })} placeholder="sk-..." />}
                      />
                      <FieldRow
                        label="Endpoint"
                        control={<input className="input mono" value={cfg.endpoint || meta.endpoint || ""} onChange={(e) => updateCloudApi(providerKey, { endpoint: e.target.value })} placeholder={meta.endpoint || ""} />}
                      />
                      <FieldRow
                        label="Model"
                        control={<input className="input mono" value={cfg.model || ""} onChange={(e) => updateCloudApi(providerKey, { model: e.target.value })} placeholder="model name" />}
                      />
                    </>
                  }
                  actions={
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTest && onTest(`cloud_${providerKey}`)}><I.Link size={12} /> Test</button>
                      {meta.docs_url ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.open(meta.docs_url, "_blank", "noopener,noreferrer")}><I.Link size={12} /> Docs</button>
                      ) : null}
                    </>
                  }
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Queue Snapshot</h3></div>
        <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <Stat label="Total" value={queue.total || 0} />
          <Stat label="Queued" value={queue.queued || 0} />
          <Stat label="Running" value={queue.running || 0} />
          <Stat label="Succeeded" value={queue.succeeded || 0} />
          <Stat label="Failed" value={queue.failed || 0} />
        </div>
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saveState === "saving"}>
          <I.Check size={13} /> {saveState === "saving" ? "Saving..." : "Save integration settings"}
        </button>
        {saveState === "saved" && <span className="pill done"><span className="dot" /> saved</span>}
        {saveState === "error" && <span className="pill failed"><span className="dot" /> save failed</span>}
      </div>
    </div>
  );
}

function _normalizeCloudApis(raw, providers) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const meta of providers) {
    const entry = source[meta.id];
    const safe = entry && typeof entry === "object" ? entry : {};
    out[meta.id] = {
      enabled: Boolean(safe.enabled),
      api_key: String(safe.api_key || ""),
      endpoint: String(safe.endpoint || meta.endpoint || ""),
      model: String(safe.model || ""),
    };
  }
  for (const [key, entry] of Object.entries(source)) {
    if (out[key]) continue;
    const safe = entry && typeof entry === "object" ? entry : {};
    out[key] = {
      enabled: Boolean(safe.enabled),
      api_key: String(safe.api_key || ""),
      endpoint: String(safe.endpoint || ""),
      model: String(safe.model || ""),
    };
  }
  return out;
}

function _serializeCloudApis(cloudApis, providers) {
  const out = {};
  for (const meta of providers) {
    const entry = cloudApis?.[meta.id] || {};
    out[meta.id] = {
      enabled: Boolean(entry.enabled),
      api_key: String(entry.api_key || "").trim(),
      endpoint: String(entry.endpoint || meta.endpoint || "").trim(),
      model: String(entry.model || "").trim(),
    };
  }
  for (const [key, entry] of Object.entries(cloudApis || {})) {
    if (out[key]) continue;
    out[key] = {
      enabled: Boolean(entry?.enabled),
      api_key: String(entry?.api_key || "").trim(),
      endpoint: String(entry?.endpoint || "").trim(),
      model: String(entry?.model || "").trim(),
    };
  }
  return out;
}

function providerIconFor(providerId) {
  if (providerId === "perplexity") return <I.Search size={20} />;
  if (providerId === "gemini") return <I.Sparkle size={20} />;
  if (providerId === "chatgpt") return <I.MessageSquare size={20} />;
  if (providerId === "claude") return <I.Brain size={20} />;
  if (providerId === "tavily") return <I.Globe size={20} />;
  return <I.Link size={20} />;
}

function IntegrationTile({ name, description, connected, statusText, icon, body, actions }) {
  const statusClass =
    statusText === "ready" || connected ? "done" :
    statusText === "configured" ? "warn" :
    statusText === "failed" || statusText === "missing_api_key" || statusText === "unreachable" ? "failed" :
    "";
  return (
    <div className="int-tile">
      <div className="int-head">
        <div className="int-logo">{icon}</div>
        <div style={{ flex: 1 }}>
          <div className="int-name">{name}</div>
          <div className="int-desc">{description || "Local backend-driven"}</div>
        </div>
        <span className={"pill " + statusClass}>
          <span className="dot" /> {statusText || (connected ? "ready" : "off")}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>{body}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

function FieldRow({ label, control }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
      <div className="dim mono" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div>{control}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="dim mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

window.Integrations = Integrations;
