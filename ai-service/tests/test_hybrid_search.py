import pytest
from app.retrieval.vector_store import VectorStore

@pytest.mark.asyncio
async def test_vector_store_hybrid_initialization():
    store = VectorStore()
    assert hasattr(store, "search")
    assert hasattr(store, "_hybrid_search")
    assert hasattr(store, "_vector_search")
