from app.api.dependencies import get_rag_runtime
from app.database.session import get_db
from app.orchestration.rag_runtime import RagRuntime
from app.schemas.rag import (
    RagQueryRequest,
    RagQueryResponse,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(
    prefix="/api/v1/rag",
    tags=["RAG"],
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
            top_k=request.options.top_k,
        )

        result["metadata"]["model"] = (
            runtime.llm_provider.model
            if result["metadata"].get("used_context_count", 0) > 0
            else None
        )

        return result

    except Exception as error:
        # Log the real error internally.
        # Do not expose database or provider details to clients.

        raise HTTPException(
            status_code=500,
            detail="RAG processing failed",
        ) from error