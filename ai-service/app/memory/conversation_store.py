import json
import logging
import time
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("rag.memory")


class ConversationMemory:
    """
    PostgreSQL-backed conversation memory with in-memory cache fallback.
    Stores and retrieves multi-turn dialogue history partitioned by conversation_id.
    """

    def __init__(self, max_history_per_conv: int = 10):
        self.max_history_per_conv = max_history_per_conv
        self._cache: Dict[str, List[dict]] = {}

    async def add_message(
        self,
        db: Optional[AsyncSession],
        conversation_id: Union[UUID, str],
        role: str,
        content: str,
        sources: Optional[list] = None,
    ):
        key = str(conversation_id)
        msg_obj = {
            "role": role,
            "content": content,
            "sources": sources or [],
            "timestamp": time.time(),
        }

        # Update local in-memory cache
        if key not in self._cache:
            self._cache[key] = []
        self._cache[key].append(msg_obj)
        if len(self._cache[key]) > self.max_history_per_conv:
            self._cache[key] = self._cache[key][-self.max_history_per_conv :]

        # Persist to PostgreSQL if database session provided
        if db is not None:
            try:
                # Ensure conversation record exists
                await db.execute(
                    text("""
                        INSERT INTO conversations (id, created_at, updated_at)
                        VALUES (CAST(:conv_id AS uuid), NOW(), NOW())
                        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
                    """),
                    {"conv_id": key},
                )

                # Insert message
                await db.execute(
                    text("""
                        INSERT INTO conversation_messages (
                            id,
                            conversation_id,
                            role,
                            content,
                            sources,
                            created_at
                        )
                        VALUES (
                            gen_random_uuid(),
                            CAST(:conv_id AS uuid),
                            :role,
                            :content,
                            CAST(:sources AS jsonb),
                            NOW()
                        )
                    """),
                    {
                        "conv_id": key,
                        "role": role,
                        "content": content,
                        "sources": json.dumps(sources or []),
                    },
                )
                await db.commit()
                logger.info(f"Persisted '{role}' message to conversation {key} in PostgreSQL")
            except Exception as e:
                logger.error(f"Failed to persist message to PostgreSQL for conversation {key}: {e}")
                await db.rollback()

    async def get_history(
        self,
        db: Optional[AsyncSession],
        conversation_id: Optional[Union[UUID, str]],
        max_turns: Optional[int] = None,
    ) -> List[dict]:
        if not conversation_id:
            return []

        key = str(conversation_id)
        limit = max_turns or self.max_history_per_conv

        # 1. Fetch from PostgreSQL if database session is provided
        if db is not None:
            try:
                result = await db.execute(
                    text("""
                        SELECT role, content, sources, created_at
                        FROM conversation_messages
                        WHERE conversation_id = CAST(:conv_id AS uuid)
                        ORDER BY created_at ASC
                    """),
                    {"conv_id": key},
                )
                rows = result.mappings().all()
                if rows:
                    messages = [
                        {
                            "role": row["role"],
                            "content": row["content"],
                            "sources": row["sources"],
                        }
                        for row in rows
                    ]
                    self._cache[key] = messages[-self.max_history_per_conv :]
                    return messages[-limit:]
            except Exception as e:
                logger.error(
                    f"Failed to fetch conversation history from PostgreSQL: {e}. Falling back to cache."
                )

        # 2. Fallback to cache
        messages = self._cache.get(key, [])
        return messages[-limit:]

    async def clear(self, db: Optional[AsyncSession], conversation_id: Union[UUID, str]):
        key = str(conversation_id)
        if key in self._cache:
            del self._cache[key]

        if db is not None:
            try:
                await db.execute(
                    text("DELETE FROM conversations WHERE id = CAST(:conv_id AS uuid)"),
                    {"conv_id": key},
                )
                await db.commit()
            except Exception as e:
                logger.error(f"Failed to delete conversation {key}: {e}")
                await db.rollback()


# Global memory singleton
memory_store = ConversationMemory()
