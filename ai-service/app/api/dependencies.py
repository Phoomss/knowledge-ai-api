from app.orchestration.rag_runtime import RagRuntime
from fastapi import Request

def get_rag_runtime(
    request: Request,
) -> RagRuntime:

    return request.app.state.rag_runtime
