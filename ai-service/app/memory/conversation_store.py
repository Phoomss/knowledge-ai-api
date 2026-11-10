import json
import logging
import time
import uuid
from typing import Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.observability import sanitize_error_message

logger = logging.getLogger("rag.memory")


class ConversationMemory:
    """
    PostgreSQL-backed conversation memory with lifecycle state tracking
    (pending, streaming, completed, failed) and in-memory cache fallback.
    """

    def __init__(self, max_history_per_conv: int = 10):
        self.max_history_per_conv = max_history_per_conv
        self._cache: Dict[str, List[dict]] = {}

    def _sanitize_metadata(self, metadata: Optional[dict]) -> dict:
        """Ensures metadata contains no credentials or API keys."""
        if not metadata:
            return {}
        sanitized = {}
        for k, v in metadata.items():
            if isinstance(v, str):
                sanitized[k] = sanitize_error_message(v)
            elif isinstance(v, dict):
                sanitized[k] = self._sanitize_metadata(v)
            else:
                sanitized[k] = v
        return sanitized

    async def add_message(
        self,
        db: Optional[AsyncSession],
        conversation_id: Union[UUID, str],
        role: str,
        content: str,
        sources: Optional[list] = None,
        status: str = "completed",
        metadata: Optional[dict] = None,
        message_id: Optional[Union[UUID, str]] = None,
    ) -> str:
        """
        Creates and persists a message record.
        Returns the message ID (UUID string).
        """
        key = str(conversation_id)
        msg_id = str(message_id or uuid.uuid4())
        clean_meta = self._sanitize_metadata(metadata)

        msg_obj = {
            "id": msg_id,
            "role": role,
            "content": content,
            "sources": sources or [],
            "status": status,
            "metadata": clean_meta,
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
                            status,
                            metadata,
                            created_at
                        )
                        VALUES (
                            CAST(:msg_id AS uuid),
                            CAST(:conv_id AS uuid),
                            :role,
                            :content,
                            CAST(:sources AS jsonb),
                            :status,
                            CAST(:metadata AS jsonb),
                            NOW()
                        )
                    """),
                    {
                        "msg_id": msg_id,
                        "conv_id": key,
                        "role": role,
                        "content": content,
                        "sources": json.dumps(sources or []),
                        "status": status,
                        "metadata": json.dumps(clean_meta),
                    },
                )
                await db.commit()
                logger.info(
                    f"Persisted '{role}' message (status={status}) to conversation {key} in PostgreSQL",
                    extra={"conversation_id": key, "message_id": msg_id, "status": status},
                )
            except Exception as e:
                logger.error(f"Failed to persist message to PostgreSQL for conversation {key}: {e}")
                await db.rollback()

        return msg_id

    async def update_message(
        self,
        db: Optional[AsyncSession],
        conversation_id: Union[UUID, str],
        message_id: Union[UUID, str],
        content: Optional[str] = None,
        sources: Optional[list] = None,
        status: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Updates an existing message record's status, content, or metadata."""
        key = str(conversation_id)
        msg_id = str(message_id)
        clean_meta = self._sanitize_metadata(metadata) if metadata is not None else None

        # Update cache
        if key in self._cache:
            for item in self._cache[key]:
                if item.get("id") == msg_id:
                    if content is not None:
                        item["content"] = content
                    if sources is not None:
                        item["sources"] = sources
                    if status is not None:
                        item["status"] = status
                    if clean_meta is not None:
                        item["metadata"] = clean_meta
                    break

        if db is not None:
            try:
                updates = []
                params: dict = {"msg_id": msg_id}

                if content is not None:
                    updates.append("content = :content")
                    params["content"] = content
                if sources is not None:
                    updates.append("sources = CAST(:sources AS jsonb)")
                    params["sources"] = json.dumps(sources)
                if status is not None:
                    updates.append("status = :status")
                    params["status"] = status
                if clean_meta is not None:
                    updates.append("metadata = CAST(:metadata AS jsonb)")
                    params["metadata"] = json.dumps(clean_meta)

                if updates:
                    sql = f"UPDATE conversation_messages SET {', '.join(updates)} WHERE id = CAST(:msg_id AS uuid)"
                    await db.execute(text(sql), params)
                    await db.commit()
                    logger.info(f"Updated message {msg_id} status to {status}")
            except Exception as e:
                logger.error(f"Failed to update message {msg_id} in PostgreSQL: {e}")
                await db.rollback()

    async def get_history(
        self,
        db: Optional[AsyncSession],
        conversation_id: Optional[Union[UUID, str]],
        max_turns: Optional[int] = None,
        include_failed: bool = False,
    ) -> List[dict]:
        """
        Retrieves recent turns. Filters out failed generations by default
        to prevent feeding error outputs as context into future prompts.
        """
        if not conversation_id:
            return []

        key = str(conversation_id)
        limit = max_turns or self.max_history_per_conv

        # 1. Fetch from PostgreSQL if database session is provided
        if db is not None:
            try:
                result = await db.execute(
                    text("""
                        SELECT id, role, content, sources, status, metadata, created_at
                        FROM conversation_messages
                        WHERE conversation_id = CAST(:conv_id AS uuid)
                          AND (:include_failed = TRUE OR status IS NULL OR status != 'failed')
                        ORDER BY created_at ASC
                    """),
                    {"conv_id": key, "include_failed": include_failed},
                )
                rows = result.mappings().all()
                if rows:
                    messages = [
                        {
                            "id": str(row["id"]),
                            "role": row["role"],
                            "content": row["content"],
                            "sources": row["sources"],
                            "status": row.get("status", "completed"),
                            "metadata": row.get("metadata", {}),
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
        cached = self._cache.get(key, [])
        if not include_failed:
            cached = [m for m in cached if m.get("status") != "failed"]
        return cached[-limit:]

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
