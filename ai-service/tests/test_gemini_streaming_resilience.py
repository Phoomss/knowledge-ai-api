import asyncio
import json
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from google.genai import errors

from app.core.observability import is_retryable_error, sanitize_error_message
from app.generation.llm_provider import (
    GeminiProvider,
    LLMGenerationError,
    StreamingInterruptedError,
)
from app.memory.conversation_store import ConversationMemory
from app.orchestration.rag_runtime import RagRuntime


class MockChunk:
    def __init__(self, text: str):
        self.text = text


def make_api_error(code: int, status: str, message: str) -> errors.APIError:
    return errors.APIError(
        code=code,
        response_json={
            "error": {
                "code": code,
                "message": message,
                "status": status,
            }
        },
    )


# ==============================================================================
# Phase 7 — Unit & Resilience Tests
# ==============================================================================


@pytest.mark.asyncio
async def test_1_successful_gemini_streaming():
    """1. Successful Gemini streaming yields tokens sequentially."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        base_delay=0.01,
        jitter=False,
    )

    async def mock_stream_gen(*args, **kwargs):
        for token in ["Hello", " world", "!"]:
            yield MockChunk(token)

    mock_generate = AsyncMock(side_effect=mock_stream_gen)
    provider.client.aio.models.generate_content_stream = mock_generate

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Hello", " world", "!"]
    assert mock_generate.call_count == 1


@pytest.mark.asyncio
async def test_2_first_attempt_503_followed_by_successful_retry():
    """2. First-attempt 503 followed by successful retry."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise make_api_error(503, "UNAVAILABLE", "Model is currently experiencing high demand")
        for token in ["Recovered", " response"]:
            yield MockChunk(token)

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Recovered", " response"]
    assert call_count == 2


@pytest.mark.asyncio
async def test_3_repeated_503_until_retry_exhaustion():
    """3. Repeated 503 until retry exhaustion raises LLMGenerationError."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise make_api_error(503, "UNAVAILABLE", "Model is experiencing high demand")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    with pytest.raises(LLMGenerationError) as exc_info:
        async for _ in provider.generate_stream("Test prompt"):
            pass

    assert exc_info.value.status_code == 503
    assert call_count == 3  # Initial attempt + 2 retries


@pytest.mark.asyncio
async def test_4_http_429_rate_limit_retry():
    """4. HTTP 429 Resource Exhausted is recognized as transient and retried."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise make_api_error(429, "RESOURCE_EXHAUSTED", "Rate limit exceeded")
        yield MockChunk("Quota cleared")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Quota cleared"]
    assert call_count == 2


@pytest.mark.asyncio
async def test_5_authentication_failure_without_retry():
    """5. Authentication failure (401 / 400 API_KEY_INVALID) fails fast with zero retries."""
    provider = GeminiProvider(
        api_key="mock-invalid-key",
        model="gemini-3.8-flash",
        max_retries=3,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise make_api_error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key.")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    with pytest.raises(LLMGenerationError) as exc_info:
        async for _ in provider.generate_stream("Test prompt"):
            pass

    assert exc_info.value.status_code == 400
    assert call_count == 1  # Exactly 1 attempt, NO RETRY for invalid API key!


@pytest.mark.asyncio
async def test_6_timeout_retry():
    """6. Asyncio and HTTP timeouts are retried with exponential backoff."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise httpx.ReadTimeout("Read operation timed out")
        yield MockChunk("Timeout recovered")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Timeout recovered"]
    assert call_count == 2


@pytest.mark.asyncio
async def test_7_network_connection_failure():
    """7. Network socket drop (ConnectError) is retried."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise httpx.ConnectError("Connection refused by host")
        yield MockChunk("Network recovered")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Network recovered"]
    assert call_count == 2


@pytest.mark.asyncio
async def test_8_failure_before_first_token():
    """8. Failure before emitting first token triggers retry safely."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=1,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise make_api_error(503, "UNAVAILABLE", "Transient overload")
        yield MockChunk("Success on retry")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    assert tokens == ["Success on retry"]
    assert call_count == 2


@pytest.mark.asyncio
async def test_9_failure_after_partial_tokens_no_retry():
    """9. Failure after partial tokens raises StreamingInterruptedError without silent retry."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=3,
        base_delay=0.01,
        jitter=False,
    )

    call_count = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        yield MockChunk("Part 1")
        yield MockChunk(" Part 2")
        raise make_api_error(503, "UNAVAILABLE", "Mid-stream connection dropped")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    with pytest.raises(StreamingInterruptedError) as exc_info:
        async for chunk in provider.generate_stream("Test prompt"):
            tokens.append(chunk)

    assert tokens == ["Part 1", " Part 2"]
    assert exc_info.value.tokens_emitted == 2
    # CRITICAL: Must NOT retry after tokens have reached the client!
    assert call_count == 1


@pytest.mark.asyncio
async def test_10_no_duplicated_assistant_response():
    """10. Streaming retry before token emission produces zero duplicated chunks."""
    provider = GeminiProvider(
        api_key="mock-key",
        model="gemini-3.8-flash",
        max_retries=2,
        base_delay=0.01,
        jitter=False,
    )

    attempts = 0

    async def mock_stream_gen(*args, **kwargs):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise make_api_error(503, "UNAVAILABLE", "Heavy load")
        yield MockChunk("Exact")
        yield MockChunk(" single")
        yield MockChunk(" response")

    provider.client.aio.models.generate_content_stream = AsyncMock(side_effect=mock_stream_gen)

    tokens = []
    async for chunk in provider.generate_stream("Test prompt"):
        tokens.append(chunk)

    full_text = "".join(tokens)
    assert full_text == "Exact single response"
    assert attempts == 3


@pytest.mark.asyncio
async def test_11_correct_conversation_message_status():
    """11. Validates message lifecycle states (user once, assistant completed vs failed)."""
    memory = ConversationMemory()
    conv_id = str(uuid.uuid4())

    # Add user message once
    await memory.add_message(
        db=None,
        conversation_id=conv_id,
        role="user",
        content="What is knowledge base?",
        status="completed",
    )

    # Add assistant placeholder in 'streaming' state
    asst_id = await memory.add_message(
        db=None,
        conversation_id=conv_id,
        role="assistant",
        content="",
        status="streaming",
    )

    # Update to 'failed' on error
    await memory.update_message(
        db=None,
        conversation_id=conv_id,
        message_id=asst_id,
        status="failed",
        metadata={"error": "503 UNAVAILABLE", "code": 503},
    )

    # History should exclude failed message by default
    active_history = await memory.get_history(db=None, conversation_id=conv_id, include_failed=False)
    assert len(active_history) == 1
    assert active_history[0]["role"] == "user"

    # With include_failed=True, both are present
    full_history = await memory.get_history(db=None, conversation_id=conv_id, include_failed=True)
    assert len(full_history) == 2
    assert full_history[1]["status"] == "failed"
    assert full_history[1]["metadata"]["code"] == 503


@pytest.mark.asyncio
async def test_12_frontend_compatible_stream_events():
    """12. Frontend SSE protocol emits events correctly on success and failure."""
    mock_retriever = AsyncMock()
    mock_retriever.retrieve.return_value = [
        {"document_id": uuid.uuid4(), "chunk_id": uuid.uuid4(), "filename": "policy.pdf", "content": "Sample content", "score": 0.85}
    ]

    mock_builder = MagicMock()
    mock_builder.build.return_value = ("Built prompt", [{"document_id": "d1", "chunk_id": "c1", "filename": "policy.pdf", "score": 0.85}])

    # 12A: Success case
    mock_provider_ok = MagicMock()

    async def ok_stream(*args, **kwargs):
        yield "Hello "
        yield "world!"

    mock_provider_ok.generate_stream = ok_stream
    mock_provider_ok.model_name = "gemini-3.8-flash"

    memory = ConversationMemory()
    runtime_ok = RagRuntime(
        retriever=mock_retriever,
        prompt_builder=mock_builder,
        llm_provider=mock_provider_ok,
        memory=memory,
        score_threshold=0.4,
    )

    events_ok = []
    async for event_line in runtime_ok.execute_stream(
        db=None,
        question="Hello",
        knowledge_base_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
    ):
        events_ok.append(event_line)

    raw_sse_ok = "".join(events_ok)
    assert "event: sources" in raw_sse_ok
    assert 'data: {"content": "Hello ", "done": false}' in raw_sse_ok
    assert 'data: {"content": "world!", "done": false}' in raw_sse_ok
    assert "event: done" in raw_sse_ok
    assert "event: error" not in raw_sse_ok

    # 12B: Failure case
    mock_provider_fail = MagicMock()

    async def fail_stream(*args, **kwargs):
        raise LLMGenerationError("503 UNAVAILABLE. High demand", status_code=503, category="TRANSIENT_503_OVERLOAD")
        yield "unreachable"

    mock_provider_fail.generate_stream = fail_stream

    runtime_fail = RagRuntime(
        retriever=mock_retriever,
        prompt_builder=mock_builder,
        llm_provider=mock_provider_fail,
        memory=memory,
        score_threshold=0.4,
    )

    events_fail = []
    async for event_line in runtime_fail.execute_stream(
        db=None,
        question="Hello",
        knowledge_base_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
    ):
        events_fail.append(event_line)

    raw_sse_fail = "".join(events_fail)
    assert "event: sources" in raw_sse_fail
    assert "event: error" in raw_sse_fail
    assert "503" in raw_sse_fail
    # CRITICAL: Must NOT emit event: done when the stream failed!
    assert "event: done" not in raw_sse_fail
