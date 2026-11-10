import json
import logging
import uuid
from typing import AsyncGenerator, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.observability import (
    LatencyTracker,
    classify_error,
    estimate_token_count,
    extract_status_code,
    sanitize_error_message,
    trace_stage,
)
from app.core.security import SecurityGuard
from app.evaluation.rag_evaluator import RagEvaluator
from app.generation.llm_provider import (
    BaseLLMProvider,
    LLMError,
    StreamingInterruptedError,
)
from app.generation.prompt_builder import PromptBuilder
from app.memory.conversation_store import ConversationMemory, memory_store
from app.retrieval.reranker import Reranker
from app.retrieval.retriever import Retriever

logger = logging.getLogger("rag.runtime")


class RagRuntime:
    def __init__(
        self,
        retriever: Retriever,
        prompt_builder: PromptBuilder,
        llm_provider: BaseLLMProvider,
        reranker: Optional[Reranker] = None,
        memory: Optional[ConversationMemory] = None,
        evaluator: Optional[RagEvaluator] = None,
        score_threshold: float = 0.45,
    ):
        self.retriever = retriever
        self.prompt_builder = prompt_builder
        self.llm_provider = llm_provider
        self.reranker = reranker or Reranker()
        self.memory = memory or memory_store
        self.evaluator = evaluator or RagEvaluator(llm_provider=llm_provider)
        self.score_threshold = score_threshold

    async def execute(
        self,
        db: AsyncSession,
        question: str,
        knowledge_base_id: UUID,
        conversation_id: Optional[UUID] = None,
        top_k: int = 5,
        use_reranker: bool = False,
    ) -> dict:
        tracker = LatencyTracker()
        request_id = str(uuid.uuid4())

        # 1. Security check & sanitization
        clean_question = SecurityGuard.sanitize_input(question)
        is_injected, pattern = SecurityGuard.detect_prompt_injection(clean_question)
        if is_injected:
            logger.warning(f"Blocked query due to injection pattern: {pattern}")
            return {
                "answer": "คำถามของคุณมีรูปแบบคำสั่งที่ไม่ได้รับอนุญาต กรุณาปรับเปลี่ยนคำถามใหม่",
                "sources": [],
                "metadata": {
                    "retrieval_count": 0,
                    "used_context_count": 0,
                    "security_alert": f"Pattern blocked: {pattern}",
                    "model": None,
                    "timings": tracker.summary(),
                },
            }

        # 2. Persist user message once before generation begins
        if conversation_id:
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="user",
                content=clean_question,
                status="completed",
            )

        # 3. Conversation Memory: Get previous turns from PostgreSQL (excluding failed)
        history = await self.memory.get_history(db=db, conversation_id=conversation_id)

        # 4. Retrieve documents
        async with trace_stage(tracker, "retrieval"):
            fetch_count = top_k * 2 if use_reranker else top_k
            raw_docs = await self.retriever.retrieve(
                db=db,
                question=clean_question,
                knowledge_base_id=knowledge_base_id,
                top_k=fetch_count,
            )

        # 5. Rerank if requested
        documents = raw_docs
        if use_reranker and raw_docs:
            async with trace_stage(tracker, "reranking"):
                documents = await self.reranker.rerank(
                    query=clean_question,
                    documents=raw_docs,
                    top_n=top_k,
                )

        # 6. Filter by relevance score threshold
        relevant_documents = [
            doc for doc in documents if float(doc.get("score", 0)) >= self.score_threshold
        ]

        if not relevant_documents:
            no_info_answer = "ไม่พบข้อมูลที่เกี่ยวข้องเพียงพอในฐานความรู้"
            if conversation_id:
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=no_info_answer,
                    status="completed",
                )
            return {
                "answer": no_info_answer,
                "sources": [],
                "metadata": {
                    "retrieval_count": len(raw_docs),
                    "used_context_count": 0,
                    "model": None,
                    "timings": tracker.summary(),
                },
            }

        # 7. Build prompt with context limit enforcement
        prompt, used_documents = self.prompt_builder.build(
            question=clean_question,
            documents=relevant_documents,
            history=history,
        )

        sources = [
            {
                "document_id": str(doc["document_id"]),
                "chunk_id": str(doc["chunk_id"]),
                "filename": doc["filename"],
                "content": doc["content"],
                "score": round(float(doc["score"]), 4),
            }
            for doc in used_documents
        ]

        # 8. Generate answer with resilient retry
        try:
            async with trace_stage(tracker, "generation"):
                answer = await self.llm_provider.generate(
                    prompt=prompt,
                    request_id=request_id,
                    conversation_id=str(conversation_id) if conversation_id else None,
                )

            if conversation_id:
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=answer,
                    sources=sources,
                    status="completed",
                )

            prompt_tokens_est = estimate_token_count(prompt)
            answer_tokens_est = estimate_token_count(answer)

            return {
                "answer": answer,
                "sources": sources,
                "metadata": {
                    "model": getattr(self.llm_provider, "model_name", "llm"),
                    "retrieval_count": len(raw_docs),
                    "used_context_count": len(used_documents),
                    "estimated_prompt_tokens": prompt_tokens_est,
                    "estimated_answer_tokens": answer_tokens_est,
                    "timings": tracker.summary(),
                },
            }

        except Exception as e:
            error_detail = sanitize_error_message(str(e))
            status_code = extract_status_code(e) or 503
            category = classify_error(e)
            logger.error(
                f"RAG execution failed: {category} ({status_code})",
                extra={
                    "request_id": request_id,
                    "conversation_id": str(conversation_id) if conversation_id else None,
                    "category": category,
                    "status_code": status_code,
                },
            )

            # Record failure in memory without storing raw error as successful content
            if conversation_id:
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content="ขออภัย ระบบไม่สามารถสร้างคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
                    sources=sources,
                    status="failed",
                    metadata={"error": error_detail, "code": status_code, "category": category},
                )

            return {
                "answer": "ขออภัย ระบบไม่สามารถสร้างคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
                "sources": sources,
                "metadata": {
                    "error": error_detail,
                    "category": category,
                    "status_code": status_code,
                    "timings": tracker.summary(),
                },
            }

    async def execute_stream(
        self,
        db: AsyncSession,
        question: str,
        knowledge_base_id: UUID,
        conversation_id: Optional[UUID] = None,
        top_k: int = 5,
        use_reranker: bool = False,
    ) -> AsyncGenerator[str, None]:
        """Streams RAG generation using Server-Sent Events (SSE) with robust failure handling."""
        tracker = LatencyTracker()
        request_id = str(uuid.uuid4())

        clean_question = SecurityGuard.sanitize_input(question)
        is_injected, pattern = SecurityGuard.detect_prompt_injection(clean_question)
        if is_injected:
            yield f"event: error\ndata: {json.dumps({'error': 'Security policy violation', 'detail': pattern, 'code': 400})}\n\n"
            return

        # 1. Persist user message once before stream starts
        if conversation_id:
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="user",
                content=clean_question,
                status="completed",
            )

        history = await self.memory.get_history(db=db, conversation_id=conversation_id)

        # 2. Retrieve
        fetch_count = top_k * 2 if use_reranker else top_k
        raw_docs = await self.retriever.retrieve(
            db=db,
            question=clean_question,
            knowledge_base_id=knowledge_base_id,
            top_k=fetch_count,
        )

        documents = raw_docs
        if use_reranker and raw_docs:
            documents = await self.reranker.rerank(
                query=clean_question,
                documents=raw_docs,
                top_n=top_k,
            )

        relevant_docs = [
            doc for doc in documents if float(doc.get("score", 0)) >= self.score_threshold
        ]

        if not relevant_docs:
            no_info_answer = "ไม่พบข้อมูลที่เกี่ยวข้องเพียงพอในฐานความรู้"
            if conversation_id:
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=no_info_answer,
                    status="completed",
                )
            yield f"data: {json.dumps({'content': no_info_answer, 'done': False})}\n\n"
            yield f"event: done\ndata: {json.dumps({'timings': tracker.summary(), 'done': True})}\n\n"
            return

        prompt, used_docs = self.prompt_builder.build(
            question=clean_question,
            documents=relevant_docs,
            history=history,
        )

        sources = [
            {
                "document_id": str(doc["document_id"]),
                "chunk_id": str(doc["chunk_id"]),
                "filename": doc["filename"],
                "score": round(float(doc["score"]), 4),
            }
            for doc in used_docs
        ]

        # 3. Send initial sources event
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        # 4. Create assistant message placeholder in 'streaming' state
        assistant_msg_id: Optional[str] = None
        if conversation_id:
            assistant_msg_id = await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="assistant",
                content="",
                sources=sources,
                status="streaming",
            )

        full_answer = []
        stream_failed = False
        error_payload: Optional[dict] = None

        try:
            async for chunk in self.llm_provider.generate_stream(
                prompt=prompt,
                request_id=request_id,
                conversation_id=str(conversation_id) if conversation_id else None,
            ):
                full_answer.append(chunk)
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

        except Exception as e:
            stream_failed = True
            error_detail = sanitize_error_message(str(e))
            status_code = extract_status_code(e) or 503
            category = classify_error(e)
            is_partial = isinstance(e, StreamingInterruptedError) or len(full_answer) > 0

            logger.error(
                f"LLM streaming failure: {category} (status={status_code}, partial={is_partial})",
                extra={
                    "request_id": request_id,
                    "conversation_id": str(conversation_id) if conversation_id else None,
                    "category": category,
                    "status_code": status_code,
                    "tokens_emitted": len(full_answer),
                },
            )

            error_payload = {
                "error": error_detail,
                "code": status_code,
                "category": category,
                "partial": is_partial,
            }

            # Update assistant message in database with 'failed' status and failure metadata
            if conversation_id and assistant_msg_id:
                await self.memory.update_message(
                    db=db,
                    conversation_id=conversation_id,
                    message_id=assistant_msg_id,
                    content="".join(full_answer),
                    sources=sources,
                    status="failed",
                    metadata=error_payload,
                )

            # Emit explicit SSE error event and terminate stream
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            return

        # 5. On successful stream completion:
        final_answer = "".join(full_answer)
        if conversation_id and assistant_msg_id:
            await self.memory.update_message(
                db=db,
                conversation_id=conversation_id,
                message_id=assistant_msg_id,
                content=final_answer,
                sources=sources,
                status="completed",
            )

        # 6. Send completion event
        yield f"event: done\ndata: {json.dumps({'timings': tracker.summary(), 'done': True})}\n\n"
