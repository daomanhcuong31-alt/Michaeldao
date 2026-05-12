function Settings({ runtime, onSaveConfig }) {
  const health = runtime?.health || {};
  const me = runtime?.me || {};
  const worker = runtime?.worker || {};
  const provider = runtime?.runtime || {};
  const uiCfg = runtime?.ui_config || {};
  const d = uiCfg.defaults || {};
  const policy = uiCfg.policy || {};
  const rag = uiCfg.rag || {};
  const account = uiCfg.account_profile || {};
  const standingFileRef = React.useRef(null);
  const knowledgeFileRef = React.useRef(null);
  const ragFileRef = React.useRef(null);
  const marketFileRef = React.useRef(null);
  const reportProfiles = Array.isArray(window.REPORT_PROFILES) ? window.REPORT_PROFILES : [];
  const templateLibrary = Array.isArray(window.STRUCTURED_TEMPLATE_LIBRARY) ? window.STRUCTURED_TEMPLATE_LIBRARY : [];
  const ratioPresets = Array.isArray(window.CREDIT_RATIO_PRESETS) ? window.CREDIT_RATIO_PRESETS : [];
  const modelRulePresets = Array.isArray(window.MODEL_RULE_PRESETS) ? window.MODEL_RULE_PRESETS : [];
  const resolveReportProfile = window.resolveReportProfile || ((profileId) => reportProfiles.find((p) => p.id === profileId) || reportProfiles[0] || {});

  const sections = [
    { id: "defaults", label: "Business defaults" },
    { id: "reports", label: "Reports & templates" },
    { id: "credit", label: "Credit policy" },
    { id: "knowledge", label: "Knowledge" },
    { id: "workers", label: "Workers" },
    { id: "models", label: "Models" },
    { id: "system", label: "System" },
  ];
  const initialSettingsSection = () => {
    try {
      const requested = String(new URL(window.location.href).searchParams.get("section") || "").trim();
      return sections.some((section) => section.id === requested) ? requested : "defaults";
    } catch (_) {
      return "defaults";
    }
  };

  const starterOutputTemplates = {
    credit_memo: "Executive Summary, Borrower Profile, Transaction Summary, Financial Analysis, Risk & Mitigants, Covenants, Recommendation.",
    sop: "Purpose, Scope, Roles, Inputs, Procedure Steps, Controls, Escalation, Exceptions, Appendix.",
    meeting_minutes: "Meeting Metadata, Attendees, Agenda, Discussion Summary, Decisions, Action Items, Owners, Due Dates.",
    pipeline_report: "Snapshot KPIs, Pipeline by Stage, Movements, Risk Flags, Follow-up Actions, Next Review.",
  };

  const starterWorkers = [
    { id: "ingestion", label: "Ingestion", desc: "Parse and normalize uploaded files and pasted text", enabled: true, category: "core", engage_when: "Always for new inputs", default_intent: "custom" },
    { id: "market_intel", label: "Market Intel", desc: "Industry, market and comparable-company context", enabled: true, category: "research", engage_when: "When external context or market view is requested", default_intent: "full_e2e" },
    { id: "analysis_parallel", label: "Analysis", desc: "Financial and credit risk analysis", enabled: true, category: "analysis", engage_when: "When ratios, trends, or risk analysis are needed", default_intent: "memo_only" },
    { id: "financial_modeler", label: "Financial Modeler", desc: "Projection and sensitivity model support", enabled: true, category: "analysis", engage_when: "When data tables, forecasts, or downside cases are uploaded", default_intent: "memo_only" },
    { id: "compliance", label: "Compliance", desc: "Policy, covenant and regulatory checks", enabled: true, category: "control", engage_when: "When decision recommendation or covenant checks are requested", default_intent: "memo_only" },
    { id: "memo_architect", label: "Memo Architect", desc: "Synthesize final report, memo, SOP or minutes", enabled: true, category: "drafting", engage_when: "When output must be stakeholder-ready", default_intent: "custom" },
    { id: "senior_advisor", label: "Senior Advisor", desc: "QA, decision framing and escalation review", enabled: true, category: "control", engage_when: "Before final stakeholder output", default_intent: "custom" },
    { id: "admin_ops", label: "Admin Ops", desc: "Meeting minutes and SOP drafting", enabled: true, category: "ops", engage_when: "When meeting notes or workflow documentation are requested", default_intent: "custom" },
    { id: "data_analyst", label: "Data Analyst", desc: "Pipeline tracking, Excel reporting and data analysis", enabled: true, category: "analytics", engage_when: "When spreadsheets or pipeline reports are uploaded", default_intent: "custom" },
  ];

  const starterModels = [
    { id: "qwen/qwen3.5-9b", label: "Qwen 3.5 9B", provider: "local", llm_provider: "lm_studio", endpoint: "http://127.0.0.1:1234/v1", enabled: true, is_default: true, engage_when: "Normal drafting, extraction, private local work", cost_hint_usd: "0", notes: "Local model via LM Studio" },
    { id: "gpt-4.1", label: "GPT-4.1", provider: "cloud", llm_provider: "hermes", endpoint: "https://api.openai.com/v1", enabled: false, is_default: false, engage_when: "High-stakes reasoning or difficult rewrite tasks", cost_hint_usd: "0.03", notes: "Cloud fallback when configured" },
    { id: "claude-sonnet-4", label: "Claude Sonnet", provider: "cloud", llm_provider: "hermes", endpoint: "https://api.anthropic.com", enabled: false, is_default: false, engage_when: "Long-context analysis and structured drafting", cost_hint_usd: "0.03", notes: "Cloud fallback when configured" },
    { id: "perplexity", label: "Perplexity", provider: "cloud", llm_provider: "hermes", endpoint: "https://api.perplexity.ai", enabled: false, is_default: false, engage_when: "Market research requiring search-style synthesis", cost_hint_usd: "0.01", notes: "Use only when API key is configured" },
  ];

  const normalizeWorkers = (items) => {
    const source = Array.isArray(items) && items.length ? items : starterWorkers;
    return source.map((row, idx) => ({
      id: String(row.id || `worker_${idx + 1}`),
      label: String(row.label || row.id || `Worker ${idx + 1}`),
      desc: String(row.desc || ""),
      enabled: row.enabled !== false,
      category: String(row.category || "custom"),
      engage_when: String(row.engage_when || ""),
      default_intent: String(row.default_intent || ""),
    }));
  };

  const normalizeModels = (items) => {
    const source = Array.isArray(items) && items.length ? items : starterModels;
    return source.map((row, idx) => ({
      id: String(row.id || `model_${idx + 1}`),
      label: String(row.label || row.id || `Model ${idx + 1}`),
      provider: String(row.provider || "local"),
      llm_provider: String(row.llm_provider || (String(row.provider || "").toLowerCase() === "local" ? "lm_studio" : "hermes")),
      endpoint: String(row.endpoint || ""),
      enabled: row.enabled !== false,
      is_default: Boolean(row.is_default),
      engage_when: String(row.engage_when || ""),
      cost_hint_usd: String(row.cost_hint_usd ?? ""),
      notes: String(row.notes || ""),
    }));
  };

  const templateRowsFromObject = (obj) => {
    const source = (obj && typeof obj === "object" && !Array.isArray(obj)) ? obj : starterOutputTemplates;
    const rows = Object.entries({ ...starterOutputTemplates, ...source }).map(([key, value]) => ({ key, value: String(value || "") }));
    return rows.length ? rows : Object.entries(starterOutputTemplates).map(([key, value]) => ({ key, value }));
  };

  const normalizeRatioRules = (curPolicy) => {
    const thresholds = curPolicy?.credit_thresholds || {};
    const saved = Array.isArray(curPolicy?.credit_ratio_rules) ? curPolicy.credit_ratio_rules : [];
    const presetRows = ratioPresets.map((preset, idx) => {
      const savedRow = saved.find((row) => row && row.id === preset.id) || {};
      return {
        id: preset.id,
        label: savedRow.label || preset.label,
        description: savedRow.description || preset.description,
        formula: savedRow.formula || preset.formula,
        value: String(thresholds[preset.id] ?? savedRow.value ?? preset.value ?? ""),
        locked: true,
        enabled: savedRow.enabled !== false,
        order: idx,
      };
    });
    const extras = saved
      .filter((row) => row && row.id && !ratioPresets.some((preset) => preset.id === row.id))
      .map((row, idx) => ({
        id: String(row.id || `custom_ratio_${idx + 1}`),
        label: String(row.label || row.id || `Custom ratio ${idx + 1}`),
        description: String(row.description || ""),
        formula: String(row.formula || ""),
        value: String(row.value ?? ""),
        locked: false,
        enabled: row.enabled !== false,
        order: presetRows.length + idx,
      }));
    return [...presetRows, ...extras];
  };

  const [activeSection, setActiveSection] = React.useState(initialSettingsSection);
  const [showAdvancedJson, setShowAdvancedJson] = React.useState(false);
  const [intent, setIntent] = React.useState(d.intent || "memo_only");
  const [audience, setAudience] = React.useState(d.audience || "credit_committee");
  const [routeMode, setRouteMode] = React.useState(d.route_mode || "auto");
  const [postCredit, setPostCredit] = React.useState(d.post_credit || "stop");
  const [humanGate, setHumanGate] = React.useState(d.human_gate || "approve");
  const [fast, setFast] = React.useState(d.fast !== false);
  const [noWeb, setNoWeb] = React.useState(d.no_web_research === true);
  const [autonomous, setAutonomous] = React.useState(d.autonomous !== false);
  const [outputFormats, setOutputFormats] = React.useState(Array.isArray(d.output_formats) && d.output_formats.length ? d.output_formats : ["txt", "docx", "xlsx"]);
  const [reportLengthWords, setReportLengthWords] = React.useState(Number(policy.report_length_words || 1800));
  const [reportProfile, setReportProfile] = React.useState(String(resolveReportProfile(policy.report_format || reportProfiles[0]?.id || "credit_memo_v2")?.id || reportProfiles[0]?.id || "credit_memo_v2"));
  const [sopFormat, setSopFormat] = React.useState(String(resolveReportProfile(policy.report_format || reportProfiles[0]?.id || "credit_memo_v2")?.sop_format || policy.sop_format || "standard_sop"));
  const [creditDecisionMode, setCreditDecisionMode] = React.useState(String(policy.credit_decision_mode || "analysis_only"));
  const [structuredTemplateId, setStructuredTemplateId] = React.useState(String(policy.output_template_default || "autonomous"));
  const [conditionPrecedentsEnabled, setConditionPrecedentsEnabled] = React.useState(Boolean(String(policy.condition_precedents || "").trim()));
  const [conditionPrecedents, setConditionPrecedents] = React.useState(String(policy.condition_precedents || ""));
  const [adhocCriteria, setAdhocCriteria] = React.useState(String(policy.adhoc_criteria || ""));
  const [structuredOutputInstruction, setStructuredOutputInstruction] = React.useState(String(policy.structured_output_instruction || ""));
  const [marketIntelInstruction, setMarketIntelInstruction] = React.useState(String(policy.market_intel_instruction || ""));
  const [marketIntelAttachments, setMarketIntelAttachments] = React.useState(() => settingsNormalizeAttachmentRefs(policy.market_intel_attachments));
  const [standingInstruction, setStandingInstruction] = React.useState(String(uiCfg.standing_instruction || ""));
  const [knowledgeBaseNotes, setKnowledgeBaseNotes] = React.useState(String(uiCfg.knowledge_base_notes || ""));
  const [standingInstructionAttachments, setStandingInstructionAttachments] = React.useState(() => settingsNormalizeAttachmentRefs(uiCfg.standing_instruction_attachments));
  const [knowledgeBaseAttachments, setKnowledgeBaseAttachments] = React.useState(() => settingsNormalizeAttachmentRefs(uiCfg.knowledge_base_attachments));
  const [ragEnabled, setRagEnabled] = React.useState(Boolean(rag.enabled));
  const [ragInstruction, setRagInstruction] = React.useState(String(rag.instruction || ""));
  const [ragReferencesText, setRagReferencesText] = React.useState(Array.isArray(rag.references) ? rag.references.join("\n") : "");
  const [ragAttachments, setRagAttachments] = React.useState(() => settingsNormalizeAttachmentRefs(rag.attachments));
  const [knowledgeDirty, setKnowledgeDirty] = React.useState(false);
  const [systemDirty, setSystemDirty] = React.useState(false);
  const [operatorName, setOperatorName] = React.useState(String(account.operator_name || me.name || "Local Operator"));
  const [workspaceName, setWorkspaceName] = React.useState(String(account.workspace || me.workspace || "SF Agentic AI"));
  const [systemApiKey, setSystemApiKey] = React.useState(localStorage.getItem("sf_api_key") || "");
  const [ratioRules, setRatioRules] = React.useState(() => normalizeRatioRules(policy));
  const [outputTemplateRows, setOutputTemplateRows] = React.useState(() => templateRowsFromObject(uiCfg.output_templates));
  const [workerRegistry, setWorkerRegistry] = React.useState(() => normalizeWorkers(uiCfg.worker_registry));
  const [modelRegistry, setModelRegistry] = React.useState(() => normalizeModels(uiCfg.model_registry));

  React.useEffect(() => {
    const cur = runtime?.ui_config?.defaults || {};
    const curPolicy = runtime?.ui_config?.policy || {};
    const curRag = runtime?.ui_config?.rag || {};
    setIntent(cur.intent || "memo_only");
    setAudience(cur.audience || "credit_committee");
    setRouteMode(cur.route_mode || "auto");
    setPostCredit(cur.post_credit || "stop");
    setHumanGate(cur.human_gate || "approve");
    setFast(cur.fast !== false);
    setNoWeb(cur.no_web_research === true);
    setAutonomous(cur.autonomous !== false);
    setOutputFormats(Array.isArray(cur.output_formats) && cur.output_formats.length ? cur.output_formats : ["txt", "docx", "xlsx"]);
    setReportLengthWords(Number(curPolicy.report_length_words || 1800));
    const nextProfile = resolveReportProfile(String(curPolicy.report_format || reportProfiles[0]?.id || "credit_memo_v2"));
    setReportProfile(String(nextProfile?.id || reportProfiles[0]?.id || "credit_memo_v2"));
    setSopFormat(String(nextProfile?.sop_format || curPolicy.sop_format || "standard_sop"));
    setCreditDecisionMode(String(curPolicy.credit_decision_mode || "analysis_only"));
    setStructuredTemplateId(String(curPolicy.output_template_default || "autonomous"));
    setConditionPrecedents(String(curPolicy.condition_precedents || ""));
    setConditionPrecedentsEnabled(Boolean(String(curPolicy.condition_precedents || "").trim()));
    setAdhocCriteria(String(curPolicy.adhoc_criteria || ""));
    setStructuredOutputInstruction(String(curPolicy.structured_output_instruction || ""));
    if (!knowledgeDirty) {
      setStandingInstruction(String(runtime?.ui_config?.standing_instruction || ""));
      setKnowledgeBaseNotes(String(runtime?.ui_config?.knowledge_base_notes || ""));
      setStandingInstructionAttachments(settingsNormalizeAttachmentRefs(runtime?.ui_config?.standing_instruction_attachments));
      setKnowledgeBaseAttachments(settingsNormalizeAttachmentRefs(runtime?.ui_config?.knowledge_base_attachments));
      setMarketIntelInstruction(String(curPolicy.market_intel_instruction || ""));
      setMarketIntelAttachments(settingsNormalizeAttachmentRefs(curPolicy.market_intel_attachments));
      setRagEnabled(Boolean(curRag.enabled));
      setRagInstruction(String(curRag.instruction || ""));
      setRagReferencesText(Array.isArray(curRag.references) ? curRag.references.join("\n") : "");
      setRagAttachments(settingsNormalizeAttachmentRefs(curRag.attachments));
    }
    if (!systemDirty) {
      const curAccount = runtime?.ui_config?.account_profile || {};
      setOperatorName(String(curAccount.operator_name || runtime?.me?.name || "Local Operator"));
      setWorkspaceName(String(curAccount.workspace || runtime?.me?.workspace || "SF Agentic AI"));
    }
    setRatioRules(normalizeRatioRules(curPolicy));
    setOutputTemplateRows(templateRowsFromObject(runtime?.ui_config?.output_templates));
    setWorkerRegistry(normalizeWorkers(runtime?.ui_config?.worker_registry));
    setModelRegistry(normalizeModels(runtime?.ui_config?.model_registry));
  }, [runtime?.ui_config, knowledgeDirty, systemDirty]);

  const status = health.ready ? "ready" : "not ready";
  const selectedReportProfile = resolveReportProfile(reportProfile);
  const filteredTemplates = React.useMemo(() => {
    const profIntent = selectedReportProfile.intent;
    if (!profIntent || profIntent === "custom") return templateLibrary;
    const base = profIntent.split("_plus_")[0];
    return templateLibrary.filter(t => 
        t.id === "autonomous" || 
        t.id === "custom" || 
        t.id === profIntent || 
        t.id === base ||
        (t.id && profIntent.startsWith(t.id))
    );
  }, [selectedReportProfile, templateLibrary]);

  const selectedStructuredTemplate = templateLibrary.find((x) => x.id === structuredTemplateId) || null;
  const enabledWorkers = workerRegistry.filter((w) => w.enabled).length;
  const enabledModels = modelRegistry.filter((m) => m.enabled).length;
  const defaultModel = modelRegistry.find((m) => m.is_default) || modelRegistry[0] || {};

  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (activeSection === "defaults") {
        url.searchParams.delete("section");
      } else {
        url.searchParams.set("section", activeSection);
      }
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}
  }, [activeSection]);

  const toggleOutputFormat = (fmt) => {
    setOutputFormats((prev) => {
      const exists = prev.includes(fmt);
      const next = exists ? prev.filter((x) => x !== fmt) : [...prev, fmt];
      return next.length ? next : ["txt"];
    });
  };

  const applyReportProfile = (profileId) => {
    const profile = resolveReportProfile(profileId) || reportProfiles[0] || {};
    setReportProfile(profileId);
    setSopFormat(profile.sop_format || "standard_sop");
    setStructuredTemplateId(profile.structured_template || "autonomous");
    if (Array.isArray(profile.output_formats) && profile.output_formats.length) {
      setOutputFormats(profile.output_formats);
    }
  };

  const updateRatio = (idx, patch) => setRatioRules((prev) => prev.map((row, i) => i === idx ? { ...row, ...patch } : row));
  const addRatio = () => setRatioRules((prev) => [...prev, { id: `custom_ratio_${prev.length + 1}`, label: "Custom ratio", description: "", formula: "", value: "", locked: false, enabled: true, order: prev.length }]);
  const removeRatio = (idx) => setRatioRules((prev) => prev.filter((_, i) => i !== idx));
  const updateTemplate = (idx, patch) => setOutputTemplateRows((prev) => prev.map((row, i) => i === idx ? { ...row, ...patch } : row));
  const addTemplate = () => setOutputTemplateRows((prev) => [...prev, { key: `custom_template_${prev.length + 1}`, value: "" }]);
  const removeTemplate = (idx) => setOutputTemplateRows((prev) => prev.filter((_, i) => i !== idx));
  const updateWorker = (idx, patch) => setWorkerRegistry((prev) => prev.map((row, i) => i === idx ? { ...row, ...patch } : row));
  const addWorker = () => setWorkerRegistry((prev) => [...prev, { id: `custom_worker_${prev.length + 1}`, label: "Custom worker", desc: "", enabled: true, category: "custom", engage_when: "", default_intent: "custom" }]);
  const removeWorker = (idx) => setWorkerRegistry((prev) => prev.filter((_, i) => i !== idx));
  const updateModel = (idx, patch) => setModelRegistry((prev) => prev.map((row, i) => ({ ...row, ...(i === idx ? patch : {}), is_default: patch.is_default ? i === idx : row.is_default })));
  const addModel = () => setModelRegistry((prev) => [...prev, { id: `custom_model_${prev.length + 1}`, label: "Custom model", provider: "cloud", llm_provider: "hermes", endpoint: "", enabled: false, is_default: false, engage_when: "", cost_hint_usd: "", notes: "" }]);
  const removeModel = (idx) => setModelRegistry((prev) => prev.filter((_, i) => i !== idx));
  const markKnowledgeDirty = () => setKnowledgeDirty(true);
  const markSystemDirty = () => setSystemDirty(true);

  const updateDefaultRuntimeModel = (patch) => {
    markSystemDirty();
    setModelRegistry((prev) => {
      const list = prev.length ? prev : normalizeModels([]);
      const defaultIdx = Math.max(0, list.findIndex((m) => m.is_default));
      const idx = defaultIdx >= 0 ? defaultIdx : 0;
      const current = list[idx] || {};
      const nextProvider = patch.llm_provider || current.llm_provider || provider.provider || "lm_studio";
      const nextId = patch.id || current.id || provider.model || "qwen/qwen3.5-9b";
      const nextEndpoint = patch.endpoint || current.endpoint || provider.base_url || "http://127.0.0.1:1234/v1";
      const nextRow = {
        ...current,
        id: String(nextId),
        label: String(patch.label || current.label || nextId),
        provider: nextProvider === "lm_studio" ? "local" : "cloud",
        llm_provider: String(nextProvider),
        endpoint: String(nextEndpoint),
        enabled: true,
        is_default: true,
        engage_when: current.engage_when || "Default for new jobs",
      };
      return list.map((row, i) => ({ ...row, ...(i === idx ? nextRow : {}), is_default: i === idx }));
    });
  };

  const uploadAndTrack = async (files, setState) => {
    if (!files || !files.length) return [];
    markKnowledgeDirty();
    const uploaded = await window.Api.uploadFiles(files);
    setState((prev) => [...prev, ...uploaded.map((f) => ({ file_id: f.file_id, name: f.name, size_bytes: f.size_bytes }))]);
    return uploaded;
  };

  const saveDefaults = () => {
    const refs = ragReferencesText.split("\n").map((line) => line.trim()).filter(Boolean);
    const ratioRows = ratioRules
      .map((row, idx) => ({
        id: String(row.id || "").trim(),
        label: String(row.label || row.id || "").trim(),
        description: String(row.description || "").trim(),
        formula: String(row.formula || "").trim(),
        value: String(row.value ?? "").trim(),
        locked: Boolean(row.locked),
        enabled: row.enabled !== false,
        order: idx,
      }))
      .filter((row) => row.id && row.label);
    const thresholdMap = {};
    ratioRows.forEach((row) => {
      const raw = String(row.value || "").trim();
      if (!raw) return;
      const n = Number(raw);
      thresholdMap[row.id] = Number.isFinite(n) ? n : raw;
    });
    const templates = {};
    outputTemplateRows.forEach((row) => {
      const key = String(row.key || "").trim();
      const value = String(row.value || "").trim();
      if (key && value) templates[key] = value;
    });
    const workers = workerRegistry
      .map((row) => ({
        id: String(row.id || "").trim(),
        label: String(row.label || row.id || "").trim(),
        desc: String(row.desc || "").trim(),
        enabled: row.enabled !== false,
        category: String(row.category || "custom").trim(),
        engage_when: String(row.engage_when || "").trim(),
        default_intent: String(row.default_intent || "").trim(),
      }))
      .filter((row) => row.id && row.label);
    const models = modelRegistry
      .map((row, idx) => ({
        id: String(row.id || "").trim(),
        label: String(row.label || row.id || "").trim(),
        provider: String(row.provider || "local").trim(),
        llm_provider: String(row.llm_provider || "lm_studio").trim(),
        endpoint: String(row.endpoint || "").trim(),
        enabled: row.enabled !== false,
        is_default: Boolean(row.is_default) || idx === 0 && !modelRegistry.some((m) => m.is_default),
        engage_when: String(row.engage_when || "").trim(),
        cost_hint_usd: String(row.cost_hint_usd ?? "").trim(),
        notes: String(row.notes || "").trim(),
      }))
      .filter((row) => row.id && row.label);

    const next = {
      ...uiCfg,
      account_profile: {
        operator_name: operatorName || "Local Operator",
        workspace: workspaceName || "SF Agentic AI",
      },
      standing_instruction: standingInstruction || "",
      knowledge_base_notes: knowledgeBaseNotes || "",
      standing_instruction_attachments: standingInstructionAttachments.map(settingsAttachmentId).filter(Boolean),
      knowledge_base_attachments: knowledgeBaseAttachments.map(settingsAttachmentId).filter(Boolean),
      policy: {
        ...(uiCfg.policy || {}),
        report_length_words: Number(reportLengthWords || 1800),
        report_format: reportProfile || reportProfiles[0]?.id || "credit_memo_v2",
        sop_format: sopFormat || "standard_sop",
        credit_decision_mode: creditDecisionMode || "analysis_only",
        output_template_default: structuredTemplateId || "autonomous",
        condition_precedents: conditionPrecedentsEnabled ? (conditionPrecedents || "") : "",
        adhoc_criteria: adhocCriteria || "",
        structured_output_instruction: structuredTemplateId === "custom" ? (structuredOutputInstruction || "") : "",
        market_intel_instruction: marketIntelInstruction || "",
        market_intel_attachments: marketIntelAttachments.map(settingsAttachmentId).filter(Boolean),
        credit_thresholds: thresholdMap,
        credit_ratio_rules: ratioRows,
      },
      rag: {
        ...(uiCfg.rag || {}),
        enabled: ragEnabled,
        instruction: ragInstruction || "",
        references: refs,
        attachments: ragAttachments.map(settingsAttachmentId).filter(Boolean),
      },
      defaults: {
        ...d,
        intent,
        audience,
        route_mode: routeMode,
        post_credit: postCredit,
        human_gate: humanGate,
        fast,
        no_web_research: noWeb,
        autonomous,
        output_formats: outputFormats.length ? outputFormats : ["txt"],
      },
      output_templates: templates,
      worker_registry: workers,
      model_registry: models,
    };
    localStorage.setItem("sf_api_key", systemApiKey || "");
    window.__SF_API_KEY = systemApiKey || "";
    const saveResult = onSaveConfig && onSaveConfig(next);
    Promise.resolve(saveResult).then(() => { setKnowledgeDirty(false); setSystemDirty(false); }).catch(() => {});
    return saveResult;
  };

  const onIntentChange = (id) => {
    setIntent(id);
    const matchingProfile = reportProfiles.find(p => p.intent === id) || 
                           reportProfiles.find(p => id.startsWith(p.intent));
    if (matchingProfile) {
      applyReportProfile(matchingProfile.id);
    }
  };

  return (
    <div data-screen-label="06 Settings">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 className="h1">Settings <span className="h1-serif">— business controls</span></h1>
          <p className="sub">Defaults are grouped by how you work: run behavior, output profiles, credit policy, knowledge, workers, and models.</p>
        </div>
        <button className="btn btn-primary" onClick={saveDefaults}><I.Check size={13} /> Save production config</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <KPI label="Runtime" value={provider.provider || "lm_studio"} trend={health.ready ? "ready" : "not ready"} up={health.ready} />
        <KPI label="Default model" value={defaultModel.label || provider.model || "—"} trend={defaultModel.provider || "local"} />
        <KPI label="Workers" value={`${enabledWorkers}/${workerRegistry.length}`} trend="enabled" />
        <KPI label="Formats" value={outputFormats.map((x) => x.toUpperCase()).join(" + ")} trend="default output" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {sections.map((section) => (
          <button key={section.id} type="button" className={cls("btn btn-sm", activeSection === section.id ? "btn-primary" : "btn-ghost")} onClick={() => setActiveSection(section.id)}>
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "defaults" && (
        <SettingsGrid>
          <SettingsCard title="Run behavior" desc="These are the defaults New Job starts with. You can still override them per run.">
            <LabelInput label="Default Intent" control={<select className="select" value={intent} onChange={(e) => onIntentChange(e.target.value)}>{INTENTS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>} />
            <LabelInput label="Audience" control={<select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>{AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>} />
            <LabelInput label="Route mode" control={<select className="select" value={routeMode} onChange={(e) => setRouteMode(e.target.value)}>{["auto", "full", "targeted"].map((x) => <option key={x}>{x}</option>)}</select>} />
            <LabelInput label="Post credit" control={<select className="select" value={postCredit} onChange={(e) => setPostCredit(e.target.value)}>{["ask", "stop", "holdbook", "distribution", "hybrid"].map((x) => <option key={x}>{x}</option>)}</select>} />
            <LabelInput label="Human gate" control={<select className="select" value={humanGate} onChange={(e) => setHumanGate(e.target.value)}>{["ask", "approve", "revise", "stop"].map((x) => <option key={x}>{x}</option>)}</select>} />
          </SettingsCard>
          <SettingsCard title="Operating toggles" desc="Keep local personal workflow fast, private, and non-interactive unless you decide otherwise.">
            <ToggleLine label="Autonomous" hint="No terminal prompts; UI controls the run." value={autonomous} onChange={setAutonomous} />
            <ToggleLine label="Fast mode" hint="Lower latency for local model runs." value={fast} onChange={setFast} />
            <ToggleLine label="No web research" hint="Avoid external research unless explicitly enabled." value={noWeb} onChange={setNoWeb} />
            <LabelInput label="Output formats" control={<FormatPicker formats={outputFormats} onToggle={toggleOutputFormat} />} />
          </SettingsCard>
        </SettingsGrid>
      )}

      {activeSection === "reports" && (
        <SettingsGrid>
          <SettingsCard title="Report profile" desc="One profile controls report type, structured template, SOP flavor and default formats.">
            <LabelInput label="Profile" control={<select className="select mono" value={reportProfile} onChange={(e) => applyReportProfile(e.target.value)}>{reportProfiles.map((p) => <option key={p.id} value={p.id}>{p.label} ({p.intent || "neutral"})</option>)}</select>} />
            <LabelInput label="Length" control={<input className="input mono" type="number" min={300} max={12000} value={reportLengthWords} onChange={(e) => setReportLengthWords(Number(e.target.value || 0))} />} />
            <InfoBox>{selectedReportProfile?.description || "Linked report profile"}<br />Report: {selectedReportProfile?.report_format || reportProfile} · SOP: {sopFormat} · Formats: {outputFormats.join(", ")}</InfoBox>
            <LabelInput label="Structured output" control={<select className="select mono" value={structuredTemplateId} onChange={(e) => setStructuredTemplateId(e.target.value)}>{filteredTemplates.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>} />
            <InfoBox>{selectedStructuredTemplate?.desc || "Worker chooses structure when autonomous is selected."}</InfoBox>
            {structuredTemplateId === "custom" && <LabelInput label="Custom template" control={<textarea className="textarea mono" rows={5} value={structuredOutputInstruction} onChange={(e) => setStructuredOutputInstruction(e.target.value)} placeholder="Paste exact sections, tables or required output structure." />} />}
          </SettingsCard>
          <SettingsCard title="Template library" desc="Business-friendly template editor. Add sections here instead of editing JSON.">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOutputTemplateRows(templateRowsFromObject(starterOutputTemplates))}>Load starter templates</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addTemplate}>Add template</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {outputTemplateRows.map((row, idx) => <TemplateCard key={`${row.key}-${idx}`} row={row} idx={idx} onChange={updateTemplate} onRemove={removeTemplate} />)}
            </div>
          </SettingsCard>
        </SettingsGrid>
      )}

      {activeSection === "credit" && (
        <SettingsGrid>
          <SettingsCard title="Credit objective" desc="Ratios and decision logic apply only when a Credit Memo intent is active. Neutral intents ignore these settings.">
            <LabelInput label="Objective" control={<select className="select mono" value={creditDecisionMode} onChange={(e) => setCreditDecisionMode(e.target.value)}><option value="analysis_only">Analysis only</option><option value="decision_recommendation">Decision recommendation</option></select>} />
            <LabelInput label="Condition precedents" control={<select className="select mono" value={conditionPrecedentsEnabled ? "yes" : "no"} onChange={(e) => { const yes = e.target.value === "yes"; setConditionPrecedentsEnabled(yes); if (yes && !conditionPrecedents) setConditionPrecedents("Signed term sheet\nBoard approval\nLegal due diligence complete"); }}><option value="no">No - do not recommend CPs by default</option><option value="yes">Yes - worker should recommend CPs</option></select>} />
            {conditionPrecedentsEnabled && <LabelInput label="CP guidance" control={<textarea className="textarea" rows={5} value={conditionPrecedents} onChange={(e) => setConditionPrecedents(e.target.value)} placeholder="One condition precedent per line" />} />}
            <LabelInput label="Ad-hoc criteria" control={<textarea className="textarea" rows={4} value={adhocCriteria} onChange={(e) => setAdhocCriteria(e.target.value)} placeholder="Custom decision criteria, constraints, or deal-specific rules." />} />
          </SettingsCard>
          <SettingsCard title="Credit ratio rules" desc="Use presets for normal banking ratios. Add or remove deal-specific ratios as needed.">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <div className="dim mono" style={{ fontSize: 11 }}>{ratioRules.length} ratio rules</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addRatio}>Add ratio</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ratioRules.map((row, idx) => <RatioCard key={`${row.id}-${idx}`} row={row} idx={idx} onChange={updateRatio} onRemove={removeRatio} />)}
            </div>
          </SettingsCard>
        </SettingsGrid>
      )}

      {activeSection === "knowledge" && (
        <SettingsGrid>
          <SettingsCard title="Standing instruction" desc="Global operating instruction applied to every run unless a New Job input overrides it.">
            <LabelInput label="Instruction" control={<textarea className="textarea" rows={5} value={standingInstruction} onChange={(e) => { markKnowledgeDirty(); setStandingInstruction(e.target.value); }} placeholder="E.g. prioritize debt service sensitivity, downside covenants, and source-backed findings." />} />
            <AttachmentPicker
              label="Files"
              hint="Attach .txt/.md/.docx/.pdf files for standing instructions."
              fileRef={standingFileRef}
              attachments={standingInstructionAttachments}
              setAttachments={setStandingInstructionAttachments}
              onUpload={uploadAndTrack}
              onDirty={markKnowledgeDirty}
            />
          </SettingsCard>
          <SettingsCard title="Knowledge base" desc="Global house policy, memo samples, SOPs, glossary, and other reusable references.">
            <LabelInput label="Notes" control={<textarea className="textarea" rows={5} value={knowledgeBaseNotes} onChange={(e) => { markKnowledgeDirty(); setKnowledgeBaseNotes(e.target.value); }} placeholder="Paste reusable policy notes, house style, credit heuristics, or template guidance." />} />
            <AttachmentPicker
              label="Files"
              hint="Attach policy packs, SOPs, memo examples, and reference documents."
              fileRef={knowledgeFileRef}
              attachments={knowledgeBaseAttachments}
              setAttachments={setKnowledgeBaseAttachments}
              onUpload={uploadAndTrack}
              onDirty={markKnowledgeDirty}
            />
          </SettingsCard>
          <SettingsCard title="RAG / knowledge instructions" desc="Controls how workers use saved references. Per-run files and notes can still supplement these defaults.">
            <ToggleLine label="RAG enabled" hint="Use saved references and policy notes as run context." value={ragEnabled} onChange={(v) => { markKnowledgeDirty(); setRagEnabled(v); }} />
            <LabelInput label="Instruction" control={<textarea className="textarea" rows={5} value={ragInstruction} onChange={(e) => { markKnowledgeDirty(); setRagInstruction(e.target.value); }} placeholder="How workers should use internal knowledge, templates and policy." />} />
            <LabelInput label="References" control={<textarea className="textarea mono" rows={8} value={ragReferencesText} onChange={(e) => { markKnowledgeDirty(); setRagReferencesText(e.target.value); }} placeholder="One reference per line: URL, file path, document name, policy ID" />} />
            <AttachmentPicker
              label="RAG files"
              hint="Attach RAG reference files to pass as knowledge context."
              fileRef={ragFileRef}
              attachments={ragAttachments}
              setAttachments={setRagAttachments}
              onUpload={uploadAndTrack}
              onDirty={markKnowledgeDirty}
            />
          </SettingsCard>
          <SettingsCard title="Market intelligence" desc="Default research direction for market intel worker. Keep this broad; add deal-specific prompts in New Job.">
            <LabelInput label="Market prompt" control={<textarea className="textarea" rows={7} value={marketIntelInstruction} onChange={(e) => { markKnowledgeDirty(); setMarketIntelInstruction(e.target.value); }} placeholder="E.g. focus on sector downside, refinancing risk, and comparable default cases." />} />
            <AttachmentPicker
              label="Research files"
              hint="Attach market notes, sector reports, or comparable transaction references."
              fileRef={marketFileRef}
              attachments={marketIntelAttachments}
              setAttachments={setMarketIntelAttachments}
              onUpload={uploadAndTrack}
              onDirty={markKnowledgeDirty}
            />
          </SettingsCard>
        </SettingsGrid>
      )}

      {activeSection === "workers" && (
        <SettingsCard title="Worker registry" desc="Enable, disable and describe workers without touching JSON. New Job will use these worker names and routing hints.">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <div className="dim mono" style={{ fontSize: 11 }}>{enabledWorkers} enabled · {workerRegistry.length} registered</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWorkerRegistry(starterWorkers)}>Load starter workers</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addWorker}>Add worker</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {workerRegistry.map((row, idx) => <WorkerCard key={`${row.id}-${idx}`} row={row} idx={idx} onChange={updateWorker} onRemove={removeWorker} />)}
          </div>
        </SettingsCard>
      )}

      {activeSection === "models" && (
        <SettingsCard title="Model registry and routing rules" desc="Local LM Studio remains the default. Cloud models can stay disabled until API keys and cost controls are ready.">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <div className="dim mono" style={{ fontSize: 11 }}>{enabledModels} enabled · default: {defaultModel.label || "—"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModelRegistry(starterModels)}>Load starter models</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addModel}>Add model</button>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 12, background: "var(--bg-1)" }}>
            <div className="card-pad" style={{ padding: 14 }}>
              <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>Plain-language routing rules</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                {modelRulePresets.map((rule) => <InfoBox key={rule.id}><b>{rule.label}</b><br />{rule.description}</InfoBox>)}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
            {modelRegistry.map((row, idx) => <ModelCard key={`${row.id}-${idx}`} row={row} idx={idx} onChange={updateModel} onRemove={removeModel} />)}
          </div>
        </SettingsCard>
      )}

      {activeSection === "system" && (
        <SettingsGrid>
          <SettingsCard title="Runtime status" desc="Current live backend status. These fields confirm what is running now.">
            <Field label="Provider" value={provider.provider || "lm_studio"} mono />
            <Field label="Base URL" value={provider.base_url || "—"} mono />
            <Field label="Model" value={provider.model || "—"} mono />
            <Field label="Readiness" value={status} mono />
            <Field label="Worker state" value={worker.paused ? "paused" : worker.running ? "running" : "idle"} mono />
            <Field label="Current run" value={worker.current_run || "—"} mono />
          </SettingsCard>
          <SettingsCard title="Runtime defaults" desc="Default model route for new jobs. The live readiness above still depends on LM Studio or Hermes Gateway actually running.">
            <LabelInput label="LLM provider" control={<select className="select mono" value={defaultModel.llm_provider || provider.provider || "lm_studio"} onChange={(e) => updateDefaultRuntimeModel({ llm_provider: e.target.value })}><option value="lm_studio">LM Studio local</option><option value="hermes">Hermes Gateway / cloud route</option></select>} />
            <LabelInput label="Base URL" control={<input className="input mono" value={defaultModel.endpoint || provider.base_url || ""} onChange={(e) => updateDefaultRuntimeModel({ endpoint: e.target.value })} placeholder="http://127.0.0.1:1234/v1" />} />
            <LabelInput label="Model" control={<input className="input mono" value={defaultModel.id || provider.model || ""} onChange={(e) => updateDefaultRuntimeModel({ id: e.target.value, label: e.target.value })} placeholder="qwen/qwen3.5-9b" />} />
            <InfoBox>Changing this controls future New Job defaults and model routing. If you change provider/base URL, keep LM Studio/Hermes Gateway running at that address.</InfoBox>
          </SettingsCard>
          <SettingsCard title="Account and access" desc="Local display profile and optional browser API key. Use the API key only if SF_API_KEY is enabled in the backend environment.">
            <LabelInput label="Operator" control={<input className="input" value={operatorName} onChange={(e) => { markSystemDirty(); setOperatorName(e.target.value); }} placeholder="Local Operator" />} />
            <LabelInput label="Workspace" control={<input className="input" value={workspaceName} onChange={(e) => { markSystemDirty(); setWorkspaceName(e.target.value); }} placeholder="SF Agentic AI" />} />
            <LabelInput label="Mode" control={<input className="input mono" readOnly value={me.mode || "self_hosted"} />} />
            <LabelInput label="API key" control={<input className="input mono" type="password" value={systemApiKey} onChange={(e) => { markSystemDirty(); setSystemApiKey(e.target.value); }} placeholder="Optional x-sf-api-key" />} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { localStorage.setItem("sf_api_key", systemApiKey || ""); window.__SF_API_KEY = systemApiKey || ""; }}>Save API key in browser</button>
          </SettingsCard>
          <SettingsCard title="Advanced export" desc="Advanced JSON is hidden by default; use it only for troubleshooting or handoff.">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdvancedJson(!showAdvancedJson)}>{showAdvancedJson ? "Hide" : "Show"} advanced JSON snapshot</button>
            {showAdvancedJson && <textarea className="textarea mono" rows={16} readOnly value={JSON.stringify({ account_profile: { operator_name: operatorName, workspace: workspaceName }, standing_instruction: standingInstruction, knowledge_base_notes: knowledgeBaseNotes, standing_instruction_attachments: standingInstructionAttachments.map(settingsAttachmentId).filter(Boolean), knowledge_base_attachments: knowledgeBaseAttachments.map(settingsAttachmentId).filter(Boolean), defaults: { audience, route_mode: routeMode, post_credit: postCredit, human_gate: humanGate, fast, no_web_research: noWeb, autonomous, output_formats: outputFormats }, policy: { report_length_words: reportLengthWords, report_format: reportProfile, sop_format: sopFormat, credit_decision_mode: creditDecisionMode, output_template_default: structuredTemplateId, condition_precedents: conditionPrecedentsEnabled ? conditionPrecedents : "", adhoc_criteria: adhocCriteria, structured_output_instruction: structuredOutputInstruction, market_intel_instruction: marketIntelInstruction, market_intel_attachments: marketIntelAttachments.map(settingsAttachmentId).filter(Boolean), credit_ratio_rules: ratioRules }, rag: { enabled: ragEnabled, instruction: ragInstruction, references: ragReferencesText.split("\n").filter(Boolean), attachments: ragAttachments.map(settingsAttachmentId).filter(Boolean) }, output_templates: outputTemplateRows, worker_registry: workerRegistry, model_registry: modelRegistry }, null, 2)} />}
          </SettingsCard>
        </SettingsGrid>
      )}
    </div>
  );
}

function SettingsGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18 }}>{children}</div>;
}

function SettingsCard({ title, desc, children }) {
  return (
    <section className="card">
      <div className="card-head"><h3>{title}</h3></div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {desc && <div className="dim" style={{ fontSize: 12 }}>{desc}</div>}
        {children}
      </div>
    </section>
  );
}

function Field({ label, value, mono }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "flex-start" }}>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
      <div className={cls(mono && "mono")} style={{ fontSize: 12.5, padding: "6px 0", wordBreak: "break-all" }}>{String(value ?? "")}</div>
    </div>
  );
}

function LabelInput({ label, control }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
      <div className="dim mono" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 10 }}>{label}</div>
      <div>{control}</div>
    </div>
  );
}

function AttachmentPicker({ label, hint, fileRef, attachments, setAttachments, onUpload, onDirty }) {
  return (
    <LabelInput
      label={label}
      control={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".txt,.md,.docx,.pdf"
              style={{ display: "none" }}
              onChange={async (e) => {
                const picked = [...(e.target.files || [])];
                e.target.value = "";
                if (!picked.length) return;
                try {
                  await onUpload(picked, setAttachments);
                } catch (err) {
                  window.alert(String(err.message || err));
                }
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
              <I.Upload size={13} /> Upload file
            </button>
            <div className="dim" style={{ fontSize: 11 }}>{hint || "Attach reference files."}</div>
          </div>
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {attachments.map((f, i) => (
                <div className="file-row" key={`${f.file_id || i}`}>
                  <div className="file-ico">DOC</div>
                  <div className="file-meta">
                    <div className="file-name">{f.name || f.file_id}</div>
                    <div className="file-size mono">{f.file_id}</div>
                  </div>
                  <button
                    type="button"
                    className="file-x"
                    onClick={() => {
                      onDirty && onDirty();
                      setAttachments((prev) => prev.filter((_, j) => j !== i));
                    }}
                  >
                    <I.X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

function settingsAttachmentId(item) {
  if (typeof item === "string") return item;
  return String(item?.file_id || "").trim();
}

function settingsNormalizeAttachmentRefs(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        return { file_id: item, name: item, size_bytes: 0 };
      }
      if (item && typeof item === "object") {
        const fileId = String(item.file_id || "").trim();
        if (!fileId) return null;
        return {
          file_id: fileId,
          name: String(item.name || item.file_id || ""),
          size_bytes: Number(item.size_bytes || 0) || 0,
        };
      }
      return null;
    })
    .filter(Boolean);
}

function ToggleLine({ label, hint, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        <div className="dim" style={{ fontSize: 11.5 }}>{hint}</div>
      </div>
      <button type="button" className={cls("toggle", value && "on")} aria-pressed={value} onClick={() => onChange(!value)} />
    </div>
  );
}

function FormatPicker({ formats, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {["txt", "docx", "xlsx", "pdf", "pptx", "md"].map((fmt) => (
        <button key={fmt} type="button" className={cls("btn btn-sm", formats.includes(fmt) ? "btn-primary" : "btn-ghost")} onClick={() => onToggle(fmt)} style={{ textTransform: "uppercase" }}>{fmt}</button>
      ))}
    </div>
  );
}

function InfoBox({ children }) {
  return <div className="dim" style={{ fontSize: 11.5, border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: 10, background: "var(--bg-2)" }}>{children}</div>;
}

function RatioCard({ row, idx, onChange, onRemove }) {
  return (
    <div className="card" style={{ background: "var(--bg-1)" }}>
      <div className="card-pad" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input className="input mono" value={row.label} onChange={(e) => onChange(idx, { label: e.target.value })} placeholder="Ratio label" />
          <button type="button" className={cls("toggle", row.enabled !== false && "on")} aria-pressed={row.enabled !== false} onClick={() => onChange(idx, { enabled: row.enabled === false })} />
          {!row.locked && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(idx)}>Remove</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
          <input className="input mono" value={row.value} onChange={(e) => onChange(idx, { value: e.target.value })} placeholder="Threshold" />
          <input className="input mono" value={row.formula} onChange={(e) => onChange(idx, { formula: e.target.value })} placeholder="Formula" />
        </div>
        <textarea className="textarea" rows={2} value={row.description} onChange={(e) => onChange(idx, { description: e.target.value })} placeholder="Business definition" />
      </div>
    </div>
  );
}

function TemplateCard({ row, idx, onChange, onRemove }) {
  return (
    <div className="card" style={{ background: "var(--bg-1)" }}>
      <div className="card-pad" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input mono" value={row.key} onChange={(e) => onChange(idx, { key: e.target.value })} placeholder="template_key" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(idx)}>Remove</button>
        </div>
        <textarea className="textarea" rows={4} value={row.value} onChange={(e) => onChange(idx, { value: e.target.value })} placeholder="Required sections and formatting rules" />
      </div>
    </div>
  );
}

function WorkerCard({ row, idx, onChange, onRemove }) {
  return (
    <div className="card" style={{ background: "var(--bg-1)" }}>
      <div className="card-pad" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className={cls("toggle", row.enabled && "on")} aria-pressed={row.enabled} onClick={() => onChange(idx, { enabled: !row.enabled })} />
          <input className="input" value={row.label} onChange={(e) => onChange(idx, { label: e.target.value })} placeholder="Worker label" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(idx)}>Remove</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input className="input mono" value={row.id} onChange={(e) => onChange(idx, { id: e.target.value })} placeholder="worker_id" />
          <input className="input mono" value={row.category} onChange={(e) => onChange(idx, { category: e.target.value })} placeholder="category" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <label className="label">Engage for intent <span className="opt">(e.g. memo_only, custom)</span></label>
          <input className="input sm mono" value={row.default_intent} onChange={(e) => onChange(idx, { default_intent: e.target.value })} placeholder="Target intent" />
        </div>
        <textarea className="textarea" rows={2} value={row.desc} onChange={(e) => onChange(idx, { desc: e.target.value })} placeholder="What this worker does" />
        <input className="input" value={row.engage_when} onChange={(e) => onChange(idx, { engage_when: e.target.value })} placeholder="When should manager use this worker?" />
      </div>
    </div>
  );
}

function ModelCard({ row, idx, onChange, onRemove }) {
  return (
    <div className="card" style={{ background: "var(--bg-1)" }}>
      <div className="card-pad" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className={cls("toggle", row.enabled && "on")} aria-pressed={row.enabled} onClick={() => onChange(idx, { enabled: !row.enabled })} />
          <input className="input" value={row.label} onChange={(e) => onChange(idx, { label: e.target.value })} placeholder="Model label" />
          <button type="button" className={cls("btn btn-sm", row.is_default ? "btn-primary" : "btn-ghost")} onClick={() => onChange(idx, { is_default: true })}>Default</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(idx)}>Remove</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input className="input mono" value={row.id} onChange={(e) => onChange(idx, { id: e.target.value })} placeholder="model id" />
          <select className="select mono" value={row.provider} onChange={(e) => onChange(idx, { provider: e.target.value })}><option value="local">local</option><option value="cloud">cloud</option></select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <select className="select mono" value={row.llm_provider} onChange={(e) => onChange(idx, { llm_provider: e.target.value })}><option value="lm_studio">lm_studio</option><option value="hermes">hermes</option></select>
          <input className="input mono" value={row.cost_hint_usd} onChange={(e) => onChange(idx, { cost_hint_usd: e.target.value })} placeholder="cost hint USD" />
        </div>
        <input className="input mono" value={row.endpoint} onChange={(e) => onChange(idx, { endpoint: e.target.value })} placeholder="endpoint" />
        <textarea className="textarea" rows={2} value={row.engage_when} onChange={(e) => onChange(idx, { engage_when: e.target.value })} placeholder="When should this model be used?" />
        <textarea className="textarea" rows={2} value={row.notes} onChange={(e) => onChange(idx, { notes: e.target.value })} placeholder="Notes / constraints" />
      </div>
    </div>
  );
}

window.Settings = Settings;
