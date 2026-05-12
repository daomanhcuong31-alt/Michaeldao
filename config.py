"""
config.py - Central configuration and LM Studio / Perplexity setup
"""

import os
from typing import Tuple
from dotenv import load_dotenv
from openai import OpenAI
from langchain_openai import ChatOpenAI

load_dotenv()


def _env_bool(name: str, default: str = "false") -> bool:
    val = os.getenv(name, default)
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # Provider selection
    llm_provider: str = os.getenv("LLM_PROVIDER", "lm_studio").strip().lower()

    # LM Studio
    base_url: str = os.getenv("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    api_key: str = os.getenv("LM_STUDIO_API_KEY", "lm-studio")
    model: str = os.getenv("LM_STUDIO_MODEL", "local-model")

    # LLM behavior
    temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    timeout_sec: int = int(os.getenv("LLM_TIMEOUT_SEC", "60"))
    max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "0"))
    fast_mode: bool = _env_bool("SF_FAST_MODE", "false")

    # Storage
    chroma_db_path: str = os.getenv("CHROMA_DB_PATH", "./data/chroma_db")
    knowledge_base_path: str = os.getenv("KNOWLEDGE_BASE_PATH", "./data/knowledge_base")

    # Web research (Perplexity)
    perplexity_api_key: str = os.getenv("PERPLEXITY_API_KEY", "")
    perplexity_base_url: str = os.getenv("PERPLEXITY_BASE_URL", "https://api.perplexity.ai")
    perplexity_model: str = os.getenv("PERPLEXITY_MODEL", "sonar")
    enable_web_research: bool = _env_bool("ENABLE_WEB_RESEARCH", "false")
    perplexity_timeout_sec: int = int(os.getenv("PERPLEXITY_TIMEOUT_SEC", "45"))


settings = Settings()

# Optional Hermes settings (used by Hermes infer CLI transport).
if settings.llm_provider == "hermes":
    settings.base_url = os.getenv("HERMES_BASE_URL", "http://127.0.0.1:18789")
    settings.api_key = os.getenv("HERMES_API_KEY", "hermes")
    settings.model = os.getenv("HERMES_MODEL", "lmstudio/qwen/qwen3.5-9b")

raw_client = OpenAI(
    base_url=settings.base_url,
    api_key=settings.api_key,
    max_retries=max(0, settings.max_retries),
)

llm = ChatOpenAI(
    model=settings.model,
    base_url=settings.base_url,
    api_key=settings.api_key,
    temperature=settings.temperature,
    max_tokens=settings.max_tokens,
)


def verify_connection() -> bool:
    try:
        raw_client.chat.completions.create(
            model=settings.model,
            messages=[{"role": "user", "content": "Reply with exactly: CONNECTION OK"}],
            max_tokens=20,
            temperature=0,
        )
        return True
    except Exception as e:
        print(f"[config] LM Studio connection failed: {e}")
        return False


def perplexity_enabled() -> bool:
    return bool(settings.enable_web_research and settings.perplexity_api_key.strip())


def _get_int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        return max(1, int(raw))
    except Exception:
        return default


def get_agent_limits(agent_name: str) -> Tuple[int, int]:
    """
    Return (timeout_sec, max_tokens) with per-agent and fast-mode overrides.
    Precedence:
      1) <AGENT>_TIMEOUT_SEC / <AGENT>_MAX_TOKENS
      2) LLM_TIMEOUT_SEC / LLM_MAX_TOKENS
      3) fast-mode clamp when SF_FAST_MODE=true
    """
    key = (agent_name or "base").strip().upper()
    timeout_sec = _get_int_env(f"{key}_TIMEOUT_SEC", settings.timeout_sec)
    max_tokens = _get_int_env(f"{key}_MAX_TOKENS", settings.max_tokens)

    # Backward-compatible override for market intel
    if key == "MARKET_INTEL":
        timeout_sec = _get_int_env("MARKET_INTEL_TIMEOUT_SEC", timeout_sec)

    if _env_bool("SF_FAST_MODE", "false"):
        fast_timeout_default = 55 if settings.llm_provider == "hermes" else 35
        timeout_sec = min(timeout_sec, _get_int_env("FAST_LLM_TIMEOUT_SEC", fast_timeout_default))
        max_tokens = min(max_tokens, _get_int_env("FAST_LLM_MAX_TOKENS", 900))

    return timeout_sec, max_tokens
