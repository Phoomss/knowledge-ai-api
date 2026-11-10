import asyncio
import logging
import random
import time
import uuid
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional

from google import genai
from google.genai import types

from app.core.observability import (
    classify_error,
    extract_status_code,
    is_retryable_error,
    sanitize_error_message,
)

logger = logging.getLogger("rag.llm")


class LLMError(Exception):
    """Base exception for LLM provider operations."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        category: Optional[str] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.category = category or "UNKNOWN_ERROR"


class StreamingInterruptedError(LLMError):
    """Raised when an active stream is interrupted after yielding partial tokens."""

    def __init__(
        self,
        message: str,
        tokens_emitted: int = 0,
        status_code: Optional[int] = None,
        category: Optional[str] = None,
    ):
        super().__init__(message, status_code, category)
        self.tokens_emitted = tokens_emitted


class LLMGenerationError(LLMError):
    """Raised when LLM generation fails or retries are exhausted."""
    pass


class BaseLLMProvider(ABC):
    """Abstract interface for LLM generation providers."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name of active LLM model."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        request_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> str:
        """Generates complete text response."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        request_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streams text chunks token-by-token."""
        pass

    @abstractmethod
    async def close(self):
        """Releases client and transport resources."""
        pass


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini provider implementing resilient streaming and bounded retries
    with exponential backoff, jitter, and streaming safety.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 30.0,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 10.0,
        jitter: bool = True,
        fallback_model: Optional[str] = None,
    ):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
        self.fallback_model = fallback_model

    @property
    def model_name(self) -> str:
        return self.model

    def _calculate_backoff(self, attempt: int) -> float:
        """Calculates bounded exponential backoff delay with random jitter."""
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        if self.jitter:
            delay += random.uniform(0.1, 0.5)
        return round(delay, 2)

    async def generate(
        self,
        prompt: str,
        request_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> str:
        """Generates full text response with bounded retry and status-code classification."""
        req_id = request_id or str(uuid.uuid4())
        conv_id = str(conversation_id) if conversation_id else "none"
        start_time = time.perf_counter()
        current_model = self.model
        used_fallback = False

        attempt = 0
        while attempt <= self.max_retries:
            attempt_start = time.perf_counter()
            try:
                response = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=current_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            max_output_tokens=2048,
                        ),
                    ),
                    timeout=self.timeout,
                )
                if not response.text:
                    raise RuntimeError("LLM returned empty response")

                duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                logger.info(
                    "LLM generation completed",
                    extra={
                        "provider": "gemini",
                        "model": current_model,
                        "request_id": req_id,
                        "conversation_id": conv_id,
                        "attempt": attempt + 1,
                        "duration_ms": duration_ms,
                        "status": "completed",
                        "is_fallback": used_fallback,
                    },
                )
                return response.text

            except Exception as exc:
                duration_ms = round((time.perf_counter() - attempt_start) * 1000, 2)
                status_code = extract_status_code(exc)
                category = classify_error(exc)
                retryable = is_retryable_error(exc)

                logger.warning(
                    f"LLM generation error on attempt {attempt + 1}: {category} (status={status_code})",
                    extra={
                        "provider": "gemini",
                        "model": current_model,
                        "request_id": req_id,
                        "conversation_id": conv_id,
                        "attempt": attempt + 1,
                        "status_code": status_code,
                        "category": category,
                        "retryable": retryable,
                        "duration_ms": duration_ms,
                    },
                )

                if not retryable:
                    logger.error(
                        f"Non-retryable LLM error: {category}",
                        extra={"request_id": req_id, "status_code": status_code, "category": category},
                    )
                    raise LLMGenerationError(
                        sanitize_error_message(str(exc)),
                        status_code=status_code,
                        category=category,
                    ) from exc

                if attempt >= self.max_retries:
                    if self.fallback_model and self.fallback_model != current_model and not used_fallback:
                        logger.warning(
                            f"Primary model {current_model} exhausted retries. Switching to fallback {self.fallback_model}",
                            extra={"request_id": req_id, "fallback_model": self.fallback_model},
                        )
                        current_model = self.fallback_model
                        used_fallback = True
                        attempt = 0
                        continue

                    logger.error(
                        f"LLM generation retries exhausted after {attempt + 1} attempts",
                        extra={"request_id": req_id, "max_retries": self.max_retries, "category": category},
                    )
                    raise LLMGenerationError(
                        sanitize_error_message(str(exc)),
                        status_code=status_code,
                        category=category,
                    ) from exc

                delay = self._calculate_backoff(attempt)
                logger.info(
                    f"Retrying LLM generation in {delay:.2f}s (attempt {attempt + 1}/{self.max_retries})...",
                    extra={"request_id": req_id, "delay": delay, "next_attempt": attempt + 2},
                )
                await asyncio.sleep(delay)
                attempt += 1

        raise LLMGenerationError("LLM generation failed after maximum retries")

    async def generate_stream(
        self,
        prompt: str,
        request_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streams text response chunks with bounded retry before first token.
        Preserves streaming safety: aborts without retry if failure occurs after partial tokens.
        """
        req_id = request_id or str(uuid.uuid4())
        conv_id = str(conversation_id) if conversation_id else "none"
        start_time = time.perf_counter()
        ttft: Optional[float] = None
        current_model = self.model
        used_fallback = False

        attempt = 0
        while attempt <= self.max_retries:
            tokens_in_attempt = 0
            attempt_start = time.perf_counter()

            try:
                # Wrap initial stream establishment with timeout
                stream = await asyncio.wait_for(
                    self.client.aio.models.generate_content_stream(
                        model=current_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            max_output_tokens=2048,
                        ),
                    ),
                    timeout=self.timeout,
                )

                async for chunk in stream:
                    if chunk.text:
                        if ttft is None:
                            ttft = round((time.perf_counter() - start_time) * 1000, 2)
                        tokens_in_attempt += 1
                        yield chunk.text

                # Clean stream completion
                total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                logger.info(
                    "LLM stream finished successfully",
                    extra={
                        "provider": "gemini",
                        "model": current_model,
                        "request_id": req_id,
                        "conversation_id": conv_id,
                        "attempt": attempt + 1,
                        "ttft_ms": ttft,
                        "total_duration_ms": total_duration_ms,
                        "tokens_emitted": tokens_in_attempt,
                        "status": "completed",
                        "is_fallback": used_fallback,
                    },
                )
                return

            except Exception as exc:
                duration_ms = round((time.perf_counter() - attempt_start) * 1000, 2)
                status_code = extract_status_code(exc)
                category = classify_error(exc)
                retryable = is_retryable_error(exc)

                logger.warning(
                    f"LLM stream exception on attempt {attempt + 1}: {category} (status={status_code})",
                    extra={
                        "provider": "gemini",
                        "model": current_model,
                        "request_id": req_id,
                        "conversation_id": conv_id,
                        "attempt": attempt + 1,
                        "tokens_emitted": tokens_in_attempt,
                        "status_code": status_code,
                        "category": category,
                        "retryable": retryable,
                        "duration_ms": duration_ms,
                    },
                )

                # STREAMING SAFETY GUARD:
                # If partial tokens were already sent to client, retrying would corrupt
                # or duplicate output. Terminate the stream immediately with typed exception.
                if tokens_in_attempt > 0:
                    logger.error(
                        f"Stream dropped after {tokens_in_attempt} tokens emitted. Terminating stream to prevent duplicated content.",
                        extra={
                            "request_id": req_id,
                            "conversation_id": conv_id,
                            "tokens_emitted": tokens_in_attempt,
                            "category": "STREAM_INTERRUPTED_MIDWAY",
                        },
                    )
                    raise StreamingInterruptedError(
                        sanitize_error_message(f"Stream interrupted midway: {exc}"),
                        tokens_emitted=tokens_in_attempt,
                        status_code=status_code,
                        category="STREAM_INTERRUPTED_MIDWAY",
                    ) from exc

                # If zero tokens were emitted, evaluate retryability
                if not retryable:
                    logger.error(
                        f"Non-retryable error during stream connection: {category}",
                        extra={"request_id": req_id, "status_code": status_code, "category": category},
                    )
                    raise LLMGenerationError(
                        sanitize_error_message(str(exc)),
                        status_code=status_code,
                        category=category,
                    ) from exc

                if attempt >= self.max_retries:
                    # Try fallback model if configured
                    if self.fallback_model and self.fallback_model != current_model and not used_fallback:
                        logger.warning(
                            f"Primary model {current_model} exhausted retries. Switching to fallback {self.fallback_model}",
                            extra={"request_id": req_id, "fallback_model": self.fallback_model},
                        )
                        current_model = self.fallback_model
                        used_fallback = True
                        attempt = 0
                        continue

                    logger.error(
                        f"LLM stream retries exhausted after {attempt + 1} attempts",
                        extra={"request_id": req_id, "max_retries": self.max_retries, "category": category},
                    )
                    raise LLMGenerationError(
                        sanitize_error_message(str(exc)),
                        status_code=status_code,
                        category=category,
                    ) from exc

                delay = self._calculate_backoff(attempt)
                logger.info(
                    f"Retrying LLM stream in {delay:.2f}s (attempt {attempt + 1}/{self.max_retries})...",
                    extra={"request_id": req_id, "delay": delay, "next_attempt": attempt + 2},
                )
                await asyncio.sleep(delay)
                attempt += 1

        raise LLMGenerationError("LLM stream failed after maximum retries")

    async def close(self):
        await self.client.aio.aclose()
