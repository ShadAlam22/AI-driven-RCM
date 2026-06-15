"""Central LLM factory for all RCM AI services.

The platform talks to an OpenAI-compatible endpoint. By default that is a local
FreeLLMAPI proxy (https://github.com/tashfeenahmed/freellmapi), which aggregates
free LLM provider tiers behind one OpenAI-compatible `/v1` endpoint and a single
unified API key — so no paid Anthropic/OpenAI key is required.

Configured via env:
  LLM_BASE_URL  e.g. http://host.docker.internal:3001/v1  (FreeLLMAPI on the host)
  LLM_API_KEY   the unified `freellmapi-...` key
  LLM_MODEL     "auto" (let the proxy's router pick) or a specific model id

If LLM_API_KEY is unset, get_structured_llm raises AIEngineUnavailable so callers
degrade gracefully instead of crashing.
"""
import os

DEFAULT_BASE_URL = "http://host.docker.internal:3001/v1"
DEFAULT_MODEL = "auto"


class AIEngineUnavailable(RuntimeError):
    """Raised when the LLM backend is unconfigured or a request fails.

    Routers/services catch this to degrade gracefully (clear message / HTTP 503)
    rather than returning a 500 — important because free provider tiers can be
    rate-limited or briefly unavailable.
    """


def _config() -> tuple[str, str, str]:
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    if not api_key:
        raise AIEngineUnavailable(
            "LLM_API_KEY is not configured — AI features are unavailable. "
            "Point LLM_BASE_URL / LLM_API_KEY at your FreeLLMAPI proxy."
        )
    base_url = os.environ.get("LLM_BASE_URL", "").strip() or DEFAULT_BASE_URL
    model = os.environ.get("LLM_MODEL", "").strip() or DEFAULT_MODEL
    return base_url, api_key, model


def get_structured_llm(schema):
    """Return a Runnable that emits an instance of `schema` (a Pydantic model).

    Uses function/tool calling under the hood (method="function_calling"), which
    is the most broadly supported structured-output path across the many models
    FreeLLMAPI can route to.
    """
    base_url, api_key, model = _config()

    # Imported lazily so the module imports even if langchain-openai is absent.
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        base_url=base_url,
        api_key=api_key,
        model=model,
        temperature=0,
        timeout=120,
        max_retries=2,
    )
    return llm.with_structured_output(schema, method="function_calling")


def invoke_structured(chain, inputs):
    """Invoke a structured chain, converting any backend failure into
    AIEngineUnavailable so the caller can degrade gracefully."""
    try:
        return chain.invoke(inputs)
    except AIEngineUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 — free-tier providers can flake
        raise AIEngineUnavailable(
            f"AI request failed via the LLM proxy ({type(exc).__name__}). "
            f"The selected free provider may be rate-limited — try again. Detail: {exc}"
        ) from exc
