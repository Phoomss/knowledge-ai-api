from dataclasses import dataclass
from typing import Optional, List, Dict


@dataclass
class TextChunk:
    content: str
    chunk_index: int
    metadata: dict


class TextChunker:
    def __init__(
        self,
        chunk_size: int = 1200,
        chunk_overlap: int = 200,
    ):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")

        if chunk_overlap < 0 or chunk_overlap >= chunk_size:
            raise ValueError("Invalid chunk_overlap")

        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split(
        self,
        text: str,
        base_metadata: Optional[Dict] = None,
    ) -> List[TextChunk]:
        text = text.strip()
        if not text:
            return []

        chunks: List[TextChunk] = []
        start = 0
        index = 0

        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            content = text[start:end].strip()

            if content:
                meta = dict(base_metadata or {})
                meta["start"] = start
                meta["end"] = end

                chunks.append(
                    TextChunk(
                        content=content,
                        chunk_index=index,
                        metadata=meta,
                    )
                )
                index += 1

            if end >= len(text):
                break

            start = end - self.chunk_overlap

        return chunks

    def split_pages(
        self,
        pages: List[Dict],
    ) -> List[TextChunk]:
        """
        Splits page-by-page text, preserving the source page number in metadata.
        pages: list of {"page_number": int, "text": str}
        """
        all_chunks: List[TextChunk] = []
        global_index = 0

        for page_data in pages:
            page_num = page_data.get("page_number", 1)
            page_text = page_data.get("text", "")
            page_chunks = self.split(
                page_text,
                base_metadata={"page": page_num},
            )

            for chunk in page_chunks:
                chunk.chunk_index = global_index
                all_chunks.append(chunk)
                global_index += 1

        return all_chunks
