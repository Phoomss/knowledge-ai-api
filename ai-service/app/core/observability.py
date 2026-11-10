import asyncio
import logging
import re
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

import httpx
from google.genai import errors

# Configure structured logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("rag.runtime")

# Regex to detect potential Google API keys or token strings in messages
_API_KEY_PATTERN = re.compile(r"(AIza[0-9A-Za-z-_]{35}|AQ\.[0-9A-Za-z-_]{40,}|key=[0-9A-Za-z-_]+)")


def sanitize_error_message(message: str) -> str:
    """Strips API keys, tokens, or credential strings from error messages."""
    if not message:
        return ""
    sanitized = _API_KEY_PATTERN.sub("[REDACTED_API_KEY]", str(message))
    return sanitized


def extract_status_code(exc: Exception) -> Optional[int]:
    """Extracts HTTP status code from Google GenAI or HTTPX exceptions."""
    if isinstance(exc, errors.APIError):
        return getattr(exc, "code", None)
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code
    return None


def classify_error(exc: Exception) -> str:
    """Categorizes exception into an observability failure category."""
    if isinstance(exc, errors.APIError):
        code = getattr(exc, "code", None)
        status = getattr(exc, "status", "")
        if code == 503 or status == "UNAVAILABLE":
            return "TRANSIENT_503_OVERLOAD"
        if code == 429 or status == "RESOURCE_EXHAUSTED":
            return "TRANSIENT_429_RATE_LIMIT"
        if code in (500, 502, 504):
            return "TRANSIENT_5XX_SERVER_ERROR"
        if code == 400 or status == "INVALID_ARGUMENT":
            return "CLIENT_INVALID_ARGUMENT"
        if code == 401 or status == "UNAUTHENTICATED":
            return "AUTH_INVALID_API_KEY"
        if code == 403 or status == "PERMISSION_DENIED":
            return "AUTH_PERMISSION_DENIED"
        if code == 404 or status == "NOT_FOUND":
            return "MODEL_NOT_FOUND"

    if isinstance(exc, (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout)):
        return "TRANSIENT_TIMEOUT"
    if isinstance(exc, (httpx.ConnectError, httpx.NetworkError, httpx.RemoteProtocolError)):
        return "TRANSIENT_NETWORK_ERROR"
    if isinstance(exc, asyncio.TimeoutError):
        return "TRANSIENT_TIMEOUT"

    err_str = str(exc).lower()
    if "503" in err_str or "unavailable" in err_str or "high demand" in err_str:
        return "TRANSIENT_503_OVERLOAD"
    if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str or "rate limit" in err_str:
        return "TRANSIENT_429_RATE_LIMIT"
    if "timeout" in err_str:
        return "TRANSIENT_TIMEOUT"
    if "connection" in err_str or "network" in err_str:
        return "TRANSIENT_NETWORK_ERROR"

    return "UNKNOWN_ERROR"


def is_retryable_error(exc: Exception) -> bool:
    """
    Determines if an error is transient and safe to retry.
    Never retries 400, 401, 403, 404 or validation errors.
    """
    if isinstance(exc, errors.APIError):
        code = getattr(exc, "code", None)
        status = getattr(exc, "status", "")
        # Explicitly transient status codes
        if code in (429, 500, 502, 503, 504):
            return True
        if status in ("UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL", "DEADLINE_EXCEEDED"):
            return True
        # Explicit non-transient status codes
        if code in (400, 401, 403, 404):
            return False

    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.RemoteProtocolError)):
        return True

    if isinstance(exc, asyncio.TimeoutError):
        return True

    category = classify_error(exc)
    return category.startswith("TRANSIENT_")


class LatencyTracker:
    def __init__(self):
        self.timings: dict[str, float] = {}
        self._start_time: float = time.perf_counter()

    def record(self, stage: str, duration_ms: float):
        self.timings[stage] = round(duration_ms, 2)

    @property
    def total_ms(self) -> float:
        return round((time.perf_counter() - self._start_time) * 1000, 2)

    def summary(self) -> dict[str, float]:
        summary = dict(self.timings)
        summary["total_ms"] = self.total_ms
        return summary


@asynccontextmanager
async def trace_stage(tracker: LatencyTracker, stage_name: str):
    """Context manager to measure and log execution duration of a stage."""
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        tracker.record(f"{stage_name}_ms", elapsed_ms)
        logger.info(f"Stage '{stage_name}' completed in {elapsed_ms:.2f}ms")


def estimate_token_count(text: str) -> int:
    """Estimates token count (~3.5-4 characters per token for mixed languages)."""
    if not text:
        return 0
    return max(1, int(len(text) / 3.5))
