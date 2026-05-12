function ToggleRow({ on, onChange, ico, title, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--fg-2)" }}>{ico}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div className="dim" style={{ fontSize: 11.5 }}>{hint}</div>
      </div>
      <span className={cls("toggle", on && "on")} onClick={() => onChange(!on)} />
    </div>
  );
}

const OUTPUT_FORMATS = [
  { id: "txt",  label: "TXT",  desc: "Plain text" },
  { id: "docx", label: "DOCX", desc: "Word doc" },
  { id: "xlsx", label: "XLSX", desc: "Spreadsheet" },
  { id: "pdf",  label: "PDF",  desc: "PDF" },
  { id: "pptx", label: "PPTX", desc: "Slides" },
  { id: "csv",  label: "CSV",  desc: "CSV data" },
  { id: "md",   label: "MD",   desc: "Markdown" },
];

const WORKER_MODES = [
  { id: "single", label: "Single",  desc: "One specialist worker", ico: "Brain" },
  { id: "few",    label: "Few",     desc: "Hand-pick 2–4 workers",  ico: "Sparkle" },
  { id: "all",    label: "All",     desc: "Full pipeline, all workers", ico: "Box" },
];
const STRUCTURED_TEMPLATE_AUTONOMOUS = "autonomous";
const STRUCTURED_TEMPLATE_NA = "not_applicable";
const STRUCTURED_TEMPLATE_CUSTOM = "custom";
const CREDIT_DECISION_MODES = [
  { id: "analysis_only", label: "Analysis only (no decision gating)" },
  { id: "decision_recommendation", label: "Decision recommendation (apply thresholds + precedents)" },
];

function NewJob({ onSubmit, runtime, initialDraft }) {
  const fileRef = React.useRef(null);
  const knowledgeFileRef = React.useRef(null);
  const uiCfg = runtime?.ui_config || {};
  const defaults = uiCfg.defaults || {};
  const policy = uiCfg.policy || {};
  const ragCfg = uiCfg.rag || {};
  const reportProfiles = Array.isArray(window.REPORT_PROFILES) ? window.REPORT_PROFILES : [];
  const templateLibrary = Array.isArray(window.STRUCTURED_TEMPLATE_LIBRARY) ? window.STRUCTURED_TEMPLATE_LIBRARY : [];
  const ratioPresets = Array.isArray(window.CREDIT_RATIO_PRESETS) ? window.CREDIT_RATIO_PRESETS : [];
  const outputTemplates = (uiCfg.output_templates && typeof uiCfg.output_templates === "object") ? uiCfg.output_templates : {};
  const thresholdsDefaults = policy.credit_thresholds || {};
  const modelRegistry = Array.isArray(uiCfg.model_registry) ? uiCfg.model_registry : [];
  const enabledModels = modelRegistry.filter((m) => m && m.id && m.enabled !== false);
  const fallbackModels = [
    { id: "qwen/qwen3.5-9b", label: "Qwen 3.5 9B (LM Studio)", provider: "local", llm_provider: "lm_studio", endpoint: "http://127.0.0.1:1234/v1", is_default: true },
    { id: "lmstudio/qwen/qwen3.5-9b", label: "Qwen 3.5 9B (Hermes Gateway)", provider: "local", llm_provider: "hermes", endpoint: "http://127.0.0.1:18789", is_default: false },
    { id: "gpt-4.1", label: "GPT-4.1 (Cloud)", provider: "cloud", llm_provider: "hermes", endpoint: "", is_default: false },
  ];
  const modelOptions = enabledModels.length ? enabledModels : fallbackModels;
  const runtimeProvider = String(runtime?.runtime?.provider || "").toLowerCase();
  const providerPreferredModel =
    modelOptions.find((m) => String(m.llm_provider || "").toLowerCase() === runtimeProvider) || null;
  const defaultModel = providerPreferredModel || modelOptions.find((m) => m.is_default) || modelOptions[0] || fallbackModels[0];

  const [intent, setIntent]           = React.useState(defaults.intent || "memo_only");
  const [userHasInteracted, setUserInteracted] = React.useState(false);
  const [customIntent, setCustomIntent] = React.useState("");
  const [workerMode, setWorkerMode]   = React.useState("all");
  const [targetWorkers, setTW]        = React.useState([]);
  const [singleWorker, setSingleW]    = React.useState("memo_architect");
  const [managerInstruction, setMI]   = React.useState("");
  const [audience, setAudience]       = React.useState(defaults.audience || "credit_committee");
  const [postCredit, setPC]           = React.useState(defaults.post_credit || "stop");
  const [humanGate, setHG]            = React.useState(defaults.human_gate || "approve");
  // Backward-compatible aliases to avoid runtime breaks from legacy handlers.
  const setPostCredit = setPC;
  const setHumanGate = setHG;
  const [provider, setProv]           = React.useState(defaultModel.id || "qwen/qwen3.5-9b");
  const [autonomous, setAuto]         = React.useState(defaults.autonomous !== false);
  const [fast, setFast]               = React.useState(defaults.fast !== false);
  const [noWeb, setNoWeb]             = React.useState(defaults.no_web_research === true);
  const [timeoutSec, setTO]           = React.useState(1800);

  const [files, setFiles]             = React.useState([]);
  const [knowledgeFiles, setKnowledgeFiles] = React.useState([]);
  const [drag, setDrag]               = React.useState(false);
  const [runName, setRunName]         = React.useState("");
  const [textInput, setText]          = React.useState("");
  const [driveFolderId, setDriveId]   = React.useState("");
  const [googleDriveLink, setGoogleDriveLink] = React.useState("");
  const [oneDriveLink, setOneDriveLink] = React.useState("");

  const [outputFormats, setFmts]      = React.useState(
    Array.isArray(defaults.output_formats) && defaults.output_formats.length ? defaults.output_formats : ["md", "docx"]
  );
  const [output, setOutput]           = React.useState({ drive: true, download: true, telegram: true });
  const [destFolder, setDest]         = React.useState("/AgenticFlow/Outputs");

  const [reportLengthWords, setReportLengthWords] = React.useState(Number(policy.report_length_words || 1800));
  const defaultReportProfile = reportProfiles.find((p) => p.id === String(policy.report_format || reportProfiles[0]?.id || "credit_memo_v2")) || reportProfiles[0] || {};
  const [reportProfileId, setReportProfileId] = React.useState(String(defaultReportProfile.id || reportProfiles[0]?.id || "credit_memo_v2"));
  const [sopFormat, setSopFormat] = React.useState(String(defaultReportProfile.sop_format || policy.sop_format || "standard_sop"));
  const [outputTemplateId, setOutputTemplateId] = React.useState(String(policy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS));
  const [structureMode, setStructureMode] = React.useState("autonomous");
  const [creditDecisionMode, setCreditDecisionMode] = React.useState(String(policy.credit_decision_mode || "analysis_only"));
  const [conditionPrecedents, setConditionPrecedents] = React.useState(String(policy.condition_precedents || ""));
  const [adhocCriteria, setAdhocCriteria] = React.useState(String(policy.adhoc_criteria || ""));
  const [structuredOutputInstruction, setStructuredOutputInstruction] = React.useState(
    String(policy.structured_output_instruction || "")
  );
  const [marketIntelInstruction, setMarketIntelInstruction] = React.useState(
    String(policy.market_intel_instruction || "")
  );
  const [ragInstruction, setRagInstruction] = React.useState(String(ragCfg.instruction || ""));
  const seedThresholdRows = React.useCallback((source = {}, extras = []) => {
    const presetRows = ratioPresets.map((preset) => ({
      key: preset.id,
      presetId: preset.id,
      label: preset.label,
      value: String(source[preset.id] ?? preset.value ?? ""),
      description: preset.description,
      formula: preset.formula,
    }));
    const customRows = Object.entries(source)
      .filter(([key]) => !ratioPresets.some((preset) => preset.id === key))
      .map(([key, value], idx) => ({
        key,
        presetId: "custom",
        label: key.replace(/_/g, " "),
        value: String(value ?? ""),
        description: "",
        formula: "",
        customIndex: idx,
      }));
    const extraRows = Array.isArray(extras)
      ? extras.map((row, idx) => ({
          key: String(row?.id || row?.key || `custom_ratio_${idx + 1}`),
          presetId: "custom",
          label: String(row?.label || row?.id || `custom ratio ${idx + 1}`),
          value: String(row?.value ?? ""),
          description: String(row?.description || ""),
          formula: String(row?.formula || ""),
          customIndex: idx,
        }))
      : [];
    return [...presetRows, ...customRows, ...extraRows];
  }, [ratioPresets]);
  const [thresholdRows, setThresholdRows] = React.useState(() => seedThresholdRows(thresholdsDefaults));
  const [conditionPrecedentsEnabled, setConditionPrecedentsEnabled] = React.useState(Boolean(String(policy.condition_precedents || "").trim()));
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [showRuntimeSettings, setShowRuntimeSettings] = React.useState(false);
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [scheduledAt, setScheduledAt] = React.useState("");

  const filteredProfiles = React.useMemo(() => {
    if (intent === "custom") return reportProfiles;
    const base = intent.split("_plus_")[0];
    const matches = reportProfiles.filter(p => p.intent === intent || p.intent === base || (p.intent && base.startsWith(p.intent)));
    return matches.length ? matches : reportProfiles;
  }, [intent, reportProfiles]);

  const findReportProfile = (value) => {
    const key = String(value || "");
    return reportProfiles.find((p) => p.id === key || p.report_format === key || p.structured_template === key) || reportProfiles[0] || {};
  };
  const selectedReportProfile = reportProfiles.find((p) => p.id === reportProfileId) || reportProfiles[0] || {};
  const reportTemplateFromProfile = String(selectedReportProfile.structured_template || STRUCTURED_TEMPLATE_AUTONOMOUS);
  const isStructuredAutonomous = outputTemplateId === STRUCTURED_TEMPLATE_AUTONOMOUS;
  const isStructuredNA = outputTemplateId === STRUCTURED_TEMPLATE_NA;
  const useStructuredTemplate = !isStructuredAutonomous && !isStructuredNA;

  const applyReportProfile = (profileId) => {
    const profile = reportProfiles.find((p) => p.id === profileId) || reportProfiles[0] || {};
    const nextTemplate = String(profile.structured_template || STRUCTURED_TEMPLATE_AUTONOMOUS);
    setReportProfileId(profileId);
    
    // Only switch intent if current is incompatible. 
    // Complex variants (memo_plus) stay active if profile is a base credit memo.
    if (profile.intent && intent !== "custom" && intent !== profile.intent) {
        const base = intent.split("_plus_")[0];
        if (base !== profile.intent && !intent.startsWith(profile.intent)) {
            setIntent(profile.intent);
        }
    }
    
    if (profile.sop_format) setSopFormat(profile.sop_format);
    if (Array.isArray(profile.output_formats) && profile.output_formats.length) {
        if (!userHasInteracted) setFmts(profile.output_formats);
    }
    if (structureMode === "profile") {
      setOutputTemplateId(nextTemplate);
    }
  };

  const applyStructureMode = (mode) => {
    setUserInteracted(true);
    setStructureMode(mode);
    if (mode === "profile") {
      setOutputTemplateId(reportTemplateFromProfile);
      return;
    }
    if (mode === "autonomous") {
      setOutputTemplateId(STRUCTURED_TEMPLATE_AUTONOMOUS);
      return;
    }
    if (mode === "not_applicable") {
      setOutputTemplateId(STRUCTURED_TEMPLATE_NA);
      return;
    }
    setOutputTemplateId(STRUCTURED_TEMPLATE_CUSTOM);
  };

  const onIntentClick = (id) => {
    setUserInteracted(true);
    setIntent(id);
    if (id !== "custom") {
      const base = id.split("_plus_")[0];
      const matchingProfile = reportProfiles.find(p => p.intent === id) || 
                             reportProfiles.find(p => p.intent === base) ||
                             reportProfiles.find(p => id.startsWith(p.intent));
      if (matchingProfile) {
        applyReportProfile(matchingProfile.id);
      }
    }
  };

  const isCreditIntent = intent === "memo_only" || intent.startsWith("memo_plus") || intent === "full_e2e";

  const routeMode = workerMode === "few" ? "targeted" : workerMode === "single" ? "targeted" : "full";
  const effectiveWorkers = workerMode === "all" ? WORKERS_ALL.map(w => w.id)
    : workerMode === "single" ? [singleWorker]
    : targetWorkers;
  const selectedModel = modelOptions.find((m) => String(m.id) === String(provider)) || defaultModel;
  const isCreditTemplate = String(reportProfileId).toLowerCase().includes("credit") || String(reportTemplateFromProfile).toLowerCase().includes("credit");
  const ratioControlsEnabled = isCreditTemplate && creditDecisionMode === "decision_recommendation";
  const guessProvider = (model) => {
    const explicit = String(model?.llm_provider || "").trim().toLowerCase();
    if (explicit === "hermes" || explicit === "hermes" || explicit === "lm_studio") return explicit === "hermes" ? "hermes" : explicit;
    const endpoint = String(model?.endpoint || "").toLowerCase();
    if (endpoint.includes("1234") || endpoint.endsWith("/v1")) return "lm_studio";
    if (endpoint.includes("18789")) return "hermes";
    return String(runtime?.runtime?.provider || "lm_studio");
  };
  const llmProvider = guessProvider(selectedModel);

  const parseThreshold = (raw, fallbackValue) => {
    const val = Number(raw);
    if (Number.isFinite(val)) return val;
    return fallbackValue;
  };

  const updateThresholdRow = (idx, patch) => {
    setThresholdRows((prev) => prev.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, ...patch };
      if (patch.presetId === "custom" && row.presetId !== "custom") {
        next.key = `custom_ratio_${idx + 1}`;
      }
      return next;
    }));
  };

  const addThresholdRow = () => {
    setThresholdRows((prev) => [...prev, {
      key: `custom_ratio_${prev.length + 1}`,
      presetId: "custom",
      label: "",
      value: "",
      description: "",
      formula: "",
    }]);
  };

  const removeThresholdRow = (idx) => {
    setThresholdRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectThresholdPreset = (idx, presetId) => {
    if (presetId === "custom") {
      updateThresholdRow(idx, { presetId, key: `custom_ratio_${idx + 1}` });
      return;
    }
    const preset = ratioPresets.find((p) => p.id === presetId) || {};
    updateThresholdRow(idx, {
      presetId,
      key: presetId,
      label: preset.label || presetId,
      value: String(preset.value ?? ""),
      description: preset.description || "",
      formula: preset.formula || "",
    });
  };

  const defaultScheduleTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const submit = (scheduledAtOverride = "") => {
    const scheduledAtText = typeof scheduledAtOverride === "string" ? scheduledAtOverride.trim() : "";
    const nextThresholds = ratioControlsEnabled
      ? thresholdRows.reduce((acc, row) => {
          if (String(row.presetId || "") === "custom") return acc;
          const key = String(row.key || row.presetId || row.label || "").trim();
          if (!key) return acc;
          const val = parseThreshold(row.value, null);
          if (val == null) return acc;
          acc[key] = val;
          return acc;
        }, {})
      : {};
    const runTemplateId = outputTemplateId;
    const runStructuredInstruction = structureMode === "custom" ? structuredOutputInstruction : "";
    const runConditionPrecedents = conditionPrecedentsEnabled && ratioControlsEnabled ? conditionPrecedents : "";
    const runReportFormat = String(selectedReportProfile.report_format || reportProfileId || "");
    const runIntent = intent === "custom" ? "custom" : String(selectedReportProfile.intent || intent || "memo_only");
    if (!files.length && !(textInput || "").trim()) {
      window.alert("Add at least one input file or instruction text before dispatch.");
      return;
    }
    if (workerMode === "few" && (targetWorkers.length < 2 || targetWorkers.length > 4)) {
      window.alert("For 'Few' mode, select between 2 and 4 workers.");
      return;
    }
    if (intent === "custom" && !String(customIntent || "").trim()) {
      window.alert("Custom intent needs an instruction before dispatch.");
      return;
    }
    const config = {
      intent: runIntent, route_mode: routeMode,
      target_workers: effectiveWorkers,
      manager_instruction: managerInstruction,
      audience, post_credit: postCredit, human_gate: humanGate,
      autonomous, fast, no_web_research: noWeb,
      provider, timeout_sec: timeoutSec,
      llm_provider: llmProvider,
      llm_model: String(selectedModel?.id || provider || ""),
      llm_base_url: String(selectedModel?.endpoint || ""),
      drive_folder_id: driveFolderId,
      output_formats: outputFormats,
      report_length_words: Number(reportLengthWords || 0),
      report_format: runReportFormat,
      sop_format: selectedReportProfile.sop_format || sopFormat,
      output_template_id: runTemplateId,
      credit_decision_mode: creditDecisionMode,
      credit_thresholds: nextThresholds,
      condition_precedents: runConditionPrecedents,
      adhoc_criteria: adhocCriteria,
      market_intel_instruction: marketIntelInstruction,
      structured_output_instruction: runStructuredInstruction,
      rag_instruction: ragInstruction,
      drive_source_link: googleDriveLink,
      onedrive_source_link: oneDriveLink,
      custom_intent: intent === "custom" ? customIntent : "",
      scheduled_at: scheduledAtText,
      extra_thresholds: thresholdRows
        .filter((row) => String(row.presetId || "custom") === "custom")
        .map((row) => ({
          id: String(row.key || row.label || "custom_ratio"),
          label: String(row.label || row.key || "Custom ratio"),
          value: String(row.value || ""),
          description: String(row.description || ""),
          formula: String(row.formula || ""),
        })),
    };
    onSubmit && onSubmit({ run_name: runName, text_input: textInput, config, inputs: files, knowledge_inputs: knowledgeFiles, output });
  };

  React.useEffect(() => {
    const nextDefaults = runtime?.ui_config?.defaults || {};
    const nextPolicy = runtime?.ui_config?.policy || {};
    const nextRag = runtime?.ui_config?.rag || {};
    const nextModels = Array.isArray(runtime?.ui_config?.model_registry)
      ? runtime.ui_config.model_registry.filter((m) => m && m.id && m.enabled !== false)
      : [];
    const runtimeProviderNow = String(runtime?.runtime?.provider || "").toLowerCase();
    const nextModel =
      nextModels.find((m) => String(m.llm_provider || "").toLowerCase() === runtimeProviderNow) ||
      nextModels.find((m) => m.is_default) ||
      nextModels[0];
    setAudience(nextDefaults.audience || "credit_committee");
    setPC(nextDefaults.post_credit || "stop");
    setHG(nextDefaults.human_gate || "approve");
    setAuto(nextDefaults.autonomous !== false);
    setFast(nextDefaults.fast !== false);
    setNoWeb(nextDefaults.no_web_research === true);
    if (!userHasInteracted) {
        setFmts(Array.isArray(nextDefaults.output_formats) && nextDefaults.output_formats.length ? nextDefaults.output_formats : ["md", "docx"]);
    }
    setReportLengthWords(Number(nextPolicy.report_length_words || 1800));
    const nextProfile = findReportProfile(nextPolicy.report_format || reportProfiles[0]?.id || "credit_memo_v2");
    if (!userHasInteracted) {
        setReportProfileId(String(nextProfile.id || reportProfiles[0]?.id || "credit_memo_v2"));
        setIntent(String(nextDefaults.intent || nextProfile.intent || "memo_only"));
    }
    setSopFormat(String(nextProfile.sop_format || nextPolicy.sop_format || "standard_sop"));
    const nextTemplate = String(nextPolicy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS);
    setOutputTemplateId(nextTemplate);
    setStructureMode(nextTemplate === STRUCTURED_TEMPLATE_AUTONOMOUS ? "autonomous" : nextTemplate === STRUCTURED_TEMPLATE_NA ? "not_applicable" : nextTemplate === STRUCTURED_TEMPLATE_CUSTOM ? "custom" : "profile");
    setCreditDecisionMode(String(nextPolicy.credit_decision_mode || "analysis_only"));
    setConditionPrecedents(String(nextPolicy.condition_precedents || ""));
    setAdhocCriteria(String(nextPolicy.adhoc_criteria || ""));
    setStructuredOutputInstruction(String(nextPolicy.structured_output_instruction || ""));
    setMarketIntelInstruction(String(nextPolicy.market_intel_instruction || ""));
    setRagInstruction(String(nextRag.instruction || ""));
    setConditionPrecedentsEnabled(Boolean(String(nextPolicy.condition_precedents || "").trim()));
    const nextExtras = Array.isArray(nextPolicy.credit_ratio_rules)
      ? nextPolicy.credit_ratio_rules.filter((row) => row && !row.locked)
      : [];
    setThresholdRows(seedThresholdRows(nextPolicy.credit_thresholds || {}, nextExtras));
    if (nextModel && nextModel.id) {
      setProv(String(nextModel.id));
    }
  }, [runtime?.ui_config, reportProfiles, seedThresholdRows]);

  React.useEffect(() => {
    const req = initialDraft?.request || {};
    if (!initialDraft || !req || typeof req !== "object") return;
    if (userHasInteracted) return; // Don't overwrite user changes with old draft data

    setRunName(String(req.run_name || ""));
    setIntent(String(req.intent || defaults.intent || "memo_only"));
    setCustomIntent(String(req.custom_intent || ""));
    setAudience(String(req.audience || defaults.audience || "credit_committee"));
    setPC(String(req.post_credit || defaults.post_credit || "stop"));
    setHG(String(req.human_gate || defaults.human_gate || "approve"));
    setMI(String(req.manager_instruction || ""));
    setAuto(req.autonomous !== false);
    setFast(req.fast === true);
    setNoWeb(req.no_web_research === true);
    setReportLengthWords(Number(req.report_length_words || policy.report_length_words || 1800));
    const draftProfile = findReportProfile(req.report_format || policy.report_format || reportProfiles[0]?.id || "credit_memo_v2");
    setReportProfileId(String(draftProfile.id || reportProfiles[0]?.id || "credit_memo_v2"));
    setSopFormat(String(req.sop_format || draftProfile.sop_format || policy.sop_format || "standard_sop"));
    const draftTemplate = String(req.output_template_id || policy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS);
    setOutputTemplateId(draftTemplate);
    setStructureMode(
      String(req.output_template_id || policy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS) === STRUCTURED_TEMPLATE_AUTONOMOUS
        ? "autonomous"
        : String(req.output_template_id || policy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS) === STRUCTURED_TEMPLATE_NA
          ? "not_applicable"
          : String(req.output_template_id || policy.output_template_default || STRUCTURED_TEMPLATE_AUTONOMOUS) === STRUCTURED_TEMPLATE_CUSTOM
            ? "custom"
            : "profile"
    );
    setCreditDecisionMode(String(req.credit_decision_mode || policy.credit_decision_mode || "analysis_only"));
    setConditionPrecedents(String(req.condition_precedents || policy.condition_precedents || ""));
    setConditionPrecedentsEnabled(Boolean(String(req.condition_precedents || policy.condition_precedents || "").trim()));
    setAdhocCriteria(String(req.adhoc_criteria || policy.adhoc_criteria || ""));
    setStructuredOutputInstruction(String(req.structured_output_instruction || ""));
    setMarketIntelInstruction(String(req.market_intel_instruction || ""));
    setRagInstruction(String(req.rag_instruction || ragCfg.instruction || ""));
    if (Array.isArray(req.output_formats) && req.output_formats.length) {
      setFmts(req.output_formats);
    }
    if (Array.isArray(req.workers) && req.workers.length) {
      if (req.workers.length === 1) {
        setWorkerMode("single");
        setSingleW(String(req.workers[0]));
      } else if (req.workers.length < WORKERS_ALL.length) {
        setWorkerMode("few");
        setTW(req.workers.map((w) => String(w)));
      }
    }
    if (req.llm_model) setProv(String(req.llm_model));
    if (Array.isArray(initialDraft?.inputs) && initialDraft.inputs.length) {
      setFiles(
        initialDraft.inputs.map((p) => ({
          id: null,
          name: String(p || "").split("/").pop() || String(p),
          source: "history",
          mime_type: "",
          size_bytes: 0,
          _file: null,
        }))
      );
    }
    const loadedThresholds = req.credit_thresholds || {};
    const loadedExtras = Array.isArray(req.extra_thresholds) ? req.extra_thresholds : [];
    if (loadedThresholds && typeof loadedThresholds === "object") {
      setThresholdRows(seedThresholdRows(loadedThresholds, loadedExtras));
    }
  }, [initialDraft, defaults.audience, defaults.human_gate, defaults.post_credit, policy.credit_decision_mode, policy.report_format, policy.sop_format, policy.output_template_default, policy.adhoc_criteria, policy.condition_precedents, policy.structured_output_instruction, policy.market_intel_instruction, ragCfg.instruction, reportProfiles, seedThresholdRows]);

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    setUserInteracted(true);
    setFiles(prev => [...prev, ...[...e.dataTransfer.files].map(f => ({
      id: null, name: f.name, source: "upload", mime_type: f.type,
      size_bytes: f.size, _file: f,
    }))]);
  };

  const onBrowse = (e) => {
    const picked = [...(e.target.files || [])];
    if (!picked.length) return;
    setUserInteracted(true);
    setFiles(prev => [...prev, ...picked.map(f => ({
      id: null, name: f.name, source: "upload", mime_type: f.type,
      size_bytes: f.size, _file: f,
    }))]);
    e.target.value = "";
  };

  const onBrowseKnowledge = (e) => {
    const picked = [...(e.target.files || [])];
    if (!picked.length) return;
    setKnowledgeFiles(prev => [...prev, ...picked.map(f => ({
      id: null, name: f.name, source: "knowledge", mime_type: f.type,
      size_bytes: f.size, _file: f,
    }))]);
    e.target.value = "";
  };

  const toggleFmt = (id) => {
    setUserInteracted(true);
    setFmts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleWorker = (id) => {
    setUserInteracted(true);
    setTW(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div data-screen-label="01 New Job">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="h1">New run <span className="h1-serif">— what should the agent do?</span></h1>
          <p className="sub">Configure intent, workers, inputs and output format. Worker picks up automatically.</p>
        </div>
        <span className="pill done"><span className="dot"/> {selectedModel?.id || "model"} · ready</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>

        {/* ── LEFT ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* 01 Intent */}
          <section>
            <div className="section-title">01 · Intent</div>
            <div className="task-grid">
              {INTENTS.map(t => {
                const Icon = I[t.ico];
                return (
                  <button type="button" key={t.id} className={cls("task-chip", intent === t.id && "active")} onClick={() => onIntentClick(t.id)}>
                    <Icon size={18} className="task-chip-ico"/>
                    <div className="task-chip-name">{t.name}</div>
                    <div className="task-chip-desc">{t.desc}</div>
                  </button>
                );
              })}
            </div>
            {intent === "custom" && (
              <div style={{ marginTop: 12 }}>
                <label className="label">Custom intent instruction</label>
                <textarea className="textarea" rows={3} value={customIntent} onChange={(e) => setCustomIntent(e.target.value)} placeholder="Describe the custom task and any routing preference." />
              </div>
            )}
          </section>

          {/* 02 Inputs & Context */}
          <section>
            <div className="section-title">02 · Inputs & Context</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div onDragOver={e => { e.preventDefault(); setDrag(true); }}
                   onDragLeave={() => setDrag(false)} onDrop={onDrop}
                   className={cls("drop", drag && "dragging")}>
                <div className="drop-icon"><I.Upload size={20}/></div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Drop files here</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>PDF · DOCX · XLSX · PPTX · CSV · TXT</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8 }}>
                  <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={onBrowse} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}><I.Folder size={13}/> Browse</button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => window.open("https://drive.google.com", "_blank", "noopener,noreferrer")}
                  ><I.Drive size={13}/> Drive</button>
                </div>
              </div>

              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {files.map((f, i) => (
                    <div className="file-row" key={i}>
                      <div className="file-ico">{fileExt(f.name)}</div>
                      <div className="file-meta">
                        <div className="file-name">{f.name}</div>
                        <div className="file-size">{fmtBytes(f.size_bytes)}</div>
                      </div>
                      <button type="button" className="file-x" onClick={() => setFiles(prev => prev.filter((_,j) => j !== i))}>
                        <I.X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="label">Additional context or instructions <span className="opt">(optional)</span></label>
                <textarea className="textarea" value={textInput} onChange={e => { setUserInteracted(true); setText(e.target.value); }}
                  placeholder="Describe details, focus areas, or specific requirements for this run…" rows={3}/>
              </div>

              <div>
                <label className="label">Run name <span className="opt">(optional)</span></label>
                <input className="input" value={runName} onChange={e => { setUserInteracted(true); setRunName(e.target.value); }}
                  placeholder="e.g. Q1 Deal Memo - Alpha Corp" />
              </div>
            </div>
          </section>

          {/* 03 Workflow Settings (Context-Sensitive) */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>03 · Workflow Settings</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? "Simple mode" : "Advanced settings"}
              </button>
            </div>

            {/* Credit-Specific Controls */}
            {isCreditIntent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-md)", border: "1px solid var(--line)" }}>
                <div>
                  <label className="label">Decision objective</label>
                  <select className="select" value={creditDecisionMode} onChange={e => setCreditDecisionMode(e.target.value)}>
                    {CREDIT_DECISION_MODES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>

                {ratioControlsEnabled && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label className="label" style={{ marginBottom: 0 }}>Credit Ratios</label>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={addThresholdRow}>+ Add ratio</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {thresholdRows.map((row, idx) => (
                        <div key={`${row.key}-${idx}`} className="card" style={{ padding: 10, background: "var(--bg-1)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                            <input className="input sm mono" value={row.label} onChange={(e) => updateThresholdRow(idx, { label: e.target.value, presetId: "custom" })} placeholder="Label" />
                            <input className="input sm mono" value={row.value} onChange={(e) => updateThresholdRow(idx, { value: e.target.value })} placeholder="Threshold" />
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => removeThresholdRow(idx)}><I.X size={12}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SOP Specific */}
            {intent === "ops_sop" && (
              <div>
                <label className="label">SOP Format</label>
                <select className="select" value={sopFormat} onChange={e => setSopFormat(e.target.value)}>
                  <option value="standard_sop">Standard Business Process</option>
                  <option value="technical_sop">Technical / IT Procedure</option>
                  <option value="compliance_sop">Compliance / Control Procedure</option>
                </select>
              </div>
            )}

            {/* Advanced Settings (Hidden by default) */}
            {showAdvanced && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="label">Report length (words)</label>
                    <input className="input sm mono" type="number" value={reportLengthWords} onChange={e => setReportLengthWords(Number(e.target.value || 0))} />
                  </div>
                  <div>
                    <label className="label">Output template</label>
                    <select className="select sm mono" value={reportProfileId} onChange={(e) => applyReportProfile(e.target.value)}>
                      {filteredProfiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Cloud Drive / Link sources <span className="opt">(optional)</span></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input className="input sm mono" value={googleDriveLink} onChange={(e) => setGoogleDriveLink(e.target.value)} placeholder="Google Drive link" />
                    <input className="input sm mono" value={oneDriveLink} onChange={(e) => setOneDriveLink(e.target.value)} placeholder="OneDrive link" />
                  </div>
                </div>

                <div>
                  <label className="label">Knowledge pack files <span className="opt">(optional)</span></label>
                  <input ref={knowledgeFileRef} type="file" multiple style={{ display: "none" }} onChange={onBrowseKnowledge} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => knowledgeFileRef.current && knowledgeFileRef.current.click()}>
                    <I.Upload size={13}/> Add reference files
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 04 Workers (Only for Custom or Advanced) */}
          {(intent === "custom" || showAdvanced) && (
            <section>
              <div className="section-title">04 · Workers & Routing</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                {WORKER_MODES.map(m => {
                  const Icon = I[m.ico];
                  return (
                    <button type="button" key={m.id}
                      className={cls("task-chip", workerMode === m.id && "active")}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: "10px 12px" }}
                      onClick={() => setWorkerMode(m.id)}>
                      <Icon size={15} className="task-chip-ico"/>
                      <div style={{ textAlign: "left" }}>
                        <div className="task-chip-name" style={{ fontSize: 12.5 }}>{m.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {workerMode === "single" && (
                <select className="select sm" value={singleWorker} onChange={e => setSingleW(e.target.value)}>
                  {WORKERS_ALL.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              )}

              {workerMode === "few" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {WORKERS_ALL.map(w => {
                    const active = targetWorkers.includes(w.id);
                    return (
                      <button type="button" key={w.id}
                        className={cls("pill-btn", active && "active")}
                        style={{ 
                          cursor: "pointer", 
                          padding: "6px 12px", 
                          fontSize: 12,
                          borderRadius: 99,
                          border: "1px solid",
                          borderColor: active ? "var(--accent)" : "var(--line)",
                          background: active ? "var(--accent-soft)" : "var(--bg-2)",
                          color: active ? "var(--accent)" : "var(--fg)",
                        }}
                        onClick={() => { setUserInteracted(true); toggleWorker(w.id); }}>
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label className="label">Manager instruction <span className="opt">(optional)</span></label>
                <input className="input sm" value={managerInstruction} onChange={e => setMI(e.target.value)}
                  placeholder="e.g. skip compliance · prioritise revenue" />
              </div>
            </section>
          )}

          {/* 05 Output formats */}
          <section>
            <div className="section-title">{intent === "custom" || showAdvanced ? "05" : "04"} · Output formats</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {OUTPUT_FORMATS.map(f => {
                const active = outputFormats.includes(f.id);
                return (
                  <button type="button" key={f.id}
                    onClick={() => toggleFmt(f.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "10px 14px", borderRadius: "var(--r-sm)", border: "1px solid", cursor: "pointer",
                      borderColor: active ? "var(--accent)" : "var(--line)",
                      background: active ? "var(--accent-soft)" : "var(--bg-2)",
                      transition: "all 0.12s", minWidth: 62,
                    }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700,
                      color: active ? "var(--accent)" : "var(--fg)" }}>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* Quick Stats Summary */}
          <section className="card card-pad" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="dim" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Run Summary</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{intentMeta(intent).name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="chip xs">Formats: {outputFormats.join(", ").toUpperCase()}</span>
                {files.length > 0 && <span className="chip xs">{files.length} Files</span>}
              </div>
            </div>
          </section>

          {/* Engine Settings */}
          <section className="card">
            <div className="card-head"><h3>Engine</h3></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Model</label>
                <select className="select sm mono" value={provider} onChange={e => setProv(e.target.value)}>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>{String(m.label || m.id)}</option>
                  ))}
                </select>
              </div>
              <ToggleRow on={autonomous} onChange={setAuto} ico={<I.Bolt size={14}/>}
                title="Autonomous" hint="No mid-run prompts"/>
              <ToggleRow on={fast} onChange={setFast} ico={<I.Sparkle size={14}/>}
                title="Fast mode" hint="Prefer speed"/>
            </div>
          </section>

          {showAdvanced && (
            <>
              <section className="card">
                <div className="card-head"><h3>Routing & Gates</h3></div>
                <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label className="label">Audience</label>
                    <select className="select sm" value={audience} onChange={e => setAudience(e.target.value)}>
                      {AUDIENCES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Human gate</label>
                    <select className="select sm" value={humanGate} onChange={e => setHG(e.target.value)}>
                      {["ask","approve","revise","stop"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </section>
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn btn-primary" style={{ height: 44, fontSize: 14 }}
              disabled={outputFormats.length === 0} onClick={() => submit("")}>
              <I.Send size={16}/> Dispatch Run
            </button>
            
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSchedule(!showSchedule)}
            >
              <I.Clock size={13}/> {showSchedule ? "Cancel schedule" : "Schedule later"}
            </button>

            {showSchedule && (
              <div className="card card-pad" style={{ padding: 12, background: "var(--bg-2)" }}>
                <label className="label">Local run time</label>
                <input className="input sm mono" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                <button type="button" className="btn btn-primary btn-xs" style={{ marginTop: 10, width: "100%" }} onClick={() => submit(scheduledAt)}>Confirm Schedule</button>
              </div>
            )}
          </div>
          <div className="dim mono" style={{ fontSize: 10, textAlign: "center" }}>⌘ + ↵ to dispatch</div>
        </div>
      </div>
    </div>
  );
}

window.ToggleRow = ToggleRow;
window.NewJob = NewJob;
