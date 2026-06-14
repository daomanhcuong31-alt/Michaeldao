# About Me — Manh Cuong (Dao Manh Cuong)

> **Purpose:** This file is a persistent knowledge base for AI agents (Hermes, Claude, Gemini, Codex, etc.)
> working with me. Load this file at the start of every session to understand who I am, what I'm building,
> and how I like to work.

---

## 👤 Identity

- **Name:** Dao Manh Cuong
- **GitHub:** [@daomanhcuong31-alt](https://github.com/daomanhcuong31-alt)
- **Location:** Vietnam
- **Language:** Vietnamese (native), English (working)
- **Role:** Finance professional / AI builder at TCB (Techcombank), focused on Structured Finance

---

## 🧠 What I'm Building

### SF Agentic AI
A **production-grade, autonomous multi-agent AI system** that automates credit memo drafting for
Techcombank's Structured Finance (SF) team.

**What it does:**
1. Reads deal term sheets (PDF or text)
2. Pulls market benchmarks and regulatory flags
3. Models financial structures (waterfall, DSCR)
4. Checks compliance against SBV circulars and Vietnamese law
5. Writes credit committee memos in TCB tone
6. Distributes to appropriate audiences (credit committee, CEO, chief CIBG, external client)

**Business goal:** Support FY2026 USD **$8M TOI pipeline**

**Key design principle:** 100% local — no data leaves my Mac. Uses LM Studio for inference.

---

## 🛠️ Tech Stack

| Layer | Tool |
|---|---|
| Language | Python 3 |
| Agent framework | LangGraph (manager-worker) |
| LLM runtime | LM Studio (local) |
| Model | `qwen/qwen3.5-9b` (default) |
| Backend API | FastAPI (`127.0.0.1:8000`) |
| Frontend | React (custom "Claude UI") |
| File intake | Local inbox folder + Google Drive sync |
| Tests | pytest (39+ tests) |

---

## 🗂️ Project Structure

**Repo (local Mac path):**
```
/Users/daomanhcuong/Documents/AI_Works/Claude Projects/Automation/Hermes/sf-agentic-ai
```

**Key files:**
- `main.py` — CLI entry point, supports `--autonomous`, `--intent`, `--audience`
- `workflow/supervisor.py` — manager-worker routing logic
- `workflow/intent_router.py` — maps intents to agent sequences
- `workflow/graph.py` — LangGraph state graph
- `workflow/state.py` — shared pipeline state
- `tools/inbox_worker.py` — autonomous file watcher
- `backend/api.py` — FastAPI backend
- `backend/static/claude-ui/` — React UI

**Inbox folders (Google Drive):**
- Pending: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/pending`
- Processing: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/processing`
- Archive: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/archive`
- Failed: `/Users/daomanhcuong/My Drive/SF Agentic Inbox/failed`

---

## ⚙️ How the System Works

### Intents
| Intent | What it does |
|---|---|
| `memo_only` | Draft credit memo only (default when unclear) |
| `memo_plus_distribution` | Memo + investor suitability + distribution advisory |
| `memo_plus_holdbook` | Memo + operations implementation plan |
| `full_e2e` | Full pipeline — both distribution and holdbook paths |

### Audiences
- `credit_committee`
- `ceo`
- `chief_cibg`
- `external_client`

### Route Modes
- `route_mode=full` — force full agent sequence
- `route_mode=targeted` — run selected workers + auto-add dependencies
- `route_mode=auto` — manager infers route from document or instruction text

### Controller Rubric (Senior Advisor)
Scoring dimensions (each 1–10):
- Factual coherence
- Legal consistency
- Financial completeness
- Audience-fit
- Actionability

Decision thresholds:
- **APPROVE:** all dimensions ≥ 7, total ≥ 38
- **REVISE:** all dimensions ≥ 5, total ≥ 28 (one revision pass only)
- **ESCALATE_TO_HUMAN:** otherwise

### Human Gate
After memo generation, a gate decision is required:
- `approve` — proceed to post-credit branching
- `revise` — one controlled revision pass
- `stop` — terminate cleanly, artifacts saved

Use `--autonomous` flag to auto-approve and skip interactive prompts.

---

## 🚀 Quick Start (for AI agents resuming work)

```bash
# 1. Check status
./status_ui.command

# 2. Start full stack if backend is down
./open_full_stack.command
# or
./scripts/launch_local_full_stack.sh

# 3. Verify LM Studio is running
curl http://localhost:1234/v1/models

# 4. Run a sample memo
python3 main.py --sample --intent memo_only --audience credit_committee --post-credit stop

# 5. Run tests
./.venv/bin/python -m pytest
```

---

## 🤝 How I Like to Work with AI Agents

### Communication preferences
- **Be direct and concise** — I don't need lengthy explanations, just actionable info
- **Vietnamese is fine** for casual conversation, but keep code/logs/docs in English
- **Give me status updates** when running long tasks — don't go silent for minutes
- **Show diffs, not full files** when making code changes — easier to review

### Development preferences
- **Always run tests after changes** — `pytest` must stay green
- **Preserve parallel execution logic** — don't refactor the core pipeline structure
- **Use `--autonomous` flag** for non-interactive batch operations
- **Default output format:** Markdown (MD)
- **Default model:** `qwen/qwen3.5-9b` via LM Studio unless specified otherwise

### Agent handoff protocol
- At end of session: update `SESSION_LOG.md` with what changed, what was tested, what's next
- Use `PROJECT_HANDOFF.md` as the master source of truth for cross-session state
- Keep `CLAUDE.md` empty (reserved for Claude-specific rules if needed)

---

## 📋 Session Log Index

| Date | Agent | Key Changes |
|---|---|---|
| 2026-05-10 17:30 | Gemini CLI | Stabilized UI state, context-aware routing, MD default |
| 2026-05-10 13:00 | Gemini CLI | Removed credit memo bias, fixed worker routing logic |
| 2026-04-30 | Multiple | Local UI production hardening, blank memo fix, regression tests |

See `SESSION_LOG.md` for full details.

---

## 🔐 Security Notes

- **All inference is local** — LM Studio at `http://localhost:1234/v1`
- **No cloud LLM calls** in production mode (unless explicitly enabled with `--perplexity`)
- **Backend is local only** — `127.0.0.1:8000`, not exposed externally
- This repo is private. PAT and secrets are managed outside the repo.

---

## 📌 Current Priorities (as of last session)

1. **Settings UI/UX redesign** — complete before making more Settings changes
2. **Multi-file SOP intent test** — visual confirmation that MD default persists
3. **Google Drive inbox** — verify sync is stable in production
4. **UI artifact preview** — download versioned artifacts without navigating many screens

---

*Last updated: 2026-06-14 | Maintained by: Hermes Agent*
