from FlagEmbedding import BGEM3FlagModel
from starlette.concurrency import run_in_threadpool


class EmbeddingService:
    def __init__(
        self,
        model_name: str,
    ):
        self.model = BGEM3FlagModel(
            model_name,
            use_fp16=False,
        )

    def _encode(self, texts: list[str]) -> list[list[float]]:

        result = self.model.encode(
            texts,
            batch_size=8,
            max_length=8192,
        )

        vectors = result["dense_vecs"]

        return vectors.tolist()

    async def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        return await run_in_threadpool(
            self._encode,
            texts,
        )

    async def embed_query(
        self,
        question: str,
    ) -> list[float]:

        vectors = await self.embed_documents([question])

        return vectors[0]
