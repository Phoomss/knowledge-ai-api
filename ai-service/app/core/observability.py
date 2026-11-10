import time
import logging
from typing import Optional, Any
from contextlib import asynccontextmanager

# Configure structured logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("rag.runtime")


class LatencyTracker:
    def __init__(self):
        self.timings: dict[str, float] = {}
        self._start_time: float = time.perf_counter()

    def record(self, stage: str, duration_ms: float):
        self.timings[stage] = round(duration_ms, 2)

    @property
    def total_ms(self) -> float:
        return round((time.perf_counter() - self._start_time) * 1000, 2)

    def summary(self) -> dict[str, float]:
        summary = dict(self.timings)
        summary["total_ms"] = self.total_ms
        return summary


@asynccontextmanager
async def trace_stage(tracker: LatencyTracker, stage_name: str):
    """Context manager to measure and log execution duration of a stage."""
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        tracker.record(f"{stage_name}_ms", elapsed_ms)
        logger.info(f"Stage '{stage_name}' completed in {elapsed_ms:.2f}ms")


def estimate_token_count(text: str) -> int:
    """Estimates token count (~3.5-4 characters per token for mixed languages)."""
    if not text:
        return 0
    # Average ~3.5 chars per token for English & multilingual text
    return max(1, int(len(text) / 3.5))
