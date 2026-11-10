from uuid import UUID

from pydantic import BaseModel, Field

class IngestTextRequest(BaseModel):
    knowledge_base_id: UUID

    filename: str = Field(
        min_length=1,
        max_length=255,
    )

    content: str = Field(
        min_length=1,
        max_length=1000000,
    )


class IngestResponse(BaseModel):
    document_id: UUID

    filename: str

    chunks_created: int

    status: str
