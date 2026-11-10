from uuid import UUID

from app.embeddings.embedding_service import EmbeddingService
from app.ingestion.chunker import TextChunker
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class IngestionPipeline:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        chunker: TextChunker,
    ):

        self.embedding_service = embedding_service
        self.chunker = chunker

    async def ingest(
        self,
        db: AsyncSession,
        document_id: UUID,
        content: str,
    ):

        chunks = self.chunker.split(content)

        if not chunks:
            raise ValueError("Document content is empty")

        vectors = await self.embedding_service.embed_documents(
            [chunk.content for chunk in chunks]
        )

        if len(vectors) != len(chunks):
            raise RuntimeError("Embedding count mismatch")

        try:
            for chunk, vector in zip(chunks, vectors):
                vector_string = "[" + ",".join(map(str, vector)) + "]"

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
                        "metadata": "{}",
                    },
                )

            await db.execute(
                text("""
                    UPDATE documents
                    SET status = 'COMPLETED'
                    WHERE id = :document_id
                """),
                {
                    "document_id": str(document_id),
                },
            )

            await db.commit()

            return {
                "document_id": str(document_id),
                "chunks_created": len(chunks),
                "status": "COMPLETED",
            }

        except Exception:
            await db.rollback()
            raise
