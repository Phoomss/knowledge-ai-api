import pytest
from app.memory.conversation_store import ConversationMemory

@pytest.mark.asyncio
async def test_in_memory_conversation_history():
    memory = ConversationMemory(max_history_per_conv=3)
    conv_id = "test-uuid-1234"

    # Add messages without db (uses in-memory fallback)
    await memory.add_message(db=None, conversation_id=conv_id, role="user", content="Hello 1")
    await memory.add_message(db=None, conversation_id=conv_id, role="assistant", content="Hi 1")
    await memory.add_message(db=None, conversation_id=conv_id, role="user", content="Hello 2")
    await memory.add_message(db=None, conversation_id=conv_id, role="assistant", content="Hi 2")

    history = await memory.get_history(db=None, conversation_id=conv_id)
    assert len(history) == 3
    assert history[0]["content"] == "Hi 1"
    assert history[1]["content"] == "Hello 2"
    assert history[2]["content"] == "Hi 2"

@pytest.mark.asyncio
async def test_empty_conversation_history():
    memory = ConversationMemory()
    history = await memory.get_history(db=None, conversation_id="non-existent")
    assert history == []
