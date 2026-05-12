# SF Agentic AI System — Build Roadmap
**Goal:** Automate TCB Structured Finance credit memo drafting using local LLMs via LM Studio  
**Target:** FY2026 USD 8M TOI pipeline support  
**Stack:** Python + LangGraph + LM Studio (Gemma 4 / Qwen 3) — 100% local, no cloud required

---

## What You're Building

A multi-agent AI system that can:
1. Read a deal term sheet (PDF or text)
2. Pull relevant market benchmarks and regulatory flags
3. Model the financial structure (waterfall, DSCR)
4. Check compliance against SBV circulars and Vietnamese law
5. Write a credit committee memo in TCB tone

All of this runs on your Mac, through LM Studio, with no data leaving your machine.

---

## System Map

```
                    ┌─────────────────────┐
                    │   SUPERVISOR NODE   │  ← Routes tasks to the right agent
                    │  (Manager-Worker)   │
                    └────────┬────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                   │
   ┌──────▼──────┐   ┌───────▼──────┐   ┌───────▼──────┐
   │  Ingestion  │   │   Financial  │   │  Compliance  │
   │    Agent    │   │    Modeler   │   │  & Risk Agent│
   │ (OCR+Parse) │   │(DSCR/Waterfl)│   │(SBV Circulars│
   └──────┬──────┘   └───────┬──────┘   └───────┬──────┘
          │                  │                   │
          └──────────────────▼──────────────────┘
                             │
                    ┌────────▼────────────┐   ┌──────────────────┐
                    │  Market Intelligence │   │  Memo Architect  │
                    │  Agent (SBV/HNX)    │──►│  (Writer Agent)  │
                    └─────────────────────┘   └──────────────────┘
```

---

## Build Phases

| Phase | What | Time Est. |
|-------|------|-----------|
| **Phase 0** | Verify LM Studio, set up Python, test connection | 30 min |
| **Phase 1** | LangGraph skeleton — state, graph, supervisor | 1-2 hrs |
| **Phase 2** | Five agent personas coded | 2-3 hrs |
| **Phase 3** | Workflow logic (term sheet → memo pipeline) | 2 hrs |
| **Phase 4** | Local vector DB + OCR for PDFs | 1-2 hrs |
| **Phase 5** | End-to-end test with a real deal | 1 hr |

---

## Project Folder Structure

```
sf-agentic-ai/
├── ROADMAP.md                   ← You are here
├── requirements.txt             ← Python packages to install
├── .env                         ← Your settings (LM Studio URL, model name)
├── config.py                    ← Loads settings, creates LLM client
├── main.py                      ← Run this to start the system
│
├── agents/
│   ├── base.py                  ← Template all agents inherit from
│   ├── ingestion.py             ← Reads + parses deal documents
│   ├── market_intel.py          ← Market benchmarks and context
│   ├── financial_modeler.py     ← DSCR, waterfall, stress tests
│   ├── compliance.py            ← SBV law + regulatory red flags
│   └── memo_architect.py        ← Writes the final CC memo
│
├── workflow/
│   ├── state.py                 ← Shared data passed between agents
│   ├── supervisor.py            ← Decides which agent runs next
│   └── graph.py                 ← Wires everything together
│
├── tools/
│   ├── ocr.py                   ← Extracts text from PDF/images
│   ├── calculator.py            ← Python math execution (no hallucination)
│   └── vector_store.py          ← Local document memory (ChromaDB)
│
├── prompts/
│   ├── system_prompts.py        ← Base instructions for each agent
│   └── tcb_tone.py              ← TCB credit writing style guide
│
└── data/
    ├── knowledge_base/          ← Put SBV circulars, deal templates here
    └── uploads/                 ← Drop term sheets here to process
```

---

## Key Design Decisions

**Why LangGraph over n8n?**  
LangGraph is pure Python — you can read it, edit it, debug it. n8n is visual but harder to customise for complex agent logic. For a multi-agent system that needs to handle structured finance reasoning, Python gives you full control.

**Why ChromaDB instead of Pinecone?**  
Pinecone is cloud-only. ChromaDB runs entirely on your Mac, no API key, no data leaving your machine. Same capability for your use case.

**Why not DocTR/Textract for OCR?**  
We'll use `pdfplumber` + `pytesseract` for OCR — lighter weight on Apple Silicon, works offline, no AWS account needed. DocTR is available as an upgrade path.

**LM Studio connection:**  
LM Studio runs an OpenAI-compatible API on `http://localhost:1234/v1`. We use the standard `openai` Python package to talk to it — same code, just pointed at your local machine instead of OpenAI's servers.

---

## Phase 0 Checklist (Start Here)

Before running any code, confirm these in order:

- [ ] 1. LM Studio is open and a model is loaded (Gemma 4 or Qwen 3)
- [ ] 2. LM Studio server is running — click **"Start Server"** in LM Studio (green button)
- [ ] 3. Note your model name exactly as shown in LM Studio (e.g., `gemma-3-4b-it` or `qwen3-8b`)
- [ ] 4. Python 3.11+ is installed on your Mac
- [ ] 5. Run the test script: `python test_connection.py`
- [ ] 6. You see a response printed in Terminal → you're live

---

*Updated: April 2026*
