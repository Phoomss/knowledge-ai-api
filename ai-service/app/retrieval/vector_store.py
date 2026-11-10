import logging
from typing import List, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("rag.retrieval")


class VectorStore:
    async def search(
        self,
        db: AsyncSession,
        knowledge_base_id: UUID,
        query_vector: List[float],
        query_text: Optional[str] = None,
        top_k: int = 5,
        search_mode: str = "hybrid",
    ) -> List[dict]:
        """
        Retrieves candidate document chunks using Hybrid Search (Vector + Full-Text BM25)
        fused via Reciprocal Rank Fusion (RRF), or pure Vector / Keyword search.
        """
        vector_string = "[" + ",".join(map(str, query_vector)) + "]"
        kb_str = str(knowledge_base_id)

        if search_mode == "hybrid" and query_text and query_text.strip():
            return await self._hybrid_search(
                db=db,
                knowledge_base_id=kb_str,
                vector_string=vector_string,
                query_text=query_text.strip(),
                top_k=top_k,
            )

        return await self._vector_search(
            db=db,
            knowledge_base_id=kb_str,
            vector_string=vector_string,
            top_k=top_k,
        )

    async def _vector_search(
        self,
        db: AsyncSession,
        knowledge_base_id: str,
        vector_string: str,
        top_k: int,
    ) -> List[dict]:
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

                WHERE d.knowledge_base_id = CAST(:knowledge_base_id AS uuid)
                  AND d.status = 'COMPLETED'

                ORDER BY
                    c.embedding <=> CAST(:embedding AS vector)

                LIMIT :top_k
            """),
            {
                "embedding": vector_string,
                "knowledge_base_id": knowledge_base_id,
                "top_k": top_k,
            },
        )
        return [dict(row) for row in result.mappings().all()]

    async def _hybrid_search(
        self,
        db: AsyncSession,
        knowledge_base_id: str,
        vector_string: str,
        query_text: str,
        top_k: int,
    ) -> List[dict]:
        fetch_k = max(top_k * 3, 15)
        sql = text("""
            WITH vector_matches AS (
                SELECT
                    c.id AS chunk_id,
                    c.document_id,
                    c.content,
                    d.filename,
                    ROW_NUMBER() OVER (ORDER BY c.embedding <=> CAST(:embedding AS vector)) AS rank_v,
                    1 - (c.embedding <=> CAST(:embedding AS vector)) AS v_score
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE d.knowledge_base_id = CAST(:knowledge_base_id AS uuid)
                  AND d.status = 'COMPLETED'
                ORDER BY c.embedding <=> CAST(:embedding AS vector)
                LIMIT :fetch_k
            ),
            text_matches AS (
                SELECT
                    c.id AS chunk_id,
                    c.document_id,
                    c.content,
                    d.filename,
                    ROW_NUMBER() OVER (
                        ORDER BY ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', :query_text)) DESC
                    ) AS rank_t,
                    ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', :query_text)) AS t_score
                FROM document_chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE d.knowledge_base_id = CAST(:knowledge_base_id AS uuid)
                  AND d.status = 'COMPLETED'
                  AND to_tsvector('simple', c.content) @@ plainto_tsquery('simple', :query_text)
                ORDER BY t_score DESC
                LIMIT :fetch_k
            ),
            fused AS (
                SELECT
                    COALESCE(v.chunk_id, t.chunk_id) AS chunk_id,
                    COALESCE(v.document_id, t.document_id) AS document_id,
                    COALESCE(v.content, t.content) AS content,
                    COALESCE(v.filename, t.filename) AS filename,
                    COALESCE(1.0 / (60.0 + v.rank_v), 0.0) + COALESCE(1.0 / (60.0 + t.rank_t), 0.0) AS rrf_score,
                    COALESCE(v.v_score, 0.0) AS v_score,
                    COALESCE(t.t_score, 0.0) AS t_score
                FROM vector_matches v
                FULL OUTER JOIN text_matches t ON v.chunk_id = t.chunk_id
            )
            SELECT
                chunk_id,
                document_id,
                content,
                filename,
                GREATEST(v_score, LEAST(1.0, 0.5 + t_score * 0.5)) AS score,
                rrf_score
            FROM fused
            ORDER BY rrf_score DESC
            LIMIT :top_k
        """)

        result = await db.execute(
            sql,
            {
                "embedding": vector_string,
                "knowledge_base_id": knowledge_base_id,
                "query_text": query_text,
                "fetch_k": fetch_k,
                "top_k": top_k,
            },
        )
        rows = [dict(row) for row in result.mappings().all()]
        return rows
