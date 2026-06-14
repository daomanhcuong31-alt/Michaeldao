# About Me — Michael Dao (Manh Cuong)

> This file is my personal knowledge base for AI agents (Hermes, Claude, Gemini, Codex, etc.).
> Read this first to understand who I am, what I'm building, and how I prefer to work.

---

## 👤 Identity

- **Name:** Dao Manh Cuong (Michael Dao)
- **GitHub:** [@daomanhcuong31-alt](https://github.com/daomanhcuong31-alt)
- **Profession:** Finance professional / AI builder
- **Organization:** TCB (Techcombank) — Structured Finance division
- **Location:** Vietnam
- **Primary language:** Vietnamese (work context), English (code + AI instructions)
- **Telegram:** Manh Cuong (Hermes AI assistant connected via Telegram DM)

---

## 🎯 What I'm Building

### SF Agentic AI
A **production-grade, autonomous multi-agent AI system** that automates Structured Finance credit memo drafting for TCB.

**Business goal:** Support FY2026 USD $8M TOI pipeline with faster, more consistent credit analysis.

**What it does:**
1. Ingests deal term sheets (PDF or text)
2. Pulls market benchmarks and regulatory flags (SBV, HNX)
3. Models financial structure (DSCR, waterfall, stress tests)
4. Checks compliance against SBV circulars and Vietnamese law
5. Writes credit committee memos in TCB tone
6. Routes for distribution (investor suitability) or holdbook (ops plan)

**Key design principles:**
- 100% local — no data leaves my machine
- LM Studio as the LLM runtime (currently `qwen/qwen3.5-9b`)
- Python + LangGraph for agent orchestration
- FastAPI backend + custom React UI

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent orchestration | LangGraph (Python) |
| LLM runtime | LM Studio (local) — Qwen3.5-9B / Gemma 4 |
| Backend API | FastAPI on `127.0.0.1:8000` |
| Frontend | React (Claude UI) |
| File intake | Local inbox folder + Google Drive sync |
| Storage | Local filesystem (`data/output`, `data/api`, `data/local`) |
| Testing | pytest (39+ tests) |

---

## 📁 Project Location

- **Repo (knowledge base):** `https://github.com/daomanhcuong31-alt/Michaeldao`
- **Local project path (Mac):** `/Users/daomanhcuong/Documents/AI_Works/Claude Projects/Automation/Hermes/sf-agentic-ai`
- **Google Drive inbox:** `/Users/daomanhcuong/My Drive/SF Agentic Inbox/`

---

## 🔑 Key Files to Read First

When resuming work, read these in order:

1. **`ABOUT_ME.md`** — This file. Start here.
2. **`PROJECT_HANDOFF.md`** — Current state, architecture decisions, source of truth.
3. **`SESSION_LOG.md`** — Recent session history, what changed, what was tested.
4. **`HANDOFF_20260430.md`** — Detailed last-session handoff.
5. **`README.md`** — System overview and quick-run examples.
6. **`ROADMAP.md`** — Build phases and project folder structure.
7. **`SYSTEM_CONTRACT.md`** — Architecture contract, API shapes, data model.

---

## 🤖 Agent History

| Agent | Role |
|-------|------|
| Claude (Anthropic) | Primary coding agent, architecture decisions |
| Gemini CLI | Session work on supervisor logic, UI stabilization |
| Codex (OpenAI) | Backend/UI hardening sessions |
| Hermes (Nous Research) | My personal AI assistant via Telegram — daily driver, repo access |

---

## 🧠 How I Like to Work

### With AI agents:
- **Prefer autonomous mode** — don't ask for confirmation on every step, just do it
- **Always run tests** after changes (`pytest`) — I care about a clean test suite
- **Write handoff notes** at the end of each session (`SESSION_LOG.md`)
- **No cloud, no leaks** — all processing must stay local unless I explicitly say otherwise
- **Keep existing tests passing** — never break the test suite without telling me
- **Show real output** — don't summarize tool results without showing evidence
- **Be direct and concise** — bullet points, no lengthy preambles, no fluff

### Communication style:
- Be **direct and concise** — no fluff, no lengthy preambles
- Use **bullet points** for steps and checklists
- Show me **real output** — don't summarize tool results without showing evidence
- If something is broken, say so clearly and propose a fix

### Code preferences:
- Python 3 (using `.venv` or `uv`)
- Clean commits with descriptive messages
- Tests before shipping features (or at minimum, don't break existing ones)
- Markdown for all documentation

---

## 📊 Current System Status (as of last update)

- **Backend:** FastAPI on `127.0.0.1:8000` ✅
- **LM Studio:** `http://localhost:1234/v1` — model `qwen/qwen3.5-9b`
- **Tests:** 39+ passing ✅
- **Autonomous inbox:** Configured ✅
- **UI:** React frontend, MD output format as default ✅

### Supported intents:
- `memo_only` — credit memo only (default when unclear)
- `memo_plus_distribution` — memo + investor suitability + distribution advisory
- `memo_plus_holdbook` — memo + operations implementation plan
- `full_e2e` — all paths, full sequence
- `analysis_brief` — non-credit, analysis output
- `ops_sop` — Standard Operating Procedure output
- `meeting_minutes` — Meeting minutes output
- `pipeline_report` — Pipeline report output
- `market_intel` — Market intelligence output
- `data_analysis` — Data analysis output

### Supported audience templates:
- `credit_committee`
- `ceo`
- `chief_cibg`
- `external_client`

### Controller Rubric (Senior Advisor):
- **APPROVE:** all dimensions >= 7 and total >= 38
- **REVISE:** all dimensions >= 5 and total >= 28
- **ESCALATE_TO_HUMAN:** otherwise
- Dimensions: factual coherence, legal consistency, financial completeness, audience-fit, actionability

---

## 🔄 SF Agentic AI — Core Data Flow

```
User uploads/drops file
        ↓
  Ingestion Agent  (normalizes text from PDF/txt)
        ↓
  Supervisor Node  (plans which workers to run based on intent)
        ↓
  ┌─────────────────────────────────┐  (parallel)
  │  Market Intel  │  Compliance  │  Financial Modeler  │
  └─────────────────────────────────┘
        ↓
  Memo Architect   (synthesizes output, credit memo or other family)
        ↓
  Senior Advisor   (rubric-based review: APPROVE / REVISE / ESCALATE)
        ↓
  Human Gate       (approve / revise / stop)
        ↓
  Post-Credit Branching:
    - Distribution path (investor suitability + distribution advisory)
    - Holdbook path (operations implementation plan)
    - Full E2E (both)
        ↓
  Artifact saved to data/output  →  UI download
```

---

## 🚀 How to Resume Work

```bash
# 1. Check backend status
./status_ui.command

# 2. If backend is down, start the full stack
./open_full_stack.command

# 3. Confirm LM Studio is running
curl http://localhost:1234/v1/models

# 4. Run tests
PYTHONPYCACHEPREFIX=/tmp/pycache ./.venv/bin/python -m pytest

# 5. Open the UI
./open_ui.command
```

---

## 📝 Notes for AI Assistants

- My username on Telegram is **Manh Cuong**
- I interact with Hermes Agent via **Telegram DM**
- When I say "the project", I mean **SF Agentic AI** unless I specify otherwise
- When I say "push to GitHub", push to the `Michaeldao` repo (this one)
- I may use different AI agents across sessions — read `SESSION_LOG.md` to see who did what
- My PAT rotates — if auth fails, ask me for a new one
- **Hermes** can clone this repo at any time using my GitHub PAT to catch up on context

---

## 🗓️ Session History (Hermes)

| Date | Agent | Summary |
|------|-------|---------|
| 2026-06-14 | Hermes | First connected to repo via GitHub PAT. Read ABOUT_ME, SESSION_LOG, PROJECT_HANDOFF, SYSTEM_CONTRACT. Updated ABOUT_ME with richer context. |

---

*Last updated: 2026-06-14 by Hermes Agent*
