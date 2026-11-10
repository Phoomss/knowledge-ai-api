import collections
from typing import List
from FlagEmbedding import BGEM3FlagModel
from starlette.concurrency import run_in_threadpool


class EmbeddingService:
    def __init__(
        self,
        model_name: str,
        cache_size: int = 2048,
    ):
        self.model = BGEM3FlagModel(
            model_name,
            use_fp16=False,
        )
        self._query_cache: collections.OrderedDict = collections.OrderedDict()
        self.cache_size = cache_size

    def _encode(self, texts: List[str], max_length: int = 8192) -> List[List[float]]:
        result = self.model.encode(
            texts,
            batch_size=8,
            max_length=max_length,
        )
        vectors = result["dense_vecs"]
        return vectors.tolist()

    async def embed_documents(
        self,
        texts: List[str],
    ) -> List[List[float]]:
        return await run_in_threadpool(
            self._encode,
            texts,
            8192,
        )

    async def embed_query(
        self,
        question: str,
    ) -> List[float]:
        clean_q = question.strip()
        if clean_q in self._query_cache:
            self._query_cache.move_to_end(clean_q)
            return self._query_cache[clean_q]

        vectors = await run_in_threadpool(
            self._encode,
            [clean_q],
            512,
        )
        vector = vectors[0]

        self._query_cache[clean_q] = vector
        if len(self._query_cache) > self.cache_size:
            self._query_cache.popitem(last=False)

        return vector

