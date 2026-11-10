from contextlib import asynccontextmanager

from app.api.v1 import documents, rag
from app.core.config import get_settings
from app.database.session import engine
from app.embeddings.embedding_service import EmbeddingService
from app.evaluation.rag_evaluator import RagEvaluator
from app.generation.llm_provider import GeminiProvider
from app.generation.prompt_builder import PromptBuilder
from app.ingestion.chunker import TextChunker
from app.ingestion.pipeline import IngestionPipeline
from app.memory.conversation_store import memory_store
from app.orchestration.rag_runtime import RagRuntime
from app.retrieval.reranker import Reranker
from app.retrieval.retriever import Retriever
from app.retrieval.vector_store import VectorStore
from fastapi import FastAPI

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Embedding
    embedding_service = EmbeddingService(
        model_name=settings.embedding_model,
    )

    # 2. Initialize Text Chunker & Ingestion Pipeline
    app.state.ingestion_pipeline = IngestionPipeline(
        embedding_service=embedding_service,
        chunker=TextChunker(
            chunk_size=1200,
            chunk_overlap=200,
        ),
    )

    # 3. Initialize Vector Store & Retriever
    vector_store = VectorStore()
    retriever = Retriever(
        embedding_service=embedding_service,
        vector_store=vector_store,
    )

    # 4. Initialize Prompt Builder with Context Limit
    prompt_builder = PromptBuilder(
        max_context_tokens=settings.rag_max_context_tokens,
    )

    # 5. Initialize LLM Provider with Timeout & Retry
    llm_provider = GeminiProvider(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        timeout=settings.llm_timeout,
        max_retries=settings.llm_max_retries,
        base_delay=settings.llm_base_delay,
        max_delay=settings.llm_max_delay,
        jitter=settings.llm_jitter,
        fallback_model=settings.llm_fallback_model,
    )

    # 6. Initialize Reranker & Evaluator
    reranker = Reranker()
    evaluator = RagEvaluator(llm_provider=llm_provider)

    # 7. Initialize RAG Runtime with Memory, Observability, and Reranking
    app.state.rag_runtime = RagRuntime(
        retriever=retriever,
        prompt_builder=prompt_builder,
        llm_provider=llm_provider,
        reranker=reranker,
        memory=memory_store,
        evaluator=evaluator,
        score_threshold=settings.rag_score_threshold,
    )
    app.state.rag_evaluator = evaluator

    yield

    # Graceful Shutdown
    await llm_provider.close()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(rag.router)
app.include_router(documents.router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "ai-engine",
        "version": settings.app_version,
    }
