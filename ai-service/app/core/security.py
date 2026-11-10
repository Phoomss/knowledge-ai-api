import re
import logging
from typing import Optional
from fastapi import Header, HTTPException, status
from app.core.config import get_settings

logger = logging.getLogger("rag.security")

# Common prompt injection signatures and jailbreak phrases
INJECTION_PATTERNS = [
    r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)",
    r"(?i)\bdisregard\s+(all\s+)?(previous|prior|above)",
    r"(?i)\byou\s+are\s+now\s+(in\s+)?(developer\s+mode|dan|jailbreak)",
    r"(?i)\bsystem\s+prompt\s*:",
    r"(?i)\boutput\s+the\s+system\s+prompt",
    r"(?i)<\|im_start\|>",
    r"(?i)<\|system\|>",
    r"(?i)\[system\]",
    r"(?i)\breveal\s+(your\s+)?(instructions|secret|api\s*key)",
]

COMPILED_PATTERNS = [re.compile(p) for p in INJECTION_PATTERNS]


class SecurityGuard:
    @staticmethod
    def sanitize_input(text: str) -> str:
        """Sanitizes text by removing non-printable/zero-width characters."""
        if not text:
            return ""
        # Remove zero-width spaces and control characters except common whitespace
        sanitized = re.sub(r"[\u200B-\u200D\uFEFF]", "", text)
        sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)
        return sanitized.strip()

    @staticmethod
    def detect_prompt_injection(text: str) -> tuple[bool, Optional[str]]:
        """
        Scans input for prompt injection patterns.
        Returns (is_injected, matched_pattern).
        """
        for pattern in COMPILED_PATTERNS:
            match = pattern.search(text)
            if match:
                logger.warning(f"Potential prompt injection detected: {match.group(0)}")
                return True, match.group(0)
        return False, None


async def verify_api_key(
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key")
) -> bool:
    """Validates the API key if configured in settings."""
    settings = get_settings()
    configured_key = getattr(settings, "api_key", None)
    
    # If no API key configured on server, permit access
    if not configured_key:
        return True
        
    if not x_api_key or x_api_key != configured_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )
    return True
