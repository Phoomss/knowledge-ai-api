import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
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

# Max allowed file size (50MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024


async def background_text_ingest_worker(
    document_id: UUID,
    content: str,
    pipeline: IngestionPipeline,
):
    """Executes document chunking and vector embedding in the background."""
    logger.info(f"Starting background text ingestion for document {document_id}")
    async with AsyncSessionLocal() as session:
        try:
            result = await pipeline.ingest(
                db=session,
                document_id=document_id,
                content=content,
            )
            logger.info(
                f"Background text ingestion succeeded for document {document_id} ({result.get('chunks_created')} chunks)"
            )
        except Exception as error:
            logger.error(
                f"Background text ingestion failed for document {document_id}: {error}",
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


async def background_pdf_ingest_worker(
    document_id: UUID,
    pdf_bytes: bytes,
    pipeline: IngestionPipeline,
):
    """Parses and ingests PDF in the background."""
    logger.info(f"Starting background PDF ingestion for document {document_id}")
    async with AsyncSessionLocal() as session:
        try:
            result = await pipeline.ingest_pdf(
                db=session,
                document_id=document_id,
                pdf_bytes=pdf_bytes,
            )
            logger.info(
                f"Background PDF ingestion succeeded for document {document_id} ({result.get('chunks_created')} chunks)"
            )
        except Exception as error:
            logger.error(
                f"Background PDF ingestion failed for document {document_id}: {error}",
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
    document_id = request.document_id or uuid4()

    try:
        # 1. Verify Knowledge Base exists
        knowledge_base = await db.execute(
            text("SELECT id FROM knowledge_bases WHERE id = :id"),
            {"id": str(request.knowledge_base_id)},
        )

        if not knowledge_base.first():
            raise HTTPException(
                status_code=404,
                detail="Knowledge Base not found",
            )

        # 2. Check if Document record already exists
        existing = await db.execute(
            text("SELECT id FROM documents WHERE id = :id"),
            {"id": str(document_id)},
        )

        if existing.first():
            await db.execute(
                text("""
                    UPDATE documents
                    SET status = 'PROCESSING',
                        knowledge_base_id = :knowledge_base_id,
                        filename = :filename
                    WHERE id = :id
                """),
                {
                    "id": str(document_id),
                    "knowledge_base_id": str(request.knowledge_base_id),
                    "filename": request.filename,
                },
            )
        else:
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
                background_text_ingest_worker,
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


@router.post(
    "/upload-pdf",
    response_model=IngestResponse,
)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    knowledge_base_id: UUID = Form(...),
    document_id: Optional[UUID] = Form(None),
    background: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline),
):
    """
    Accepts PDF file upload, extracts text per page, chunks, and creates vector embeddings.
    """
    # 1. Validate file extension & mime type
    filename = file.filename or "uploaded.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files (.pdf) are supported by this endpoint",
        )

    # 2. Read file content and validate size
    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)",
        )

    if len(pdf_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB",
        )

    doc_id = document_id or uuid4()

    try:
        # 3. Verify Knowledge Base exists
        knowledge_base = await db.execute(
            text("SELECT id FROM knowledge_bases WHERE id = :id"),
            {"id": str(knowledge_base_id)},
        )

        if not knowledge_base.first():
            raise HTTPException(
                status_code=404,
                detail=f"Knowledge Base {knowledge_base_id} not found",
            )

        # 4. Upsert document record in DB
        existing = await db.execute(
            text("SELECT id FROM documents WHERE id = :id"),
            {"id": str(doc_id)},
        )

        if existing.first():
            await db.execute(
                text("""
                    UPDATE documents
                    SET status = 'PROCESSING',
                        knowledge_base_id = :knowledge_base_id,
                        filename = :filename
                    WHERE id = :id
                """),
                {
                    "id": str(doc_id),
                    "knowledge_base_id": str(knowledge_base_id),
                    "filename": filename,
                },
            )
        else:
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
                    "id": str(doc_id),
                    "knowledge_base_id": str(knowledge_base_id),
                    "filename": filename,
                },
            )
        await db.commit()

        # 5. Background vs Synchronous Processing
        if background:
            background_tasks.add_task(
                background_pdf_ingest_worker,
                document_id=doc_id,
                pdf_bytes=pdf_bytes,
                pipeline=pipeline,
            )
            return IngestResponse(
                document_id=doc_id,
                filename=filename,
                chunks_created=0,
                status="PROCESSING",
                message="PDF uploaded successfully and queued for background ingestion",
            )

        # Synchronous execution
        result = await pipeline.ingest_pdf(
            db=db,
            document_id=doc_id,
            pdf_bytes=pdf_bytes,
        )

        return IngestResponse(
            document_id=doc_id,
            filename=filename,
            chunks_created=result["chunks_created"],
            status="COMPLETED",
            message=f"PDF parsed and ingested successfully ({result.get('pages_extracted', 1)} pages processed)",
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
            {"id": str(doc_id)},
        )
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"PDF ingestion failed: {str(error)}",
        ) from error
