from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class IngestTextRequest(BaseModel):
    document_id: Optional[UUID] = None
    knowledge_base_id: UUID
    filename: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=10000000)
    background: bool = False


class IngestResponse(BaseModel):
    document_id: UUID
    filename: str
    chunks_created: int
    status: str
    message: Optional[str] = None
