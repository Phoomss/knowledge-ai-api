# Technical Fix Report: Gemini 503 Streaming Failure Resilience in KnowledgeAI Enterprise RAG Runtime

## 1. Executive Summary

During production operations of the KnowledgeAI Enterprise RAG Runtime, intermittent HTTP 503 (`UNAVAILABLE. This model is currently experiencing high demand. Please try again later.`) errors from the Google Gemini API caused degraded user experience, corrupted PostgreSQL conversation history, and unhandled SSE stream interruptions.

This document details the architectural root cause, bounded retry mechanism, streaming safety guards, database conversation state machine, structured observability, and comprehensive validation suite implemented to resolve the failure.

---

## 2. Root Cause Analysis

Investigation confirmed three primary defects in the streaming pipeline:

1. **Streaming Execution Outside Retry Boundary**:
   In `ai-service/app/generation/llm_provider.py`, `_execute_with_retry` was wrapped around `self.client.aio.models.generate_content_stream(...)`. In the `google-genai` SDK, this method merely returns an async generator without connecting to the network. The actual network request (`POST ... streamGenerateContent?alt=sse`) occurs when `async for chunk in stream:` is called. Because the chunk iteration loop was outside `_execute_with_retry`, any network error, 503 Service Unavailable, or 429 Rate Limit encountered during streaming immediately escaped without a single retry attempt.

2. **Error Masking as Assistant Output in RAG Runtime**:
   When `generate_stream` threw an error, `ai-service/app/orchestration/rag_runtime.py` caught the generic `Exception`, appended the raw error string to `full_answer`, and emitted it over SSE as regular `data: {"content": ...}` chunks. It then emitted `event: done`, falsely signaling a completed response.

3. **Conversation Memory Corruption**:
   `rag_runtime.py` persisted the corrupted error text as an assistant message into PostgreSQL. Furthermore, user messages were only saved at the conclusion of generation (and were lost if generation crashed). Neither the database schema nor memory store tracked message lifecycle states (`pending`, `streaming`, `completed`, `failed`).

---

## 3. Implementation Details & Architecture

### 3.1 Bounded Exponential Backoff Retry with Jitter (Phase 2)

Implemented in `ai-service/app/generation/llm_provider.py` and `ai-service/app/core/observability.py`:
- **Exception Classification**: Replaced substring parsing with structured status-code inspection using `google.genai.errors.APIError` (`code`, `status`), `httpx.TimeoutException`, and `httpx.NetworkError`.
- **Transient vs Non-Transient Policy**:
  - **Retryable**: HTTP 503 (`UNAVAILABLE`), HTTP 429 (`RESOURCE_EXHAUSTED`), 500, 502, 504, connect/read timeouts, and network disconnections.
  - **Non-Retryable (Fail Fast)**: HTTP 400 (`INVALID_ARGUMENT`), HTTP 401 (`UNAUTHENTICATED`), HTTP 403 (`PERMISSION_DENIED`), HTTP 404 (`NOT_FOUND`), and prompt injection blocks.
- **Configurable Backoff**:
  $$\text{Delay} = \min(\text{base\_delay} \times 2^{\text{attempt}}, \text{max\_delay}) + \text{jitter}(0.1, 0.5)$$
  Configured via `LLM_MAX_RETRIES` (default 3), `LLM_BASE_DELAY` (1.0s), `LLM_MAX_DELAY` (10.0s), `LLM_TIMEOUT` (30.0s), and `LLM_JITTER` (true).

### 3.2 Streaming Safety & Protocol Integrity (Phase 3)

- **Pre-Token Retry Boundary**: If a 503/429/timeout occurs **before the first token is emitted** (`tokens_in_attempt == 0`), the generator sleeps for the backoff duration and initiates a clean new attempt.
- **Mid-Stream Dropped Connection Guard**: If a failure occurs **after partial tokens have already been emitted** to the client (`tokens_in_attempt > 0`), the generator terminates immediately and raises `StreamingInterruptedError(tokens_emitted=...)`. It **never retries mid-stream**, eliminating duplicate output or corrupted concatenation.
- **Explicit SSE Failure Protocol**:
  - Emits `event: error\ndata: {"error": ..., "code": ..., "category": ..., "partial": bool}\n\n`.
  - **Suppresses `event: done`** on failure so clients know the stream was interrupted.
  - Updated `frontend/src/api.ts` to dispatch `event: error` directly to `callbacks.onError`.

### 3.3 Conversation Memory State Machine (Phase 4)

- **Schema Migration**: Added `status VARCHAR(20) DEFAULT 'completed'` and `metadata JSONB DEFAULT '{}'` to `conversation_messages` table via Prisma migration `20261110231500_add_message_status_metadata`.
- **Lifecycle States**:
  - `user`: Persisted once immediately before generation begins (`status='completed'`).
  - `assistant`: Created with `status='streaming'` placeholder, updated to `status='completed'` with sources and final answer on success.
  - `failed`: On generation error, updated to `status='failed'` with sanitized metadata (`{"error": ..., "code": 503, "category": ...}`). Raw error strings are **never** stored as assistant text content.
- **History Filtering**: `ConversationMemory.get_history()` filters out `status='failed'` messages by default, ensuring failed turns do not pollute LLM context for subsequent questions.

### 3.4 Provider Resilience & Model Fallback (Phase 5)

- Abstracted provider operations through `BaseLLMProvider`.
- Added configurable `LLM_FALLBACK_MODEL`: If the primary model (`gemini-3.8-flash`) exhausts retries on transient 503 errors and a fallback model is configured, the provider automatically attempts generation against the fallback model before failing.

### 3.5 Structured Observability (Phase 6)

Implemented structured logging across all generation stages:
- Fields logged: `provider`, `model`, `request_id`, `conversation_id`, `attempt`, `status_code`, `ttft_ms`, `total_duration_ms`, `tokens_emitted`, `category`, and `is_fallback`.
- **Zero Data Leakage**: Prompts, user answers, and API keys are strictly excluded. Any error message containing key patterns is sanitized using `sanitize_error_message()`.

---

## 4. Files Changed

| File | Changes Made |
| :--- | :--- |
| `ai-service/app/generation/llm_provider.py` | Implemented `BaseLLMProvider`, `GeminiProvider` with token-aware retry loop, status code detection, streaming safety guards, and fallback support. |
| `ai-service/app/orchestration/rag_runtime.py` | Added immediate user message persistence, assistant message lifecycle transitions, explicit `event: error` SSE emissions, and memory failure recording. |
| `ai-service/app/memory/conversation_store.py` | Added message lifecycle tracking (`streaming`, `completed`, `failed`), sanitized metadata storage, update methods, and history filtering. |
| `ai-service/app/core/observability.py` | Added error classification, status code extraction, credential redaction, and retryability heuristics. |
| `ai-service/app/core/config.py` | Added configuration for LLM retry bounds, delays, timeouts, jitter, and fallback model. |
| `ai-service/app/main.py` | Wired provider parameters from application settings into `GeminiProvider`. |
| `api/prisma/schema.prisma` | Added `status` and `metadata` columns to `ConversationMessage` model. |
| `api/prisma/migrations/20261110231500_add_message_status_metadata/migration.sql` | PostgreSQL schema migration for `status` and `metadata`. |
| `frontend/src/api.ts` | Added `event: error` handling to invoke `callbacks.onError` instead of treating errors as text chunks. |
| `ai-service/pytest.ini` | Configured test environment, pythonpath, and asyncio fixture scoping. |
| `ai-service/tests/test_gemini_streaming_resilience.py` | 12 comprehensive unit and integration resilience tests. |

---

## 5. Verification & Test Execution (Phases 7 & 8)

All 24 test suites executed inside the `knowledge-ai-service` container passed with 100% success:

```text
============================= test session starts ==============================
platform linux -- Python 3.11.18, pytest-9.2.0, pluggy-1.7.0
rootdir: /app
configfile: pytest.ini
plugins: anyio-4.16.0, asyncio-1.4.1.post1
collected 24 items

tests/test_conversation_memory.py ..                                     [  8%]
tests/test_embedding_cache.py .                                          [ 12%]
tests/test_gemini_streaming_resilience.py ............                   [ 62%]
tests/test_hybrid_search.py .                                            [ 66%]
tests/test_pdf_ingestion.py ...                                          [ 79%]
tests/test_rag_enhancements.py .....                                     [100%]

============================= 24 passed in 15.95s ==============================
```

### Coverage of Scenarios:
1. **Successful Gemini streaming**: Tokens yielded sequentially with TTFT tracking.
2. **First-attempt 503 followed by successful retry**: Recovers cleanly on attempt 2 without duplicates.
3. **Repeated 503 until retry exhaustion**: Bounded to configured attempts, raises typed `LLMGenerationError`.
4. **HTTP 429 Rate Limit**: Retried with exponential backoff and succeeds.
5. **Authentication failure (401/400 API_KEY_INVALID)**: Fails immediately with zero retries.
6. **Timeout**: Retried and succeeds.
7. **Network connection failure (ConnectError)**: Retried and succeeds.
8. **Failure before first token**: Verified safe pre-token retry.
9. **Failure after partial tokens**: Raises `StreamingInterruptedError(tokens_emitted=2)` with call count = 1 (no duplicate generation).
10. **No duplicated assistant response**: Exactly single response produced.
11. **Correct conversation message status**: Verified `user` persisted once, `assistant` updated to `failed`, and excluded from active history.
12. **Frontend-compatible stream events**: Verified `event: sources`, `event: error` on failure, and suppression of `event: done`.

---

## 6. Remaining Limitations & Operational Recommendations

1. **Mid-Stream Resumption**:
   If Google drops the connection after generating 100 tokens, the system aborts the stream to prevent duplicate tokens. It does not currently attempt partial continuation (appending "continue from...") because generative LLMs can hallucinate when forced to resume from mid-sentence tokens without a continuation token.
2. **Quota Management**:
   While transient 429 errors are retried, sustained quota exhaustion (exceeding daily limits) requires account-level quota increases on Google Cloud / Google AI Studio.
3. **Frontend Reconnection**:
   The frontend displays the error state cleanly. An optional UI button ("Retry generation") can be clicked by the user to resend the query under the same conversation ID.
