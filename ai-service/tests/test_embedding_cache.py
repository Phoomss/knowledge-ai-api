import pytest
from app.embeddings.embedding_service import EmbeddingService

class FakeBGEM3Model:
    def __init__(self, *args, **kwargs):
        self.call_count = 0

    def encode(self, texts, batch_size=8, max_length=512):
        self.call_count += 1
        import numpy as np
        # Return fake 1024-dim dense vectors
        return {"dense_vecs": np.zeros((len(texts), 1024))}

@pytest.mark.asyncio
async def test_embedding_lru_cache(monkeypatch):
    monkeypatch.setattr("app.embeddings.embedding_service.BGEM3FlagModel", FakeBGEM3Model)
    service = EmbeddingService(model_name="dummy", cache_size=2)

    # First query -> cache miss
    vec1 = await service.embed_query("คำถามทดสอบ")
    assert service.model.call_count == 1
    assert len(vec1) == 1024

    # Second query identical -> cache hit (no extra model encode call!)
    vec2 = await service.embed_query("คำถามทดสอบ")
    assert service.model.call_count == 1
    assert vec1 == vec2

    # Different query -> cache miss
    await service.embed_query("คำถามใหม่")
    assert service.model.call_count == 2
