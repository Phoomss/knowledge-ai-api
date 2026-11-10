from uuid import UUID

from app.embeddings.embedding_service import EmbeddingService
from app.retrieval.vector_store import VectorStore
from sqlalchemy.ext.asyncio import AsyncSession


class Retriever:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
    ):

        self.embedding_service = embedding_service
        self.vector_store = vector_store

    async def retrieve(
        self,
        db: AsyncSession,
        question: str,
        knowledge_base_id: UUID,
        top_k: int = 5,
    ):

        query_vector = await self.embedding_service.embed_query(question)

        results = await self.vector_store.search(
            db=db,
            knowledge_base_id=knowledge_base_id,
            query_vector=query_vector,
            top_k=top_k,
        )

        return results