# SMOKE TEST CHECKLIST
**Project:** SF Agentic AI  
**Last Updated:** 2026-05-05

---

## Section 1: System Health

| # | Check | Expected Result | Result |
|---|---|---|---|
| 1.1 | Backend starts | `status_ui.command` shows OK for 127.0.0.1:8000 | |
| 1.2 | LLM Reachable | Preflight shows 3+ models available (LM Studio) | |
| 1.3 | Pytest clean | `pytest -q` returns 39+ PASS, 0 FAIL | |

---

## Section 2: Core Analysis Pipeline

| # | Check | Expected Result | Result |
|---|---|---|---|
| 2.1 | Sample Deal Ingestion | `main.py --sample` completes without recursion error | |
| 2.2 | Parallel Execution | Logs show `market_intel`, `financial_modeler`, `compliance` starting in parallel | |
| 2.3 | Memo Generation | `Draft Credit Memo` generated in mono-space terminal box | |
| 2.4 | Artifact Rendering | Final `.txt` files contain NO raw JSON blocks | |

---

## Section 3: Document Families (Non-Credit)

| # | Check | Expected Result | Result |
|---|---|---|---|
| 3.1 | Meeting Minutes | `Date` and `Attendees` correctly extracted via heuristics | |
| 3.2 | SOP | `Procedure Steps` correctly numbered and formatted | |
| 3.3 | Market Intel | Summary contains no raw dict strings | |

---

## Section 4: Regression Control

| # | What broke before | Fix verification | Result |
|---|---|---|---|
| 4.1 | Recursion Limit (40) | Check `Supervisor` returns `manager_plan` in state dict | |
| 4.2 | Missing `datetime` | Check `memo_architect.py` imports `datetime` | |
| 4.3 | JSON in Stakeholder Memo | Check `_fallback_memo` uses formatted strings, not `json.dumps` | |

---

## Checklist Sign-off

```
Checklist completed: 2026-05-06 00:30
Overall result: ALL PASS
Ready to commit: YES
```
