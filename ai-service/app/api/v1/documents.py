import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.ingestion_dependencies import get_ingestion_pipeline
from app.core.security import verify_api_key
from app.database.session import AsyncSessionLocal, get_db
from app.ingestion.pipeline import IngestionPipeline
from app.schemas.document import IngestResponse, IngestTextRequest

logger = logging.getLogger("rag.ingestion")

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Documents"],
    dependencies=[Depends(verify_api_key)],
)


async def background_ingest_worker(
    document_id: UUID,
    content: str,
    pipeline: IngestionPipeline,
):
    """Executes document chunking and vector embedding in the background."""
    logger.info(f"Starting background ingestion for document {document_id}")
    async with AsyncSessionLocal() as session:
        try:
            result = await pipeline.ingest(
                db=session,
                document_id=document_id,
                content=content,
            )
            logger.info(
                f"Background ingestion succeeded for document {document_id} ({result.get('chunks_created')} chunks)"
            )
        except Exception as error:
            logger.error(
                f"Background ingestion failed for document {document_id}: {error}",
                exc_info=True,
            )
            await session.rollback()
            await session.execute(
                text("""
                    UPDATE documents
                    SET status = 'FAILED'
                    WHERE id = :id
                """),
                {"id": str(document_id)},
            )
            await session.commit()


@router.post(
    "/ingest-text",
    response_model=IngestResponse,
)
async def ingest_text(
    request: IngestTextRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    document_id = uuid4()

    try:
        # 1. Verify Knowledge Base exists
        knowledge_base = await db.execute(
            text("""
                SELECT id
                FROM knowledge_bases
                WHERE id = :id
            """),
            {"id": str(request.knowledge_base_id)},
        )

        if not knowledge_base.first():
            raise HTTPException(
                status_code=404,
                detail="Knowledge Base not found",
            )

        # 2. Create Document record in database
        await db.execute(
            text("""
                INSERT INTO documents (
                    id,
                    knowledge_base_id,
                    filename,
                    status
                )
                VALUES (
                    :id,
                    :knowledge_base_id,
                    :filename,
                    'PROCESSING'
                )
            """),
            {
                "id": str(document_id),
                "knowledge_base_id": str(request.knowledge_base_id),
                "filename": request.filename,
            },
        )
        await db.commit()

        # 3. Choose Background vs Synchronous Ingestion
        if request.background:
            background_tasks.add_task(
                background_ingest_worker,
                document_id=document_id,
                content=request.content,
                pipeline=pipeline,
            )
            return IngestResponse(
                document_id=document_id,
                filename=request.filename,
                chunks_created=0,
                status="PROCESSING",
                message="Ingestion queued for background processing",
            )

        # Synchronous execution
        result = await pipeline.ingest(
            db=db,
            document_id=document_id,
            content=request.content,
        )

        return IngestResponse(
            document_id=document_id,
            filename=request.filename,
            chunks_created=result["chunks_created"],
            status="COMPLETED",
            message="Document ingestion completed successfully",
        )

    except HTTPException:
        raise
    except Exception as error:
        await db.rollback()
        await db.execute(
            text("""
                UPDATE documents
                SET status = 'FAILED'
                WHERE id = :id
            """),
            {"id": str(document_id)},
        )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Document ingestion failed: {str(error)}",
        ) from error
