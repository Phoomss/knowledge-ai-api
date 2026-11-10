from app.ingestion.pipeline import IngestionPipeline
from fastapi import Request

def get_ingestion_pipeline(
    request: Request,
) -> IngestionPipeline:

    return request.app.state.ingestion_pipeline
