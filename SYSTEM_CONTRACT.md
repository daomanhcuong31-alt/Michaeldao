# SYSTEM CONTRACT
**Project:** SF Agentic AI  
**Owner:** Michael  
**Last Updated:** 2026-05-05  
**Agent that filled this:** Gemini CLI

---

## 1. Purpose

The SF Agentic AI is an autonomous structured finance analysis system. It automates the intake, normalization, and professional analysis of deal documents (e.g., term sheets, SOPs, meeting minutes) to produce stakeholder-ready credit memos and execution plans. It operates as a capital coordinator (Originate-to-Distribute model) for Techcombank's SF function.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend | Vanilla JS / CSS / HTML | N/A | React-like structure but avoids complex bundling where possible |
| Backend | FastAPI | 0.115+ | Thin bridge to CLI logic |
| Orchestration | LangGraph | 0.2.0+ | Manager-Worker DAG model |
| LLM Gateway | LM Studio / Hermes | N/A | OpenAI-compatible local endpoints |
| PDF/Doc Parsing | pdfplumber / docx | Latest | Handles complex SF document types |
| Financials | Pandas / NumPy | Latest | Used for DSCR and leverage calculations |

---

## 3. Project Structure

```
sf-agentic-ai/
├── agents/             # Worker agents (ingestion, compliance, financial_modeler, etc.)
├── backend/            # FastAPI bridge and Static UI files
├── data/               # Persistent storage (api runs, logs, outputs, uploads)
├── prompts/            # TCB-specific tone, brand, and audience guidelines
├── scripts/            # Shell launchers and deployment scripts
├── tests/              # Pytest suite for regression testing
├── tools/              # Utility tools (OCR, Research, Vector Store)
└── workflow/           # LangGraph definitions (graph.py, supervisor.py, state.py)
```

**Key principle:** The `Supervisor` node in `workflow/supervisor.py` owns the execution plan. Individual agents in `agents/` are stateless functions that transform the `DealState`.

---

## 4. Architecture and Data Flow

**Core Flow:**
User uploads/drops file → `Ingestion` normalizes text → `Supervisor` plans workers → Middle-tier agents (`market_intel`, `compliance`, `financial_modeler`) run in parallel → `MemoArchitect` synthesizes output → `SeniorAdvisor` reviews/revises → Result saved to `data/output`.

---

## 5. API Contract (Critical Backend-UI Bridge)

### [POST] [/api/runs/create]
**Purpose:** Create a new analysis run.  
**Request:** `RunRequest` model (JSON).  
**Success Response:** Run ID and initial record.

### [GET] [/api/runs/{run_id}/artifacts]
**Purpose:** Retrieve generated documents and metadata for a specific run.  
**Response:** List of artifact objects with `artifact_id`, `kind`, and `stable_name`.

---

## 6. Data Shapes

```
DealState: {
input_text: str
parsed_terms: dict
market_context: dict
financial_model: dict
compliance_flags: list
draft_memo: str
completed_steps: list
manager_plan: dict
}
```

---

## 10. What Must Never Change Without Explicit Approval

- **State Persistence:** `DealState` fields must not be renamed (Section 6).
- **Output Hierarchy:** Artifacts must always be saved with `.metadata.json` sidecars.
- **Brand Guardrails:** TCB red (#C8102E) and Arial font for all branded outputs.
- **Heuristic Fallbacks:** Ingestion and Memo Architect must maintain regex-based heuristic fallbacks for low-confidence LLM scenarios.
- **Parallel Execution:** Independent workers must remain dispatchable concurrently via the `analysis_parallel` node.

---

## 12. Risk Areas

- **Recursion Loops:** The supervisor routing can loop if `completed_steps` are not accurately reported.
- **LLM Timeouts:** Long "thinking" models (Qwen 9B) require stable 60s+ timeouts in `config.py`.
- **Artifact Classification:** `_artifact_kind` in `backend/api.py` is sensitive to naming conventions.

---

## 13. Contract Revision Log

| Date | Section changed | Reason | Approved by |
|---|---|---|---|
| 2026-05-05 | Initial creation | Framework onboarding | Michael |
