from uuid import UUID

from app.generation.llm_provider import GeminiProvider
from app.generation.prompt_builder import PromptBuilder
from app.retrieval.retriever import Retriever
from sqlalchemy.ext.asyncio import AsyncSession

class RagRuntime:
    def __init__(
        self,
        retriever: Retriever,
        prompt_builder: PromptBuilder,
        llm_provider: GeminiProvider,
        score_threshold: float = 0.45,
    ):

        self.retriever = retriever
        self.prompt_builder = prompt_builder
        self.llm_provider = llm_provider
        self.score_threshold = score_threshold

    async def execute(
        self,
        db: AsyncSession,
        question: str,
        knowledge_base_id: UUID,
        top_k: int = 5,
    ):

        # STEP 1: Retrieve
        documents = await self.retriever.retrieve(
            db=db,
            question=question,
            knowledge_base_id=knowledge_base_id,
            top_k=top_k,
        )

        # STEP 2: Relevance Filtering
        relevant_documents = [
            doc for doc in documents if float(doc["score"]) >= self.score_threshold
        ]

        # STEP 3: Check Context
        if not relevant_documents:
            return {
                "answer": ("ไม่พบข้อมูลที่เกี่ยวข้องเพียงพอ ในฐานความรู้"),
                "sources": [],
                "metadata": {
                    "retrieval_count": len(documents),
                    "used_context_count": 0,
                    "model": None,
                },
            }

        # STEP 4: Build Prompt
        prompt = self.prompt_builder.build(
            question=question,
            documents=relevant_documents,
        )

        # STEP 5: Generate
        answer = await self.llm_provider.generate(prompt=prompt)

        # STEP 6: Build Sources
        sources = [
            {
                "document_id": str(doc["document_id"]),
                "chunk_id": str(doc["chunk_id"]),
                "filename": doc["filename"],
                "content": doc["content"],
                "score": float(doc["score"]),
            }
            for doc in relevant_documents
        ]

        # STEP 7: Return
        return {
            "answer": answer,
            "sources": sources,
            "metadata": {
                "retrieval_count": len(documents),
                "used_context_count": len(relevant_documents),
            },
        }