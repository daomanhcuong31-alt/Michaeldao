# SF Agentic AI — Step-by-Step Setup Guide
**For Mac Apple Silicon · LM Studio · Local LLM**

Follow these steps in order. Each one has a clear success check before you move on.

---

## Before You Start

You need:
- LM Studio installed (you have this ✓)
- A model downloaded in LM Studio (you have this ✓)
- Terminal (press Cmd+Space, type "Terminal", press Enter)

---

## Step 1 — Open Terminal and go to the project folder

```bash
cd ~/Desktop
# Or wherever you saved this project — use the path shown in Finder
ls sf-agentic-ai/
```

You should see: `ROADMAP.md  config.py  main.py  agents/  workflow/  tools/` etc.

---

## Step 2 — Check Python version

```bash
python3 --version
```

You need **Python 3.11 or higher**. If you see 3.10 or lower:
- Download Python 3.11+ from https://www.python.org/downloads/

---

## Step 3 — Create a virtual environment

A virtual environment keeps the project's packages separate from everything else on your Mac.
Run these three commands, one at a time:

```bash
python3 -m venv venv
```
```bash
source venv/bin/activate
```
```bash
# You should now see (venv) at the start of your Terminal prompt
```

---

## Step 4 — Install packages

```bash
pip install -r requirements.txt
```

This installs LangGraph, ChromaDB, and all other dependencies.
It will take 3-5 minutes the first time.

✓ Success: You see "Successfully installed..." with no red error messages.

---

## Step 5 — Configure your settings

```bash
cp .env.example .env
```

Then open `.env` in a text editor (TextEdit, VS Code, etc.) and set:

```
LM_STUDIO_MODEL=your-model-name-here
```

**How to find your exact model name:**
1. Open LM Studio
2. Click on "My Models" in the left sidebar
3. Find your model — hover over it to see the full identifier
4. Copy that identifier exactly (e.g. `gemma-3-4b-it-qat` or `qwen3-8b`)
5. Paste it as the value for `LM_STUDIO_MODEL` in your `.env` file

---

## Step 6 — Start LM Studio server

1. Open LM Studio
2. Click **"Local Server"** in the left sidebar (looks like a server icon `<->`)
3. Select your model from the dropdown
4. Click the green **"Start Server"** button
5. You should see: "Server is running on port 1234"

---

## Step 7 — Run the connection test

```bash
python test_connection.py
```

Expected output:
```
✓ Settings loaded
✓ LM Studio is running. Models available: [your model]
✓ Model responded in X.Xs
✓ All checks passed. You're ready for Phase 1.
```

If it fails, the test tells you exactly what to fix.

---

## Step 8 — Run with the sample deal

```bash
python main.py --sample
```

This runs the full pipeline on a built-in sample deal (USD 25M term loan for a
Vietnamese SOE). Watch the terminal — you'll see each agent log its progress.

After 2-5 minutes, a credit committee memo will appear in the terminal
and save to `./data/output/`

---

## Step 9 — Run with your own deal

**Option A: Paste text**
```bash
python main.py
# Choose option 2, paste your term sheet, type END when done
```

**Option B: From a PDF**
```bash
python main.py --file ./data/uploads/your_term_sheet.pdf
```
Drop your PDF into the `data/uploads/` folder first.

---

## Step 10 — Load your knowledge base

To improve compliance and regulatory accuracy, add your reference documents:

1. Copy SBV circulars, deal templates, and regulatory docs to `data/knowledge_base/`
   (PDF or .txt format)

2. Index them:
```bash
python tools/vector_store.py
```

The agents will automatically use these documents when generating analysis.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError` | Run `source venv/bin/activate` then retry |
| `Connection refused` | LM Studio server is not running — go to Step 6 |
| `Model not found` | Check model name in `.env` matches LM Studio exactly |
| Memo gets cut off | Increase `LLM_MAX_TOKENS` in `.env` to 8192 |
| Slow responses | Use a smaller model (4B works fine for this pipeline) |
| JSON parse errors | Normal occasionally — the pipeline continues |

---

## Switching Models

To switch from Gemma 4 to Qwen 3 (or any other model):

1. In LM Studio: load the new model and restart the server
2. In `.env`: update `LM_STUDIO_MODEL` to the new model name
3. No code changes needed — everything else adapts automatically

---

## What's Next (After It's Working)

Once you have a working pilot, these are the natural upgrade paths:

**Better regulatory accuracy:** Add your SBV circulars to `data/knowledge_base/`
and the Compliance agent will search them directly instead of relying on training data.

**Faster processing:** Qwen 3 (8B) tends to be faster than Gemma on Apple Silicon
for structured output tasks. Try both and pick what works for your machine.

**Vietnamese language input:** The system handles English term sheets well.
For Vietnamese-language documents, add `lang='vie'` to the OCR config and
adjust the ingestion prompts to request bilingual output.

**Real-time market data:** Wire the Market Intelligence agent to SBV's public
API or HNX data feeds for live benchmark rates instead of training-knowledge estimates.
