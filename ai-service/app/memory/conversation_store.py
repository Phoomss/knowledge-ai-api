import time
from typing import Optional, Union
from collections import defaultdict
from uuid import UUID


class ConversationMemory:
    """
    Thread-safe in-memory conversation memory with sliding window.
    Stores messages partitioned by conversation_id.
    """

    def __init__(self, max_history_per_conv: int = 10, ttl_seconds: int = 86400):
        self.max_history_per_conv = max_history_per_conv
        self.ttl_seconds = ttl_seconds
        # Mapping: str(conversation_id) -> list of {"role": "user"|"assistant", "content": str, "timestamp": float}
        self._store: dict[str, list[dict]] = defaultdict(list)

    def add_message(self, conversation_id: Union[UUID, str], role: str, content: str):
        key = str(conversation_id)
        self._store[key].append({
            "role": role,
            "content": content,
            "timestamp": time.time(),
        })

        # Keep only the last max_history_per_conv messages
        if len(self._store[key]) > self.max_history_per_conv:
            self._store[key] = self._store[key][-self.max_history_per_conv :]

    def get_history(self, conversation_id: Optional[Union[UUID, str]], max_turns: Optional[int] = None) -> list[dict]:
        if not conversation_id:
            return []
        key = str(conversation_id)
        messages = self._store.get(key, [])
        if max_turns:
            return messages[-max_turns:]
        return list(messages)

    def clear(self, conversation_id: Union[UUID, str]):
        key = str(conversation_id)
        if key in self._store:
            del self._store[key]


# Global memory singleton
memory_store = ConversationMemory()
