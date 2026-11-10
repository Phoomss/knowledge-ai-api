from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

class RagOptions(BaseModel):
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )
    use_reranker: bool = False

class RagQueryRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=10000,
    )
    knowledge_base_id: UUID
    conversation_id: Optional[UUID] = None
    options: RagOptions = Field(
        default_factory=RagOptions,
    )

class RagSource(BaseModel):
    document_id: UUID
    chunk_id: UUID
    filename: str
    content: str
    score: float

class RagMetadata(BaseModel):
    model: Optional[str] = None
    retrieval_count: int
    used_context_count: int

class RagQueryResponse(BaseModel):
    answer: str
    sources: list[RagSource]
    metadata: RagMetadata