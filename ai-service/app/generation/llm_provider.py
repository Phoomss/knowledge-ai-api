import asyncio
import logging
import random
from typing import AsyncGenerator, Optional
from google import genai
from google.genai import types

logger = logging.getLogger("rag.llm")


class GeminiProvider:
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout: float = 30.0,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 10.0,
    ):
        self.client = genai.Client(api_key=api_key)
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay

    async def _execute_with_retry(self, coro_func, *args, **kwargs):
        """Executes an async call with timeout and exponential backoff retry."""
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                # Wrap with asyncio.wait_for to enforce timeout
                return await asyncio.wait_for(
                    coro_func(*args, **kwargs),
                    timeout=self.timeout,
                )
            except asyncio.TimeoutError as err:
                last_error = err
                logger.warning(
                    f"Gemini call timed out (attempt {attempt + 1}/{self.max_retries + 1}) after {self.timeout}s"
                )
            except Exception as err:
                last_error = err
                err_str = str(err).lower()
                # Check for retryable conditions (rate limit, quota, server error)
                is_retryable = any(
                    term in err_str
                    for term in ["429", "rate", "quota", "503", "unavailable", "timeout", "resourceexhausted"]
                )
                if not is_retryable or attempt == self.max_retries:
                    logger.error(f"Gemini call failed with non-retryable error: {err}")
                    raise

                logger.warning(
                    f"Gemini call encountered error: {err} (attempt {attempt + 1}/{self.max_retries + 1})"
                )

            if attempt < self.max_retries:
                # Calculate exponential backoff with jitter
                delay = min(self.base_delay * (2 ** attempt) + random.uniform(0.1, 0.5), self.max_delay)
                logger.info(f"Retrying Gemini call in {delay:.2f}s...")
                await asyncio.sleep(delay)

        raise RuntimeError(f"Gemini call failed after {self.max_retries + 1} attempts") from last_error

    async def generate(self, prompt: str) -> str:
        """Generates full text response with timeout and retry."""
        async def _call():
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=2048,
                ),
            )
            if not response.text:
                raise RuntimeError("LLM returned empty response")
            return response.text

        return await self._execute_with_retry(_call)

    async def generate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """Streams text response chunks for real-time SSE output."""
        async def _call_stream():
            return await self.client.aio.models.generate_content_stream(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=2048,
                ),
            )

        stream = await self._execute_with_retry(_call_stream)
        async for chunk in stream:
            if chunk.text:
                yield chunk.text

    async def close(self):
        await self.client.aio.aclose()
