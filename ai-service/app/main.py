from contextlib import asynccontextmanager

from app.api.v1 import rag
from app.core.config import get_settings
from app.database.session import engine
from app.embeddings.embedding_service import EmbeddingService
from app.generation.llm_provider import GeminiProvider
from app.generation.prompt_builder import PromptBuilder
from app.orchestration.rag_runtime import RagRuntime
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

    # 2. Initialize Vector Store
    vector_store = VectorStore()

    # 3. Initialize Retriever
    retriever = Retriever(
        embedding_service=embedding_service,
        vector_store=vector_store,
    )

    # 4. Initialize Prompt Builder
    prompt_builder = PromptBuilder()

    # 5. Initialize LLM
    llm_provider = GeminiProvider(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )

    # 6. Initialize RAG Runtime
    app.state.rag_runtime = RagRuntime(
        retriever=retriever,
        prompt_builder=prompt_builder,
        llm_provider=llm_provider,
        score_threshold=settings.rag_score_threshold,
    )

    yield

    # Shutdown
    await llm_provider.close()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(rag.router)


@app.get("/health")
async def health():

    return {
        "status": "healthy",
        "service": "ai-engine",
    }