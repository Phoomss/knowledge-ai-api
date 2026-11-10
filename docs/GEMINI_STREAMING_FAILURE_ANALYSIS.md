# Root Cause & Architecture Analysis: Gemini 503 Streaming Failure in KnowledgeAI Runtime

## 1. Executive Summary

This document details the architectural and implementation inspection of the intermittent Gemini streaming failure observed as:
```text
HTTP Request: POST ... gemini-3.8-flash:streamGenerateContent
HTTP/1.1 503 Service Unavailable

LLM streaming error:
503 UNAVAILABLE.
This model is currently experiencing high demand.
Please try again later.

Persisted 'user' message to conversation ...
Persisted 'assistant' message to conversation ...
```

The investigation revealed that while `GeminiProvider` contained an internal retry helper `_execute_with_retry`, **zero retries were executed for streaming responses**. Furthermore, upon failure, the error message was treated as normal assistant output, stored in PostgreSQL conversation memory as a successful response, and signaled to the frontend with `event: done`.

---

## 2. Detailed Inspection Findings

### 2.1 Gemini Provider Implementation (`ai-service/app/generation/llm_provider.py`)

1. **Streaming Execution Bypass**:
   In `GeminiProvider.generate_stream(prompt)`:
   ```python
   async def generate_stream(self, prompt: str) -> AsyncGenerator[str, None]:
       async def _call_stream():
           return await self.client.aio.models.generate_content_stream(...)

       stream = await self._execute_with_retry(_call_stream)
       async for chunk in stream:
           if chunk.text:
               yield chunk.text
   ```
   In the Google GenAI SDK (`google-genai`), `client.aio.models.generate_content_stream` returns an async generator without initiating the underlying HTTP request. The HTTP connection is only opened when `stream.__anext__()` is called during `async for chunk in stream:`.
   Because `async for chunk in stream:` was positioned **outside** `_execute_with_retry`, any network error, 503 Service Unavailable, or 429 Rate Limit encountered during streaming immediately escaped retry handling and crashed out of `generate_stream`.

2. **Primitive Error Matching**:
   `_execute_with_retry` evaluated errors using raw substring matching:
   ```python
   err_str = str(err).lower()
   is_retryable = any(term in err_str for term in ["429", "rate", "quota", "503", "unavailable", "timeout", "resourceexhausted"])
   ```
   This approach ignored structured SDK status codes, typed exception hierarchies, and HTTP response headers.

### 2.2 RAG Runtime Orchestration (`ai-service/app/orchestration/rag_runtime.py`)

1. **Error Masking as Output Chunks**:
   When `generate_stream` raised an exception, `rag_runtime.py` caught it and yielded:
   ```python
   except Exception as e:
       logger.error(f"LLM streaming error: {e}")
       err_msg = f"\n[เกิดข้อผิดพลาดในการเชื่อมต่อโมเดล AI: {str(e)}]"
       full_answer.append(err_msg)
       yield f"data: {json.dumps({'content': err_msg, 'done': False, 'error': str(e)})}\n\n"
   ```
   This chunk was sent over the SSE channel with `data: {"content": ...}`, causing the frontend to append the raw exception string into the chat bubble as if it were valid AI-generated text.

2. **False Completion Event**:
   Directly following the exception catch, the stream yielded:
   ```python
   yield f"event: done\ndata: {json.dumps({'timings': tracker.summary(), 'done': True})}\n\n"
   ```
   The client received a `done` event signaling that generation had concluded normally.

### 2.3 Conversation Memory Persistence (`ai-service/app/memory/conversation_store.py`)

1. **Corrupted History with Error Messages**:
   In `rag_runtime.py`:
   ```python
   final_answer = "".join(full_answer)
   if conversation_id:
       await self.memory.add_message(db=db, conversation_id=conversation_id, role="user", content=clean_question)
       await self.memory.add_message(db=db, conversation_id=conversation_id, role="assistant", content=final_answer, sources=sources)
   ```
   Because `final_answer` contained `[เกิดข้อผิดพลาดในการเชื่อมต่อโมเดล AI: 503 UNAVAILABLE...]`, the corrupted text was persisted to PostgreSQL as a valid `assistant` response.
2. **Late User Message Persistence**:
   The user prompt was only persisted at the very end. If a critical unhandled exception aborted execution earlier, the user query was completely lost from memory.
3. **No Explicit Message State Machine**:
   Neither the database table `conversation_messages` nor `ConversationMemory` tracked message generation lifecycle states (`pending`, `streaming`, `completed`, `failed`).

### 2.4 Streaming Protocol & Frontend Interaction

1. **Frontend Protocol Handling (`frontend/src/api.ts`)**:
   The SSE reader parsed lines starting with `event: ` and `data: `:
   - `event: sources` -> `callbacks.onSources`
   - `event: done` -> `callbacks.onDone`
   - default -> `callbacks.onChunk`
   Because errors were emitted as data chunks or followed by `event: done`, `callbacks.onError` was never invoked during mid-stream or initial connection failures.
2. **NestJS Gateway (`api/src/chat/chat.controller.ts`)**:
   The NestJS API piped the upstream SSE response directly to the browser. Once HTTP 200 headers were committed, downstream status could not be changed to 503. Proper in-stream signaling (`event: error`) is essential.

---

## 3. SDK Exception Inspection & Status Code Detection

The installed `google-genai` SDK exposes typed exceptions in `google.genai.errors`:
- `google.genai.errors.APIError` (base class):
  - `code`: integer HTTP status code (`503`, `429`, `400`, `404`, `500`)
  - `status`: string error classification (`UNAVAILABLE`, `RESOURCE_EXHAUSTED`, `INVALID_ARGUMENT`, `NOT_FOUND`)
  - `message`: string error description
  - `details`: raw JSON error payload
- `google.genai.errors.ServerError`: subclasses `APIError` for all 5xx errors.
- `google.genai.errors.ClientError`: subclasses `APIError` for all 4xx errors.
- Underlying transport exceptions:
  - `httpx.TimeoutException` (`ConnectTimeout`, `ReadTimeout`, `WriteTimeout`, `PoolTimeout`)
  - `httpx.NetworkError` (`ConnectError`, `RemoteProtocolError`)
  - `asyncio.TimeoutError`

### Transient (Retryable) vs Permanent (Non-Retryable) Classification

| Error / Code | Classification | Retry Policy |
| :--- | :--- | :--- |
| **503 UNAVAILABLE** | Transient overload / high demand | **Retry with exponential backoff & jitter** |
| **429 RESOURCE_EXHAUSTED** | Rate limit / quota exceeded | **Retry with exponential backoff & jitter** |
| **500, 502, 504** | Transient server / gateway errors | **Retry with exponential backoff & jitter** |
| **httpx.TimeoutException** | Network / connection timeout | **Retry with backoff** |
| **httpx.NetworkError** | Socket / connection reset | **Retry with backoff** |
| **400 INVALID_ARGUMENT** | Invalid parameters or API key format | **Do NOT retry (Fail fast)** |
| **401 UNAUTHENTICATED** | Invalid API Key | **Do NOT retry (Fail fast)** |
| **403 PERMISSION_DENIED** | Permission / account quota violation | **Do NOT retry (Fail fast)** |
| **404 NOT_FOUND** | Model not found or deprecated | **Do NOT retry (Fail fast)** |

---

## 4. Key Investigation Questions & Answers

1. **Where is HTTP 503 raised?**
   It is raised inside the SDK's async iterator (`stream.__anext__()`) upon sending the initial streaming request to `https://generativelanguage.googleapis.com/v1/models/gemini-3.8-flash:streamGenerateContent?alt=sse`.
2. **Does the SDK expose typed exceptions and status codes?**
   Yes. `google.genai.errors.APIError` exposes `.code` (int) and `.status` (str).
3. **Can partial tokens be emitted before failure?**
   Yes. A 503 can occur on initial connection (zero tokens emitted) or midway during generation if the remote server drops the connection.
4. **Is the assistant message persisted before or after generation?**
   Currently, it is persisted *after* generation completes.
5. **Do failed generations leave incomplete or corrupted assistant messages?**
   Yes. Currently, failed generations store the raw error message string as the assistant message in PostgreSQL.
6. **Can the frontend distinguish a failed stream from a completed response?**
   Currently no, because the backend yielded error strings inside `data: {"content": ...}` and concluded with `event: done`.

---

## 5. Architectural Solution Plan

1. **Retry Engine in LLM Provider**:
   - Encapsulate the async generator iteration in a retry loop.
   - If a retryable error (503, 429, 5xx, timeout, network error) occurs **before any token is yielded**, back off with exponential delay + jitter and retry.
   - If an error occurs **after partial tokens have already been emitted**, do NOT retry (to prevent duplicate output), but raise a dedicated `StreamingInterruptedError`.
2. **Explicit SSE Error Protocol**:
   - If generation fails, emit `event: error\ndata: {"error": ..., "code": ..., "retryable": false}\n\n` and DO NOT emit `event: done`.
   - Update frontend SSE reader to properly dispatch `event: error` to `callbacks.onError`.
3. **Conversation Memory State Machine**:
   - Persist user message immediately before LLM invocation.
   - Add `status` (`streaming`, `completed`, `failed`) and `metadata` to `conversation_messages`.
   - When streaming succeeds, update assistant message with status `completed`.
   - When streaming fails, record assistant message with status `failed` and sanitized error metadata, never storing failure text as legitimate knowledge.
4. **Structured Observability**:
   - Log request ID, conversation ID, attempt number, status code, time-to-first-token (TTFT), total duration, and failure category without leaking prompts or keys.
