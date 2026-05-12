# worker/tools/perplexity.py — example tool plugin
# Drop more files like this into worker/tools/ and they auto-register.

import os, httpx

NAME = "perplexity"
DISPLAY = "Perplexity Research"
DESCRIPTION = "Research-grade web answers with citations (Sonar)"
ENV_REQUIRED = ["PERPLEXITY_API_KEY"]
ENABLED = bool(os.environ.get("PERPLEXITY_API_KEY"))

PARAMS_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "Research question"},
        "model": {"type": "string", "enum": ["sonar", "sonar-pro"], "default": "sonar"},
    },
    "required": ["query"],
}

def call(params, ctx):
    """ctx.api.event(...) to emit logs; return value goes back to the planner."""
    ctx.api.event("log", {"level": "tool", "msg": f"perplexity.search({params['query']!r})"})
    r = httpx.post(
        "https://api.perplexity.ai/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['PERPLEXITY_API_KEY']}"},
        json={
            "model": params.get("model", "sonar"),
            "messages": [{"role": "user", "content": params["query"]}],
        },
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    return {
        "answer": data["choices"][0]["message"]["content"],
        "citations": data.get("citations", []),
    }
