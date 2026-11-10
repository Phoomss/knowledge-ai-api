from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class VectorStore:
    async def search(
        self,
        db: AsyncSession,
        knowledge_base_id: UUID,
        query_vector: list[float],
        top_k: int = 5,
    ):

        vector_string = "[" + ",".join(map(str, query_vector)) + "]"

        result = await db.execute(
            text("""
                SELECT
                    c.id AS chunk_id,
                    c.document_id,
                    c.content,
                    d.filename,
                    1 - (
                        c.embedding <=> CAST(:embedding AS vector)
                    ) AS score

                FROM document_chunks c

                JOIN documents d
                    ON d.id = c.document_id

                WHERE d.knowledge_base_id = :knowledge_base_id
                  AND d.status = 'COMPLETED'

                ORDER BY
                    c.embedding <=> CAST(:embedding AS vector)

                LIMIT :top_k
            """),
            {
                "embedding": vector_string,
                "knowledge_base_id": str(knowledge_base_id),
                "top_k": top_k,
            },
        )

        return [dict(row) for row in result.mappings().all()]