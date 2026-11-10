import io
import pytest
from pypdf import PdfWriter
from app.ingestion.pdf_extractor import PdfExtractor
from app.ingestion.chunker import TextChunker


def create_sample_pdf(page_texts: list[str]) -> bytes:
    """Creates a simple PDF in-memory for testing."""
    writer = PdfWriter()
    for text in page_texts:
        # Create a blank page and add annotations or simple text
        writer.add_blank_page(width=200, height=200)
    
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


def test_chunker_split_pages():
    chunker = TextChunker(chunk_size=50, chunk_overlap=10)
    pages = [
        {"page_number": 1, "text": "Page one has some important introductory information."},
        {"page_number": 2, "text": "Page two describes the system architecture and database."},
    ]

    chunks = chunker.split_pages(pages)
    assert len(chunks) >= 2
    assert chunks[0].metadata["page"] == 1
    assert any(c.metadata["page"] == 2 for c in chunks)


def test_pdf_extractor_empty_bytes():
    with pytest.raises(ValueError, match="empty"):
        PdfExtractor.extract_text_and_pages(b"")


def test_pdf_extractor_invalid_bytes():
    with pytest.raises(ValueError, match="Corrupted or unreadable"):
        PdfExtractor.extract_text_and_pages(b"Not a real PDF file content")
