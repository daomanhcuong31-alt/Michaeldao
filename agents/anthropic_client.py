"""
agents/anthropic_client.py — Anthropic Claude client with prompt caching.

Model Cascade Design:
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENT            │  MODEL             │  RATIONALE                         │
├───────────────────┼────────────────────┼────────────────────────────────────┤
│  ingestion        │  claude-haiku-4    │  Structured extraction, JSON only  │
│  market_intel     │  claude-haiku-4    │  Benchmark lookup, JSON only       │
│  financial_modeler│  claude-sonnet-4   │  Numerical reasoning, narratives   │
│  compliance       │  claude-sonnet-4   │  Regulatory analysis, flagging     │
│  distribution_adv │  claude-sonnet-4   │  Strategy advisory, JSON output    │
│  operations_plan  │  claude-sonnet-4   │  Workstream planning               │
│  memo_architect   │  claude-opus-4     │  Final memo — stakeholder quality  │
│  senior_advisor   │  claude-opus-4     │  Gatekeeper — must catch all issues│
└─────────────────────────────────────────────────────────────────────────────┘

Prompt Caching Strategy (cache_control: {"type": "ephemeral"}):
- Cache TTL = 5 minutes (Anthropic default)
- Cached prefixes must be >= 1024 tokens to qualify
- We cache: system prompt blocks (brand guardrails, tone guides, audience profiles)
- User messages are NOT cached (they change per call)
- Cache hit saves ~90% on input token cost for cached prefix

Usage:
    from agents.anthropic_client import call_anthropic_cached

    response = call_anthropic_cached(
        agent_name="memo_architect",
        system_blocks=build_system_blocks(system_prompt),
        user_message=user_message,
        max_tokens=4096,
    )
"""

from __future__ import annotations

import os
import time
from typing import Any

try:
    import anthropic as _anthropic_module
    from anthropic.types import TextBlock as _AnthropicTextBlock
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _anthropic_module = None  # type: ignore[assignment]
    _AnthropicTextBlock = None  # type: ignore[assignment,misc]
    _ANTHROPIC_AVAILABLE = False

# ─────────────────────────────────────────────────────────────
# Model assignment per agent
# ─────────────────────────────────────────────────────────────

# Override any agent's model via env: e.g. ANTHROPIC_MODEL_INGESTION=claude-haiku-4
AGENT_MODEL_MAP: dict[str, str] = {
    # Fast + cheap — pure structured extraction, no reasoning needed
    "ingestion":          os.getenv("ANTHROPIC_MODEL_INGESTION",    "claude-haiku-4-5-20251001"),
    "market_intel":       os.getenv("ANTHROPIC_MODEL_MARKET_INTEL", "claude-haiku-4-5-20251001"),

    # Mid-tier — analysis, flagging, numerical narratives
    "financial_modeler":  os.getenv("ANTHROPIC_MODEL_FINANCIAL",    "claude-sonnet-4-5-20250929"),
    "compliance":         os.getenv("ANTHROPIC_MODEL_COMPLIANCE",   "claude-sonnet-4-5-20250929"),
    "distribution_advisor": os.getenv("ANTHROPIC_MODEL_DISTRIBUTION", "claude-sonnet-4-5-20250929"),
    "operations_planner": os.getenv("ANTHROPIC_MODEL_OPERATIONS",   "claude-sonnet-4-5-20250929"),

    # Premium — final output and quality gate (must be flawless)
    "memo_architect":     os.getenv("ANTHROPIC_MODEL_MEMO",         "claude-sonnet-4-6"),
    "senior_advisor":     os.getenv("ANTHROPIC_MODEL_ADVISOR",      "claude-sonnet-4-6"),
}

# Fallback model if agent not in map
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

# Minimum prompt length (chars) worth caching — roughly ~300 tokens
# Anthropic requires >= 1024 tokens; we'll let the server decide but
# cache all system content regardless for simplicity
CACHE_MIN_CHARS = 800


def get_model_for_agent(agent_name: str) -> str:
    """Return the Claude model to use for a given agent name."""
    return AGENT_MODEL_MAP.get(agent_name, DEFAULT_MODEL)


def _make_cached_text_block(text: str, cache: bool = True) -> dict[str, Any]:
    """Wrap a text string as an Anthropic content block, optionally with cache_control."""
    block: dict[str, Any] = {"type": "text", "text": text}
    if cache and len(text) >= CACHE_MIN_CHARS:
        block["cache_control"] = {"type": "ephemeral"}
    return block


def build_system_blocks(system_prompt: str) -> list[dict[str, Any]]:
    """
    Split a system prompt into cacheable content blocks.

    Strategy: mark the entire system prompt as cacheable.
    Anthropic caches from the beginning of the prompt up to
    the last cache_control marker — so a single marked block
    covers the full static prefix.

    For agents that compose system prompts from multiple parts
    (e.g. MemoArchitect = TCB_TONE + BRAND_GUARDRAILS + AUDIENCE_PROFILE),
    pass the full assembled string here and it's all cached.
    """
    return [_make_cached_text_block(system_prompt, cache=True)]


def call_anthropic_cached(
    agent_name: str,
    system_blocks: list[dict[str, Any]],
    user_message: str,
    max_tokens: int = 4096,
    temperature: float = 0.1,
    timeout: float = 120.0,
) -> str:
    """
    Call Anthropic API with prompt caching enabled.

    Returns the text response string, or an "ERROR: ..." string on failure.

    Args:
        agent_name:    Agent name — used to select model from AGENT_MODEL_MAP.
        system_blocks: List of content blocks for the system prompt (use build_system_blocks()).
        user_message:  The user-turn message (not cached — changes per call).
        max_tokens:    Max tokens to generate.
        temperature:   Sampling temperature (default 0.1 for financial work).
        timeout:       Request timeout in seconds.

    Cache behaviour:
        - system_blocks with cache_control are cached for 5 min (Anthropic TTL).
        - Cache writes cost 125% of normal input token price.
        - Cache hits cost 10% of normal input token price.
        - Break-even: 1 cache write + 1 cache hit = ~67% savings per subsequent call.
        - With 5+ agents in a full run, you save on every agent after the first.
    """
    if not _ANTHROPIC_AVAILABLE:
        return "ERROR: anthropic package not installed. Run: pip install anthropic>=0.40.0"

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return "ERROR: ANTHROPIC_API_KEY not set in environment"

    model = get_model_for_agent(agent_name)
    client = _anthropic_module.Anthropic(api_key=api_key)

    t0 = time.perf_counter()
    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_blocks,  # type: ignore[arg-type]
            messages=[
                {"role": "user", "content": user_message}
            ],
        )

        elapsed = time.perf_counter() - t0

        # Log cache usage if available
        usage = getattr(response, "usage", None)
        if usage:
            cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
            cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
            input_tokens = getattr(usage, "input_tokens", 0) or 0
            output_tokens = getattr(usage, "output_tokens", 0) or 0
            cache_status = "HIT" if cache_read > 0 else ("WRITE" if cache_write > 0 else "MISS")
            print(
                f"[{agent_name}] Anthropic {model} | "
                f"{elapsed:.1f}s | "
                f"in={input_tokens} out={output_tokens} | "
                f"cache={cache_status} "
                f"(read={cache_read} write={cache_write})"
            )
        else:
            print(f"[{agent_name}] Anthropic {model} | {elapsed:.1f}s")

        # Extract text — only TextBlocks have a .text attribute
        texts = [
            block.text  # type: ignore[union-attr]
            for block in response.content
            if block.type == "text"
        ]
        return "\n".join(texts).strip() or "ERROR: Anthropic response had no text blocks"

    except Exception as e:
        elapsed = time.perf_counter() - t0
        print(f"[{agent_name}] Anthropic call failed ({elapsed:.1f}s): {e}")
        return f"ERROR: {e}"


def log_cache_savings_estimate(runs_so_far: int, cached_tokens: int, price_per_1m: float = 3.0) -> None:
    """
    Print a rough cost savings estimate.

    cached_tokens: tokens saved from cache hits across all runs
    price_per_1m:  input token price per 1M tokens (Sonnet = $3, Haiku = $0.25, Opus = $15)
    """
    saved = (cached_tokens / 1_000_000) * price_per_1m * 0.90  # 90% cheaper on cache hit
    print(f"[cache] ~{cached_tokens:,} tokens served from cache | est. savings ≈ ${saved:.4f} USD")
