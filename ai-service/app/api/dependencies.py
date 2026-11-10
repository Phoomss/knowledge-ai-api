from fastapi import Request
from app.orchestration.rag_runtime import RagRuntime
from app.ingestion.pipeline import IngestionPipeline
from app.evaluation.rag_evaluator import RagEvaluator


def get_rag_runtime(request: Request) -> RagRuntime:
    return request.app.state.rag_runtime


def get_ingestion_pipeline(request: Request) -> IngestionPipeline:
    return request.app.state.ingestion_pipeline


def get_evaluator(request: Request) -> RagEvaluator:
    return request.app.state.rag_evaluator
