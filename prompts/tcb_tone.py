"""
prompts/tcb_tone.py — TCB Credit Writing Style Guide

This is injected into the Memo Architect's system prompt.
It encodes the writing standards for TCB CIBG credit documents.
"""

TCB_TONE_GUIDE = """
WRITING STANDARDS — TCB CIBG CREDIT DOCUMENTS:

Voice & Tone:
- Formal professional English, appropriate for Vietnamese commercial banking context
- Active voice where possible; passive only for regulatory/process statements
- No hedging language: not "it may be the case that" — say what is, or say it is unknown
- No filler openings: not "This memorandum aims to..." — state the deal directly
- No AI-style sentence structures: no "It is worth noting that...", "Furthermore...", "In conclusion..."

Numbers & Data:
- All figures must cite their source inline: "(VND 500bn, per audited FS FY2024)"
- Where data is unverified or from memory/training, label: "[Estimate — verify with live data]"
- IFRS vs VAS must be specified for all financial metrics — never leave ambiguous
- Stale data (>3 months on rate-sensitive items) must be flagged

Regulatory References:
- Always cite full Circular/Decree title: "Circular 22/2019/TT-NHNN" not "Circular 22"
- If reference cannot be confirmed, mark: "[Regulation — verify current status with Legal]"
- Never assume a regulation is in force without noting verification status

Structure:
- Headings should be informative, not generic: "DSCR at 1.4x — adequate coverage" not "Financial Analysis"
- Each section should be self-contained — credit committee may read sections out of order
- Recommendation must be unambiguous: Approve / Approve subject to conditions / Decline

What to avoid:
- "Significant", "comprehensive", "robust" — meaningless without specifics
- "Best-in-class", "leading", "world-class" — unverifiable claims
- Rhetorical questions
- Lists of more than 5 items without a narrative introduction
"""

CC_MEMO_TEMPLATE = """
CREDIT COMMITTEE MEMORANDUM — STRUCTURE

Header:
  To: Credit Committee
  From: Structured Finance Team, CIBG
  Date: [Date]
  Re: [Borrower Name] — [Facility Type] — [Amount] [Currency]
  Classification: Confidential

Sections:

1. EXECUTIVE SUMMARY
   3-4 sentences max. Deal at a glance: who, what, why, key risk, recommendation.

2. BORROWER BACKGROUND
   Corporate profile, ownership structure, operating history, financial track record.
   Note: IFRS or VAS for all financials cited.

3. TRANSACTION STRUCTURE
   Facility type, amount, tenor, pricing, repayment. Security package. Purpose.
   Any structural enhancements or subordination.

4. FINANCIAL ANALYSIS
   Key credit metrics (DSCR, leverage, coverage ratios).
   All numbers Python-verified — cite the calculation basis.
   Base case and downside scenario.

5. MARKET & SECTOR CONTEXT
   Sector outlook. Macro risks relevant to this credit. Comparable transactions.
   SBV policy environment. (Label all figures with source and date.)

6. SECURITY & COLLATERAL
   Collateral description, valuation basis, LTV, enforceability under Vietnamese law.

7. REGULATORY & COMPLIANCE ASSESSMENT
   SBV credit limit position. Foreign currency considerations. IFRS/VAS flags.
   Any HIGH severity compliance flags must be in this section.
   Disclaimer: verification by Legal/Compliance required before finalisation.

8. RISK ASSESSMENT & MITIGANTS
   Top 5 risks. For each: description, severity, structural or contractual mitigant.

9. CONDITIONS & COVENANTS
   Conditions precedent. Financial covenants (specify IFRS or VAS basis).
   Reporting requirements. Event of default triggers.

10. RECOMMENDATION
    Clear statement: Approve / Approve subject to conditions / Decline.
    If conditional: list each condition precisely.
"""
