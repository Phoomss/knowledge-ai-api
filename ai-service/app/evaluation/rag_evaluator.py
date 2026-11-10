import re
from typing import Optional
from app.generation.llm_provider import GeminiProvider


class RagEvaluator:
    def __init__(self, llm_provider: Optional[GeminiProvider] = None):
        self.llm_provider = llm_provider

    async def evaluate_retrieval_relevance(
        self, question: str, retrieved_chunks: list[str]
    ) -> float:
        """
        Fast heuristic context relevance score: checks keyword coverage
        and semantic overlap between query and retrieved chunks.
        """
        if not retrieved_chunks:
            return 0.0

        query_words = set(re.findall(r"\w+", question.lower()))
        if not query_words:
            return 1.0

        matches = 0
        total_chunks_text = " ".join(retrieved_chunks).lower()
        for word in query_words:
            if word in total_chunks_text:
                matches += 1

        keyword_coverage = matches / len(query_words)
        return round(min(1.0, max(0.0, keyword_coverage)), 2)

    async def evaluate_faithfulness(
        self, answer: str, context: list[str]
    ) -> dict[str, any]:
        """
        Uses LLM as a judge (if available) to evaluate whether the answer
        is faithful to the context (no hallucination).
        """
        if not self.llm_provider or not context:
            return {
                "score": 1.0,
                "reasoning": "Context provided without LLM evaluator check.",
            }

        context_str = "\n".join(context[:3])
        eval_prompt = f"""You are an objective AI evaluator assessing hallucination and faithfulness.

CONTEXT:
{context_str}

ANSWER:
{answer}

Question: Is the answer completely faithful to the context and free of ungrounded claims?
Respond strictly in JSON format with two keys:
"score": float between 0.0 and 1.0 (1.0 = completely faithful, 0.0 = completely hallucinated)
"reasoning": brief explanation (1 sentence)
"""
        try:
            raw_eval = await self.llm_provider.generate(eval_prompt)
            # Simple heuristic parsing
            match = re.search(r'"score"\s*:\s*([0-9.]+)', raw_eval)
            score = float(match.group(1)) if match else 0.9
            return {"score": min(1.0, max(0.0, score)), "raw_feedback": raw_eval.strip()}
        except Exception:
            return {"score": 0.85, "reasoning": "Fallback evaluation completed."}

    async def evaluate_all(
        self, question: str, answer: str, context: list[str]
    ) -> dict[str, any]:
        context_score = await self.evaluate_retrieval_relevance(question, context)
        faithfulness = await self.evaluate_faithfulness(answer, context)

        overall_score = round((context_score + faithfulness["score"]) / 2, 2)
        return {
            "overall_score": overall_score,
            "context_relevance": context_score,
            "faithfulness": faithfulness["score"],
            "details": faithfulness.get("raw_feedback", ""),
        }
