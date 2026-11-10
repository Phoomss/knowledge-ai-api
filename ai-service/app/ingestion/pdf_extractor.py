import io
import logging
from typing import Dict, List, Tuple
from pypdf import PdfReader

logger = logging.getLogger("rag.pdf")


class PdfExtractor:
    @staticmethod
    def extract_text_and_pages(pdf_bytes: bytes) -> Tuple[str, List[Dict]]:
        """
        Extracts full text and per-page content from raw PDF bytes.
        Returns:
            full_text: concatenated string of all pages
            pages: list of {"page_number": int, "text": str}
        """
        if not pdf_bytes:
            raise ValueError("PDF file is empty (0 bytes)")

        try:
            stream = io.BytesIO(pdf_bytes)
            reader = PdfReader(stream)

            if reader.is_encrypted:
                try:
                    # Attempt empty password decryption
                    reader.decrypt("")
                except Exception:
                    raise ValueError("PDF is encrypted or password-protected")

            total_pages = len(reader.pages)
            if total_pages == 0:
                raise ValueError("PDF has 0 pages")

            pages: List[Dict] = []
            full_text_parts: List[str] = []

            for page_index, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                page_text = page_text.strip()
                if page_text:
                    pages.append({
                        "page_number": page_index + 1,
                        "text": page_text,
                    })
                    full_text_parts.append(page_text)

            if not full_text_parts:
                raise ValueError(
                    "No extractable text found in PDF. The document might be a scanned image without OCR."
                )

            full_text = "\n\n".join(full_text_parts)
            logger.info(
                f"Successfully extracted text from {len(pages)}/{total_pages} pages ({len(full_text)} characters)"
            )
            return full_text, pages

        except ValueError:
            raise
        except Exception as error:
            logger.error(f"Unexpected error while extracting PDF: {error}", exc_info=True)
            raise ValueError(f"Corrupted or unreadable PDF: {str(error)}") from error
