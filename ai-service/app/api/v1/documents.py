from uuid import uuid4

from app.api.ingestion_dependencies import get_ingestion_pipeline
from app.database.session import get_db
from app.ingestion.pipeline import IngestionPipeline
from app.schemas.document import (
    IngestResponse,
    IngestTextRequest,
)
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["Documents"],
)


@router.post(
    "/ingest-text",
    response_model=IngestResponse,
)
async def ingest_text(
    request: IngestTextRequest,
    db: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):

    document_id = uuid4()

    try:
        # 1. Verify Knowledge Base
        knowledge_base = await db.execute(
            text("""
                SELECT id
                FROM knowledge_bases
                WHERE id = :id
            """),
            {
                "id": str(request.knowledge_base_id),
            },
        )

        if not knowledge_base.first():
            raise HTTPException(
                status_code=404,
                detail="Knowledge Base not found",
            )

        # 2. Create Document
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

        # 3. Run Ingestion
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
            {
                "id": str(document_id),
            },
        )

        await db.commit()

        raise HTTPException(
            status_code=500,
            detail="Document ingestion failed",
        ) from error
