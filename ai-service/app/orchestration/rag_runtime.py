import json
import logging
from typing import AsyncGenerator, Optional
from uuid import UUID

from app.core.observability import LatencyTracker, trace_stage, estimate_token_count
from app.core.security import SecurityGuard
from app.evaluation.rag_evaluator import RagEvaluator
from app.generation.llm_provider import GeminiProvider
from app.generation.prompt_builder import PromptBuilder
from app.memory.conversation_store import ConversationMemory, memory_store
from app.retrieval.reranker import Reranker
from app.retrieval.retriever import Retriever
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("rag.runtime")


class RagRuntime:
    def __init__(
        self,
        retriever: Retriever,
        prompt_builder: PromptBuilder,
        llm_provider: GeminiProvider,
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

        # 2. Conversation Memory: Get previous turns from PostgreSQL
        history = await self.memory.get_history(db=db, conversation_id=conversation_id)

        # 3. Retrieve documents
        async with trace_stage(tracker, "retrieval"):
            # Fetch more if reranking is enabled
            fetch_count = top_k * 2 if use_reranker else top_k
            raw_docs = await self.retriever.retrieve(
                db=db,
                question=clean_question,
                knowledge_base_id=knowledge_base_id,
                top_k=fetch_count,
            )

        # 4. Rerank if requested
        documents = raw_docs
        if use_reranker and raw_docs:
            async with trace_stage(tracker, "reranking"):
                documents = await self.reranker.rerank(
                    query=clean_question,
                    documents=raw_docs,
                    top_n=top_k,
                )

        # 5. Filter by relevance score threshold
        relevant_documents = [
            doc for doc in documents if float(doc.get("score", 0)) >= self.score_threshold
        ]

        if not relevant_documents:
            no_info_answer = "ไม่พบข้อมูลที่เกี่ยวข้องเพียงพอในฐานความรู้"
            if conversation_id:
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="user",
                    content=clean_question,
                )
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=no_info_answer,
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

        # 6. Build prompt with context limit enforcement
        prompt, used_documents = self.prompt_builder.build(
            question=clean_question,
            documents=relevant_documents,
            history=history,
        )

        # 7. Generate answer with timeout & retry
        try:
            async with trace_stage(tracker, "generation"):
                answer = await self.llm_provider.generate(prompt=prompt)
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            answer = f"ขออภัย ไม่สามารถสร้างคำตอบได้เนื่องจากเกิดข้อผิดพลาดจากผู้ให้บริการ AI: {str(e)}"

        # 8. Format response sources
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

        # 9. Record in conversation memory (PostgreSQL)
        if conversation_id:
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="user",
                content=clean_question,
            )
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="assistant",
                content=answer,
                sources=sources,
            )

        # 10. Observability metadata
        prompt_tokens_est = estimate_token_count(prompt)
        answer_tokens_est = estimate_token_count(answer)

        return {
            "answer": answer,
            "sources": sources,
            "metadata": {
                "model": self.llm_provider.model,
                "retrieval_count": len(raw_docs),
                "used_context_count": len(used_documents),
                "estimated_prompt_tokens": prompt_tokens_est,
                "estimated_answer_tokens": answer_tokens_est,
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
        """Streams RAG generation using Server-Sent Events (SSE)."""
        tracker = LatencyTracker()

        clean_question = SecurityGuard.sanitize_input(question)
        is_injected, pattern = SecurityGuard.detect_prompt_injection(clean_question)
        if is_injected:
            yield f"data: {json.dumps({'error': 'Security policy violation', 'detail': pattern})}\n\n"
            return

        history = await self.memory.get_history(db=db, conversation_id=conversation_id)

        # Retrieve
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
                    role="user",
                    content=clean_question,
                )
                await self.memory.add_message(
                    db=db,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=no_info_answer,
                )
            yield f"data: {json.dumps({'content': no_info_answer, 'done': True})}\n\n"
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

        # Send initial sources event
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        full_answer = []
        try:
            async for chunk in self.llm_provider.generate_stream(prompt):
                full_answer.append(chunk)
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            err_msg = f"\n[เกิดข้อผิดพลาดในการเชื่อมต่อโมเดล AI: {str(e)}]"
            full_answer.append(err_msg)
            yield f"data: {json.dumps({'content': err_msg, 'done': False, 'error': str(e)})}\n\n"

        final_answer = "".join(full_answer)
        if conversation_id:
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="user",
                content=clean_question,
            )
            await self.memory.add_message(
                db=db,
                conversation_id=conversation_id,
                role="assistant",
                content=final_answer,
                sources=sources,
            )

        # Send completion event
        yield f"event: done\ndata: {json.dumps({'timings': tracker.summary(), 'done': True})}\n\n"
