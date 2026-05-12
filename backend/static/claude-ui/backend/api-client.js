// API client wired to local SF backend (/api/*)
(function () {
  const BASE = window.__AGENTFLOW_API__ || "";

  function getApiKey() {
    return (
      window.__SF_API_KEY ||
      localStorage.getItem("sf_api_key") ||
      ""
    ).trim();
  }

  function headersJson() {
    const h = { "Content-Type": "application/json" };
    const key = getApiKey();
    if (key) h["x-sf-api-key"] = key;
    return h;
  }

  async function req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: headersJson(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.detail || `${res.status} ${res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const Api = {
    uploadFiles: async (fileList) => {
      const form = new FormData();
      for (const f of fileList) form.append("files", f);
      const headers = {};
      const key = getApiKey();
      if (key) headers["x-sf-api-key"] = key;
      const res = await fetch(BASE + "/api/files", {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || `Upload failed: ${res.status}`);
      }
      return (await res.json()).files || [];
    },

    createRun: (payload) => req("POST", "/api/runs", payload),
    listRuns: (limit = 100) => req("GET", `/api/runs?limit=${encodeURIComponent(limit)}`),
    getRun: (id) => req("GET", `/api/runs/${encodeURIComponent(id)}`),
    getRunLogs: (id, maxLines = 220) =>
      req("GET", `/api/runs/${encodeURIComponent(id)}/logs?max_lines=${encodeURIComponent(maxLines)}`),
    getArtifacts: (id) => req("GET", `/api/runs/${encodeURIComponent(id)}/artifacts`),
    getArtifactPreview: (runId, filename) =>
      req("GET", `/api/artifacts/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}/preview`),
    rerunRun: (id) => req("POST", `/api/runs/${encodeURIComponent(id)}/rerun`),
    control: (action, run_id, opts = {}) =>
      req("POST", "/api/control", { action, run_id, notify: true, ...opts }),

    health: () => req("GET", "/api/health"),
    getIntegrations: () => req("GET", "/api/integrations"),
    testIntegration: (provider) => req("POST", `/api/integrations/${encodeURIComponent(provider)}/test`),
    getMe: () => req("GET", "/api/me"),
    getWorkerStatus: () => req("GET", "/api/system/worker/status"),
    getUiConfig: () => req("GET", "/api/ui-config"),
    putUiConfig: (payload) => req("PUT", "/api/ui-config", payload),
  };

  window.Api = Api;
})();
