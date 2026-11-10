import logging
from typing import Optional
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger("rag.reranker")


class Reranker:
    def __init__(self, model_name: str = "BAAI/bge-reranker-base"):
        self.model_name = model_name
        self._reranker = None
        self._load_failed = False

    def _get_model(self):
        """Lazy loads the FlagReranker model."""
        if self._reranker is None and not self._load_failed:
            try:
                from FlagEmbedding import FlagReranker
                logger.info(f"Loading Reranker model: {self.model_name}")
                self._reranker = FlagReranker(self.model_name, use_fp16=False)
                logger.info("Reranker model loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load FlagReranker ({e}). Using semantic fallback scoring.")
                self._load_failed = True
        return self._reranker

    async def rerank(
        self,
        query: str,
        documents: list[dict],
        top_n: Optional[int] = None,
    ) -> list[dict]:
        """
        Reranks a list of candidate documents against the query.
        Each document is updated with 'rerank_score'.
        """
        if not documents:
            return []

        model = self._get_model()
        if model is not None:
            try:
                pairs = [[query, doc["content"]] for doc in documents]
                scores = await run_in_threadpool(model.compute_score, pairs)
                
                # FlagReranker returns a list of floats or a single float
                if isinstance(scores, (int, float)):
                    scores = [scores]

                for doc, score in zip(documents, scores):
                    doc["rerank_score"] = float(score)
                    # Normalize / blend score for final ranking
                    doc["score"] = float(score)

                # Sort descending by rerank score
                reranked = sorted(documents, key=lambda x: x["score"], reverse=True)
                return reranked[:top_n] if top_n else reranked
            except Exception as e:
                logger.error(f"Error during reranking: {e}. Falling back to original retrieval order.")

        # Fallback: keep original vector search scores
        return documents[:top_n] if top_n else documents
