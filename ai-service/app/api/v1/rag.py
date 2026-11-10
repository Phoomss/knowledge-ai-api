from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_evaluator, get_rag_runtime
from app.core.security import verify_api_key
from app.database.session import get_db
from app.evaluation.rag_evaluator import RagEvaluator
from app.orchestration.rag_runtime import RagRuntime
from app.schemas.rag import (
    RagEvalRequest,
    RagEvalResponse,
    RagQueryRequest,
    RagQueryResponse,
)

router = APIRouter(
    prefix="/api/v1/rag",
    tags=["RAG"],
    dependencies=[Depends(verify_api_key)],
)


@router.post(
    "/query",
    response_model=RagQueryResponse,
)
async def query_rag(
    request: RagQueryRequest,
    db: AsyncSession = Depends(get_db),
    runtime: RagRuntime = Depends(get_rag_runtime),
):
    try:
        result = await runtime.execute(
            db=db,
            question=request.question,
            knowledge_base_id=request.knowledge_base_id,
            conversation_id=request.conversation_id,
            top_k=request.options.top_k,
            use_reranker=request.options.use_reranker,
        )
        return result
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"RAG processing failed: {str(error)}",
        ) from error


@router.post("/query/stream")
async def query_rag_stream(
    request: RagQueryRequest,
    db: AsyncSession = Depends(get_db),
    runtime: RagRuntime = Depends(get_rag_runtime),
):
    """
    Streams RAG response using Server-Sent Events (SSE).
    """
    try:
        return StreamingResponse(
            runtime.execute_stream(
                db=db,
                question=request.question,
                knowledge_base_id=request.knowledge_base_id,
                conversation_id=request.conversation_id,
                top_k=request.options.top_k,
                use_reranker=request.options.use_reranker,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Streaming failed: {str(error)}",
        ) from error


@router.post(
    "/evaluate",
    response_model=RagEvalResponse,
)
async def evaluate_rag(
    request: RagEvalRequest,
    evaluator: RagEvaluator = Depends(get_evaluator),
):
    """
    Evaluates RAG generation on Faithfulness and Context Relevance.
    """
    try:
        eval_result = await evaluator.evaluate_all(
            question=request.question,
            answer=request.answer,
            context=request.context,
        )
        return RagEvalResponse(**eval_result)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(error)}",
        ) from error
