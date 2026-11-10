import json
import logging
from typing import List, Optional
from uuid import UUID

from app.embeddings.embedding_service import EmbeddingService
from app.ingestion.chunker import TextChunk, TextChunker
from app.ingestion.pdf_extractor import PdfExtractor
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("rag.ingestion")


class IngestionPipeline:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        chunker: TextChunker,
    ):
        self.embedding_service = embedding_service
        self.chunker = chunker

    async def ingest_chunks(
        self,
        db: AsyncSession,
        document_id: UUID,
        chunks: List[TextChunk],
    ) -> dict:
        """Embeds given TextChunks and stores them in document_chunks with metadata."""
        if not chunks:
            raise ValueError("No chunks provided for ingestion")

        logger.info(f"Generating embeddings for {len(chunks)} chunks of document {document_id}")
        vectors = await self.embedding_service.embed_documents(
            [chunk.content for chunk in chunks]
        )

        if len(vectors) != len(chunks):
            raise RuntimeError("Embedding count mismatch")

        try:
            for chunk, vector in zip(chunks, vectors):
                vector_string = "[" + ",".join(map(str, vector)) + "]"
                metadata_json = json.dumps(chunk.metadata or {})

                await db.execute(
                    text("""
                        INSERT INTO document_chunks (
                            id,
                            document_id,
                            content,
                            embedding,
                            chunk_index,
                            metadata
                        )
                        VALUES (
                            gen_random_uuid(),
                            :document_id,
                            :content,
                            CAST(:embedding AS vector),
                            :chunk_index,
                            CAST(:metadata AS jsonb)
                        )
                    """),
                    {
                        "document_id": str(document_id),
                        "content": chunk.content,
                        "embedding": vector_string,
                        "chunk_index": chunk.chunk_index,
                        "metadata": metadata_json,
                    },
                )

            await db.execute(
                text("""
                    UPDATE documents
                    SET status = 'COMPLETED'
                    WHERE id = :document_id
                """),
                {"document_id": str(document_id)},
            )

            await db.commit()
            logger.info(f"Document {document_id} ingestion completed successfully with {len(chunks)} chunks")

            return {
                "document_id": str(document_id),
                "chunks_created": len(chunks),
                "status": "COMPLETED",
            }

        except Exception as error:
            logger.error(f"Error persisting chunks for document {document_id}: {error}")
            await db.rollback()
            raise

    async def ingest(
        self,
        db: AsyncSession,
        document_id: UUID,
        content: str,
    ) -> dict:
        """Ingests raw text content by splitting into chunks and embedding."""
        chunks = self.chunker.split(content)
        if not chunks:
            raise ValueError("Document content is empty")

        return await self.ingest_chunks(db=db, document_id=document_id, chunks=chunks)

    async def ingest_pdf(
        self,
        db: AsyncSession,
        document_id: UUID,
        pdf_bytes: bytes,
    ) -> dict:
        """Parses PDF bytes, extracts per-page text, chunks with page metadata, and embeds."""
        full_text, pages = PdfExtractor.extract_text_and_pages(pdf_bytes)
        chunks = self.chunker.split_pages(pages)
        if not chunks:
            raise ValueError("No text could be extracted from PDF")

        result = await self.ingest_chunks(db=db, document_id=document_id, chunks=chunks)
        result["pages_extracted"] = len(pages)
        return result
