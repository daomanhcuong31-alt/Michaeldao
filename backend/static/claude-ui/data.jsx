// Shared UI state + helpers (live backend mode)

const INTENTS = [
  { id: "memo_only", name: "Credit memo", desc: "Credit committee memo from inputs", ico: "Doc" },
  { id: "analysis_brief", name: "Analysis brief", desc: "Business analysis without credit decision framing", ico: "Doc" },
  { id: "ops_sop", name: "SOP", desc: "Procedure / process documentation", ico: "Database" },
  { id: "meeting_minutes", name: "Meeting minutes", desc: "Minutes, decisions and action items", ico: "Doc" },
  { id: "pipeline_report", name: "Pipeline report", desc: "Pipeline tracking and reporting", ico: "Database" },
  { id: "market_intel", name: "Market intel", desc: "Market intelligence brief", ico: "Search" },
  { id: "data_analysis", name: "Data analysis", desc: "Data analyst report from Excel/CSV", ico: "Database" },
  { id: "memo_plus_distribution", name: "Memo + Distribution", desc: "Credit memo then distribution waterfall", ico: "Send" },
  { id: "memo_plus_holdbook", name: "Memo + Holdbook", desc: "Credit memo then holdbook allocation", ico: "Database" },
  { id: "full_e2e", name: "Full E2E", desc: "Credit memo plus post-credit planning", ico: "Sparkle" },
  { id: "custom", name: "Custom intent", desc: "User-defined instruction and routing", ico: "Brain" },
];

const WORKERS_ALL = [
  { id: "ingestion", label: "Ingestion", desc: "Parse + chunk all inputs" },
  { id: "market_intel", label: "Market Intel", desc: "Industry + comps research" },
  { id: "analysis_parallel", label: "Analysis", desc: "Financial + risk analysis" },
  { id: "financial_modeler", label: "Financial Modeler", desc: "Model build + projections" },
  { id: "compliance", label: "Compliance", desc: "Regulatory / covenant check" },
  { id: "memo_architect", label: "Memo Architect", desc: "Synthesize into final memo" },
  { id: "senior_advisor", label: "Senior Advisor", desc: "QA + tone review" },
  { id: "admin_ops", label: "Admin Ops", desc: "Meeting minutes and SOP drafting" },
  { id: "data_analyst", label: "Data Analyst", desc: "Pipeline tracking/reporting from data files" },
];

const AUDIENCES = [
  { id: "credit_committee", label: "Credit Committee" },
  { id: "ceo", label: "CEO" },
  { id: "chief_cibg", label: "Chief CIBG" },
  { id: "external_client", label: "External Client" },
];

const REPORT_PROFILES = [
  {
    id: "credit_memo_v2",
    label: "Credit memo v2",
    report_format: "credit_memo",
    intent: "memo_only",
    structured_template: "credit_memo",
    sop_format: "credit_sop",
    output_formats: ["docx", "pdf", "xlsx"],
    description: "Credit committee memo with decision-ready structure.",
  },
  {
    id: "analysis_brief_v1",
    label: "Analysis brief v1",
    report_format: "analysis_brief",
    intent: "analysis_brief",
    structured_template: "autonomous",
    sop_format: "analysis_sop",
    output_formats: ["docx", "pdf"],
    description: "Short-form analysis memo with autonomous structure.",
  },
  {
    id: "ops_sop_v2",
    label: "Operations SOP v2",
    report_format: "ops_sop",
    intent: "ops_sop",
    structured_template: "sop",
    sop_format: "ops_sop",
    output_formats: ["docx", "pdf", "md"],
    description: "Process / SOP output profile.",
  },
  {
    id: "meeting_minutes_v1",
    label: "Meeting minutes v1",
    report_format: "meeting_minutes",
    intent: "meeting_minutes",
    structured_template: "meeting_minutes",
    sop_format: "meeting_minutes",
    output_formats: ["docx", "pdf", "md"],
    description: "Meeting minutes and action tracking profile.",
  },
  {
    id: "pipeline_report_v1",
    label: "Pipeline report v1",
    report_format: "pipeline_report",
    intent: "pipeline_report",
    structured_template: "pipeline_report",
    sop_format: "pipeline_report",
    output_formats: ["xlsx", "docx", "pdf"],
    description: "Pipeline / reporting profile for sales and ops.",
  },
];

const STRUCTURED_TEMPLATE_LIBRARY = [
  { id: "autonomous", label: "Autonomous", desc: "Worker chooses structure", type: "mode" },
  { id: "not_applicable", label: "Not applicable", desc: "No enforced structure", type: "mode" },
  { id: "custom", label: "Custom", desc: "Paste your own template", type: "mode" },
  { id: "credit_memo", label: "Credit memo", desc: "Executive credit memo format", type: "template" },
  { id: "sop", label: "SOP", desc: "Standard operating procedure", type: "template" },
  { id: "meeting_minutes", label: "Meeting minutes", desc: "Meeting note structure", type: "template" },
  { id: "pipeline_report", label: "Pipeline report", desc: "Pipeline tracker format", type: "template" },
];

const CREDIT_RATIO_PRESETS = [
  { id: "dscr_min", label: "DSCR min", formula: "EBITDA / debt service", value: 1.25, description: "Coverage of debt service from cash flow" },
  { id: "icr_min", label: "ICR min", formula: "EBIT / interest expense", value: 2.20, description: "Interest coverage ratio" },
  { id: "net_leverage_max", label: "Net leverage max", formula: "(Debt - Cash) / EBITDA", value: 4.20, description: "Leverage after cash offset" },
  { id: "current_ratio_min", label: "Current ratio min", formula: "Current assets / current liabilities", value: 1.10, description: "Short-term liquidity coverage" },
  { id: "debt_service_headroom", label: "Debt service headroom", formula: "CFADS / debt service", value: 1.15, description: "Extra room above scheduled debt service" },
];

const CREDIT_RATIO_DEFAULT_ROWS = CREDIT_RATIO_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
  description: preset.description,
  formula: preset.formula,
  value: String(preset.value),
  locked: true,
}));

const MODEL_RULE_PRESETS = [
  { id: "analysis_only", label: "Analysis only", description: "Use local model for drafting and summary work." },
  { id: "decision_recommendation", label: "Decision recommendation", description: "Use stronger model for final recommendation and risk framing." },
  { id: "market_research", label: "Market research", description: "Route to cloud model or search-enabled provider when external sources matter." },
  { id: "drafting", label: "Drafting", description: "Use the cheapest model that still satisfies formatting and tone." },
];

const CLOUD_API_PROVIDER_META = [
  {
    id: "perplexity",
    label: "Perplexity",
    description: "Search-first cloud model for market intel and live web-style synthesis.",
    endpoint: "https://api.perplexity.ai",
    docs_url: "https://docs.perplexity.ai/",
    icon: "Search",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "Google model for broad reasoning, extraction, and drafting.",
    endpoint: "https://generativelanguage.googleapis.com",
    docs_url: "https://ai.google.dev/gemini-api/docs",
    icon: "Sparkle",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    description: "OpenAI model connector for general-purpose drafting and analysis.",
    endpoint: "https://api.openai.com/v1",
    docs_url: "https://platform.openai.com/docs",
    icon: "MessageSquare",
  },
  {
    id: "claude",
    label: "Claude",
    description: "Anthropic model connector for long-form synthesis and structured output.",
    endpoint: "https://api.anthropic.com",
    docs_url: "https://docs.anthropic.com/",
    icon: "Brain",
  },
  {
    id: "tavily",
    label: "Tavily",
    description: "Search and retrieval connector for research-heavy workflows.",
    endpoint: "https://api.tavily.com",
    docs_url: "https://docs.tavily.com/",
    icon: "Globe",
  },
];

const INTEGRATION_CATALOG = {
  agent_provider: {
    id: "agent_provider",
    label: "Agent provider",
    description: "Current runtime provider and model health.",
    icon: "Brain",
    kind: "runtime",
    actions: ["test"],
  },
  google_drive: {
    id: "google_drive",
    label: "Google Drive",
    description: "Drive folder source and output handoff.",
    icon: "Drive",
    kind: "storage",
    actions: ["test", "open"],
  },
  onedrive: {
    id: "onedrive",
    label: "OneDrive",
    description: "Local backend path or cloud entry point for one-drive workflows.",
    icon: "OneDrive",
    kind: "storage",
    actions: ["test", "open"],
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    description: "Optional notification channel.",
    icon: "Telegram",
    kind: "notification",
    actions: ["test"],
  },
  cloud_apis: CLOUD_API_PROVIDER_META,
};

const SF_STATE = {
  ACTIVE_RUN: {
    run_id: "run_local",
    run_name: "No active run yet",
    status: "idle",
    route_mode: "auto",
    planned_workers: [],
    completed_steps: [],
    current_agent: "",
    progress_percent: 0,
    quality_gate_decision: "",
    last_error: "",
    manager_plan: {},
    artifacts_count: 0,
    config: { intent: "memo_only", route_mode: "auto", provider: "lm_studio", timeout_sec: 1800, audience: "credit_committee" },
    inputs: [],
    log: [{ ts: new Date().toLocaleTimeString("en-US", { hour12: false }), level: "info", msg: "Waiting for run dispatch..." }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  QUEUE: [],
  RECENT_ARTIFACTS: [],
  ARTIFACTS_BY_RUN: {},
  UI_RUNTIME: {
    health: null,
    integrations: [],
    me: { name: "Local Operator", workspace: "SF Agentic AI", mode: "self_hosted" },
    worker: {
      running: false,
      paused: false,
      current_run: null,
      last_heartbeat: "",
    },
    queue: { total: 0, queued: 0, running: 0, failed: 0, succeeded: 0 },
    runtime: { provider: "lm_studio", base_url: "", model: "" },
    ui_config: {
      standing_instruction: "",
      knowledge_base_notes: "",
      standing_instruction_attachments: [],
      knowledge_base_attachments: [],
      account_profile: { operator_name: "Local Operator", workspace: "SF Agentic AI" },
      policy: {
        credit_thresholds: {
          dscr_min: 1.2,
          icr_min: 2.0,
          net_leverage_max: 4.5,
          current_ratio_min: 1.0,
        },
        credit_ratio_rules: CREDIT_RATIO_DEFAULT_ROWS,
        credit_decision_mode: "analysis_only",
        report_length_words: 1800,
        report_format: "credit_memo_v2",
        sop_format: "standard_sop",
        output_template_default: "autonomous",
        condition_precedents: "",
        adhoc_criteria: "",
        structured_output_instruction: "",
        market_intel_instruction: "",
        market_intel_attachments: [],
      },
      output_templates: {
        credit_memo: "Executive Summary, Borrower Profile, Deal Structure, Financial Analysis, Risk & Mitigants, Covenants, Recommendation.",
        sop: "Purpose, Scope, Roles, Inputs, Procedure Steps, Controls, Escalation, Appendix.",
        meeting_minutes: "Meeting Metadata, Attendance, Agenda, Key Discussion, Decisions, Action Items.",
        pipeline_report: "Snapshot KPIs, Pipeline by Stage, Movements, Risk Flags, Next Actions.",
      },
      rag: {
        enabled: false,
        instruction: "",
        references: [],
        attachments: [],
      },
      google_drive: { enabled: false, source_folder_id: "", output_folder: "/AgenticFlow/Outputs", service_account_file: "" },
      onedrive: { enabled: false, source_path: "", output_path: "/SF-Agentic-AI/Outputs" },
      telegram: { enabled: false, channel: "" },
      cloud_apis: {
        perplexity: { enabled: false, api_key: "", endpoint: "", model: "" },
        gemini: { enabled: false, api_key: "", endpoint: "", model: "" },
        chatgpt: { enabled: false, api_key: "", endpoint: "", model: "" },
        claude: { enabled: false, api_key: "", endpoint: "", model: "" },
        tavily: { enabled: false, api_key: "", endpoint: "", model: "" },
      },
      defaults: {
        audience: "credit_committee",
        route_mode: "auto",
        post_credit: "stop",
        human_gate: "approve",
        fast: true,
        no_web_research: true,
        autonomous: true,
        output_formats: ["txt", "docx", "xlsx"],
      },
      worker_registry: [],
      model_registry: [],
    },
  },
};

function _setGlobalsFromState() {
  window.ACTIVE_RUN = SF_STATE.ACTIVE_RUN;
  window.QUEUE = SF_STATE.QUEUE;
  window.RECENT_ARTIFACTS = SF_STATE.RECENT_ARTIFACTS;
  window.ARTIFACTS_BY_RUN = SF_STATE.ARTIFACTS_BY_RUN;
  window.UI_RUNTIME = SF_STATE.UI_RUNTIME;
}

function _relTime(iso) {
  if (!iso) return "—";
  const d = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return Math.round(d) + "s ago";
  if (d < 3600) return Math.round(d / 60) + "m ago";
  if (d < 86400) return Math.round(d / 3600) + "h ago";
  return Math.round(d / 86400) + "d ago";
}

function _runEta(run) {
  const status = String(run.status || "");
  if (status === "queued") return "queued";
  if (status === "scheduled") return "scheduled";
  if (status === "running") return "running";
  if (run.return_code === 0) return "ok";
  if (run.return_code != null) return "rc=" + run.return_code;
  return "—";
}

function _artifactUrl(runId, filename, suffix = "") {
  if (!runId || !filename) return "";
  return `/api/artifacts/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}${suffix}`;
}

function _normalizeArtifact(runId, artifact, idx = 0) {
  const name = String(artifact?.name || "").trim();
  if (!runId || !name) return null;
  const artifactId = artifact.artifact_id || `${runId}_${idx}_${name}`;
  return {
    artifact_id: artifactId,
    run_id: runId,
    name,
    display_name: artifact.display_name || artifact.stable_name || name,
    stable_name: artifact.stable_name || name,
    kind: artifact.kind || "output",
    version: artifact.version || artifact.version_label || "v1.0",
    version_label: artifact.version_label || artifact.version || "v1.0",
    path_status: artifact.path_status || "available",
    validation_status: artifact.validation_status || (Number(artifact.size_bytes || 0) === 0 ? "invalid_empty" : "ok"),
    size_bytes: Number(artifact.size_bytes || 0) || 0,
    download_url: artifact.download_url || _artifactUrl(runId, artifactId),
    preview_url: artifact.preview_url || _artifactUrl(runId, artifactId, "/preview"),
    mime_type: artifact.mime_type || "",
    created_at: artifact.created_at || artifact.mtime || "",
  };
}

function _rememberRunArtifacts(runId, artifacts) {
  if (!runId || !Array.isArray(artifacts)) return;
  SF_STATE.ARTIFACTS_BY_RUN = {
    ...SF_STATE.ARTIFACTS_BY_RUN,
    [runId]: artifacts
      .map((a, idx) => _normalizeArtifact(runId, a, idx))
      .filter(Boolean),
  };
}

function _refreshRecentArtifacts() {
  const all = Object.values(SF_STATE.ARTIFACTS_BY_RUN || {})
    .flat()
    .filter(Boolean);
  all.sort((a, b) => {
    const validA = a.validation_status === "ok" && a.path_status !== "empty" && Number(a.size_bytes || 0) > 0;
    const validB = b.validation_status === "ok" && b.path_status !== "empty" && Number(b.size_bytes || 0) > 0;
    if (validA !== validB) return validA ? -1 : 1;
    const rank = (x) => ({ credit_memo: 0, post_credit: 1, other: 2, log: 3, metadata: 4 }[String(x.kind || "other")] ?? 2);
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB) return rankA - rankB;
    const bd = new Date(b.created_at || 0).getTime() || 0;
    const ad = new Date(a.created_at || 0).getTime() || 0;
    return bd - ad;
  });
  SF_STATE.RECENT_ARTIFACTS = all.slice(0, 12);
}

function _toQueueItem(run) {
  const req = run.request || {};
  const statusRaw = run.status || "unknown";
  const status = statusRaw === "succeeded" ? "completed" : statusRaw;
  const runArtifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
  const normalizedArtifacts = runArtifacts.map((a, idx) => _normalizeArtifact(run.run_id, a, idx)).filter(Boolean);
  const tokens = run.tokens && typeof run.tokens === "object" ? run.tokens : {};
  return {
    run_id: run.run_id,
    run_name: req.run_name || req.manager_instruction || req.intent || run.run_id,
    version_label: run.version_label || (normalizedArtifacts[0] && normalizedArtifacts[0].version_label) || "v1.0",
    lineage_root_run_id: run.lineage_root_run_id || run.source_run_id || run.run_id,
    source_run_id: run.source_run_id || "",
    status,
    intent: req.intent || "memo_only",
    route_mode: req.route_mode || "auto",
    when: _relTime(run.created_at),
    eta: _runEta(run),
    tokens: {
      in: Number(tokens.in ?? tokens.input ?? tokens.prompt ?? 0) || 0,
      out: Number(tokens.out ?? tokens.output ?? tokens.completion ?? 0) || 0,
      total: Number(tokens.total ?? tokens.in_total ?? tokens.prompt_total ?? 0) || 0,
    },
    cost_usd: Number(run.cost_usd ?? req.cost_usd ?? 0) || 0,
    created_at: run.created_at || "",
    scheduled_at: run.scheduled_at || "",
    updated_at: run.finished_at || run.started_at || run.created_at || "",
    request: req,
    raw_status: run.status || "",
    artifacts: normalizedArtifacts,
    artifacts_count: Number(run.artifacts_count ?? normalizedArtifacts.length) || normalizedArtifacts.length,
  };
}

function applyRuns(runs) {
  const items = (runs || []).map(_toQueueItem);
  for (const run of runs || []) {
    if (Array.isArray(run.artifacts)) {
      _rememberRunArtifacts(run.run_id, run.artifacts);
    }
  }
  _refreshRecentArtifacts();
  SF_STATE.QUEUE = items;
  if (items.length > 0) {
    const running = runs.find((r) => r.status === "running" || r.status === "queued") || runs[0];
    if (running) {
      const req = running.request || {};
      SF_STATE.ACTIVE_RUN = {
        ...SF_STATE.ACTIVE_RUN,
        run_id: running.run_id,
        run_name: req.run_name || req.manager_instruction || req.intent || running.run_id,
        status: running.status || "unknown",
        route_mode: req.route_mode || "auto",
        progress_percent: running.status === "succeeded" ? 100 : running.status === "running" ? 55 : running.status === "queued" ? 10 : 0,
        config: {
          intent: req.intent || "memo_only",
          route_mode: req.route_mode || "auto",
          provider: req.llm_provider || SF_STATE.UI_RUNTIME.runtime.provider || "lm_studio",
          timeout_sec: req.timeout_sec || 1800,
          audience: req.audience || "credit_committee",
        },
      };
    }
  }
  _setGlobalsFromState();
}

function applyRunDetail(run, logs, artifacts) {
  const req = run.request || {};
  const detailArtifacts = Array.isArray(artifacts) ? artifacts : [];
  _rememberRunArtifacts(run.run_id, detailArtifacts);
  _refreshRecentArtifacts();
  SF_STATE.ACTIVE_RUN = {
    ...SF_STATE.ACTIVE_RUN,
    run_id: run.run_id,
    run_name: req.run_name || req.manager_instruction || req.intent || run.run_id,
    status: run.status || "unknown",
    route_mode: req.route_mode || "auto",
    planned_workers: [
      "ingestion",
      "market_intel",
      "analysis_parallel",
      "memo_architect",
    ],
    completed_steps:
      run.status === "succeeded"
        ? ["ingestion", "market_intel", "analysis_parallel", "memo_architect"]
        : run.status === "running"
          ? ["ingestion"]
          : [],
    current_agent: run.status === "running" ? "market_intel" : run.status === "queued" ? "ingestion" : "",
    progress_percent: run.status === "succeeded" ? 100 : run.status === "running" ? 55 : run.status === "queued" ? 10 : 0,
    quality_gate_decision: run.status === "succeeded" ? "APPROVE" : "",
    last_error: run.error || "",
    manager_plan: req.manager_instruction ? { mode: req.route_mode || "auto", reason: req.manager_instruction } : {},
    artifacts_count: detailArtifacts.length,
    tokens: run.tokens && typeof run.tokens === "object" ? run.tokens : {},
    cost_usd: Number(run.cost_usd ?? 0) || 0,
    config: {
      intent: req.intent || "memo_only",
      route_mode: req.route_mode || "auto",
      provider: req.llm_provider || SF_STATE.UI_RUNTIME.runtime.provider || "lm_studio",
      timeout_sec: req.timeout_sec || 1800,
      audience: req.audience || "credit_committee",
    },
    inputs: (run.inputs || []).map((p, i) => ({
      id: "in_" + i,
      name: (p || "").split("/").pop() || p,
      source: "upload",
      size_bytes: 0,
      mime_type: "",
    })),
    log: [
      ...(logs?.stdout_lines || []).map((msg) => ({ ts: new Date().toLocaleTimeString("en-US", { hour12: false }), level: "info", msg })),
      ...(logs?.stderr_lines || []).map((msg) => ({ ts: new Date().toLocaleTimeString("en-US", { hour12: false }), level: "err", msg })),
    ].slice(-80),
    created_at: run.created_at || SF_STATE.ACTIVE_RUN.created_at,
    updated_at: run.finished_at || run.started_at || run.created_at || new Date().toISOString(),
  };

  const queueItem = {
    ..._toQueueItem(run),
    artifacts: getArtifactsForRun(run.run_id),
    artifacts_count: detailArtifacts.length,
  };
  const foundIdx = SF_STATE.QUEUE.findIndex((j) => j.run_id === run.run_id);
  if (foundIdx >= 0) {
    SF_STATE.QUEUE = SF_STATE.QUEUE.map((j, idx) => idx === foundIdx ? { ...j, ...queueItem } : j);
  } else {
    SF_STATE.QUEUE = [queueItem, ...SF_STATE.QUEUE];
  }
  _setGlobalsFromState();
}

function applyRuntime({ health, integrations, me, workerStatus }) {
  if (health) {
    SF_STATE.UI_RUNTIME.health = health;
    SF_STATE.UI_RUNTIME.runtime = {
      provider: health.provider || SF_STATE.UI_RUNTIME.runtime.provider,
      base_url: health.base_url || SF_STATE.UI_RUNTIME.runtime.base_url,
      model: health.model || SF_STATE.UI_RUNTIME.runtime.model,
    };
  }
  if (integrations && Array.isArray(integrations.items)) {
    SF_STATE.UI_RUNTIME.integrations = integrations.items;
    if (integrations.counts) {
      SF_STATE.UI_RUNTIME.queue = integrations.counts;
    }
    if (integrations.ui_config) {
      SF_STATE.UI_RUNTIME.ui_config = integrations.ui_config;
      _syncCatalogsFromUiConfig(SF_STATE.UI_RUNTIME.ui_config);
    }
  }
  if (me) {
    SF_STATE.UI_RUNTIME.me = me;
  }
  if (workerStatus) {
    SF_STATE.UI_RUNTIME.worker = workerStatus.worker || SF_STATE.UI_RUNTIME.worker;
    SF_STATE.UI_RUNTIME.queue = workerStatus.queue || SF_STATE.UI_RUNTIME.queue;
    SF_STATE.UI_RUNTIME.runtime = workerStatus.runtime || SF_STATE.UI_RUNTIME.runtime;
  }
  _setGlobalsFromState();
}

function applyUiConfig(uiConfig) {
  if (uiConfig && typeof uiConfig === "object") {
    SF_STATE.UI_RUNTIME.ui_config = uiConfig;
    _syncCatalogsFromUiConfig(uiConfig);
    _setGlobalsFromState();
  }
}

function _syncCatalogsFromUiConfig(uiConfig) {
  const workers = Array.isArray(uiConfig?.worker_registry) ? uiConfig.worker_registry : [];
  if (workers.length > 0) {
    const merged = [];
    const seen = new Set();
    // Keep backend-provided worker list first (user-edited labels/descriptions).
    for (const w of workers) {
      if (!w || !w.id) continue;
      const id = String(w.id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push({
        id,
        label: String(w.label || w.id),
        desc: String(w.desc || ""),
      });
    }
    // Append any built-in workers that are missing so dropdowns never shrink unexpectedly.
    for (const w of WORKERS_ALL) {
      if (!w || !w.id) continue;
      const id = String(w.id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push({
        id,
        label: String(w.label || w.id),
        desc: String(w.desc || ""),
      });
    }
    WORKERS_ALL.length = 0;
    WORKERS_ALL.push(...merged);
    window.WORKERS_ALL = WORKERS_ALL;
  }
}

// Expose globals expected by existing screens
window.INTENTS = INTENTS;
window.WORKERS_ALL = WORKERS_ALL;
window.AUDIENCES = AUDIENCES;
window.REPORT_PROFILES = REPORT_PROFILES;
window.STRUCTURED_TEMPLATE_LIBRARY = STRUCTURED_TEMPLATE_LIBRARY;
window.CREDIT_RATIO_PRESETS = CREDIT_RATIO_PRESETS;
window.CREDIT_RATIO_DEFAULT_ROWS = CREDIT_RATIO_DEFAULT_ROWS;
window.MODEL_RULE_PRESETS = MODEL_RULE_PRESETS;
window.CLOUD_API_PROVIDER_META = CLOUD_API_PROVIDER_META;
window.INTEGRATION_CATALOG = INTEGRATION_CATALOG;
window.cloudProviderMeta = (provider) => CLOUD_API_PROVIDER_META.find((p) => p.id === provider) || null;
window.integrationMeta = (provider) => INTEGRATION_CATALOG[provider] || null;
window.resolveReportProfile = (profileId) => REPORT_PROFILES.find((p) => p.id === profileId) || REPORT_PROFILES[0] || null;
_setGlobalsFromState();

window.SF_STATE = SF_STATE;
window.applyRuns = applyRuns;
window.applyRunDetail = applyRunDetail;
window.applyRuntime = applyRuntime;
window.applyUiConfig = applyUiConfig;
window.getArtifactsForRun = (runId) => (SF_STATE.ARTIFACTS_BY_RUN && SF_STATE.ARTIFACTS_BY_RUN[runId]) || [];

window.cls = (...xs) => xs.filter(Boolean).join(" ");
window.intentMeta = (id) => INTENTS.find((t) => t.id === id) || INTENTS[0];
window.workerMeta = (id) => WORKERS_ALL.find((w) => w.id === id) || { id, label: id || "—", desc: "" };
window.fmtBytes = (b) => {
  if (!b) return "—";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
};
window.fileExt = (name) => {
  const e = (name || "").split(".").pop().toUpperCase();
  return e.length > 5 ? "FILE" : e;
};
