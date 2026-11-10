from dataclasses import dataclass

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
    ) -> list[TextChunk]:

        text = text.strip()

        if not text:
            return []

        chunks = []

        start = 0
        index = 0

        while start < len(text):
            end = min(
                start + self.chunk_size,
                len(text),
            )

            content = text[start:end].strip()

            if content:
                chunks.append(
                    TextChunk(
                        content=content,
                        chunk_index=index,
                        metadata={
                            "start": start,
                            "end": end,
                        },
                    )
                )

                index += 1

            if end >= len(text):
                break

            start = end - self.chunk_overlap

        return chunks
