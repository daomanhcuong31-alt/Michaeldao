"""
tools/research_client.py - Perplexity investor appetite research client.
"""

import json
import re
from typing import Any, Dict
import httpx
from config import settings, perplexity_enabled


def _extract_json_block(text: str) -> Dict[str, Any]:
    cleaned = re.sub(r"```(?:json)?\n?", "", str(text)).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    matches = re.findall(r"\{[\s\S]*\}", cleaned)
    for cand in sorted(matches, key=len, reverse=True):
        try:
            return json.loads(cand)
        except Exception:
            continue

    return {
        "summary": cleaned[:2000],
        "sources": [],
        "investor_signals": [],
    }


def run_perplexity_investor_research(parsed_terms: dict, market_context: dict, compliance_flags: list, max_sources: int = 8) -> Dict[str, Any]:
    if not settings.enable_web_research:
        return {"status": "skipped", "reason": "ENABLE_WEB_RESEARCH=false", "data": {"sources": [], "summary": ""}}

    if not perplexity_enabled():
        return {"status": "skipped", "reason": "PERPLEXITY_API_KEY not set", "data": {"sources": [], "summary": ""}}

    borrower = (parsed_terms or {}).get("borrower", "Unknown borrower")
    facility = (parsed_terms or {}).get("facility_type", "Unknown facility")
    amount = (parsed_terms or {}).get("amount", "Unknown amount")
    currency = (parsed_terms or {}).get("currency", "Unknown currency")
    tenor = (parsed_terms or {}).get("tenor", "Unknown tenor")

    prompt = f"""Research current investor appetite for this deal profile.

Deal profile:
- Borrower: {borrower}
- Facility: {facility}
- Size: {amount} {currency}
- Tenor: {tenor}

Known market context:
{json.dumps(market_context, indent=2)}

Known compliance concerns:
{json.dumps(compliance_flags, indent=2)}

Return STRICT JSON:
{{
  "summary": "short synthesis",
  "sources": [
    {{"id":"S1","title":"...","url":"https://...","date":"YYYY-MM-DD or Unknown","relevance":"..."}}
  ],
  "investor_signals": [
    {{"investor_type":"Bank/Treasury/Fund/DFI/etc","appetite":"HIGH/MEDIUM/LOW","evidence_ids":["S1"]}}
  ],
  "market_windows": ["timing or issuance window notes"]
}}

Rules:
- Use recent public web sources.
- Max {max_sources} sources.
- Every investor signal must reference evidence_ids from sources.
- If uncertain, mark appetite LOW and explain briefly.
JSON only.
"""

    body = {
        "model": settings.perplexity_model,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": "You are a financial market researcher. Return JSON only."},
            {"role": "user", "content": prompt},
        ],
    }

    headers = {
        "Authorization": f"Bearer {settings.perplexity_api_key}",
        "Content-Type": "application/json",
    }

    url = f"{settings.perplexity_base_url.rstrip('/')}/chat/completions"

    try:
        with httpx.Client(timeout=settings.perplexity_timeout_sec) as client:
            resp = client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            payload = resp.json()

        content = ""
        try:
            content = payload["choices"][0]["message"]["content"]
        except Exception:
            content = str(payload)

        data = _extract_json_block(content)
        if "sources" in data and isinstance(data["sources"], list):
            data["sources"] = data["sources"][:max_sources]

        return {
            "status": "ok",
            "provider": "perplexity",
            "model": settings.perplexity_model,
            "data": data,
            "raw_citations": payload.get("citations", []),
        }

    except Exception as e:
        return {
            "status": "error",
            "reason": str(e),
            "data": {"summary": "", "sources": [], "investor_signals": [], "market_windows": []},
        }
