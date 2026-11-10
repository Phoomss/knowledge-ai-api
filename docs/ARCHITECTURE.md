# 🏛️ KnowledgeAI System Architecture Deep Dive

เอกสารฉบับนี้อธิบายโครงสร้างสถาปัตยกรรมภายใน การออกแบบฐานข้อมูล และการทำงานร่วมกันระหว่าง Microservices ของระบบ **KnowledgeAI Enterprise**

---

## 🏗️ โครงสร้างระดับภาพรวม (High-Level Architecture)

ระบบออกแบบตามหลักการ **Decoupled Microservices Architecture** เพื่อแยกส่วนงานที่มีลักษณะต่างกันอย่างชัดเจน:
- **I/O-bound Service (NestJS)**: รับ-ส่งข้อมูล, จัดการสิทธิ์การเข้าถึง, ตรวจสอบความถูกต้อง (Validation), และบริหารจัดการคิว
- **CPU/GPU-bound Service (FastAPI + PyTorch)**: คำนวณเวกเตอร์คณิตศาสตร์ (Embeddings), ตัดคำ (Tokenization), และจัดลำดับความเกี่ยวข้อง (Cross-Encoder Reranking)
- **High-Performance Storage (PostgreSQL 17 + pgvector)**: ค้นหาความคล้ายคลึงของเวกเตอร์ (Cosine Distance) ควบคู่กับ Full-Text Indexing
- **Message Broker (Redis 7)**: จัดการคิวย่อยเอกสาร (BullMQ) เพื่อให้ Server รองรับการอัปโหลดพร้อมกันได้สูงโดยไม่เกิด CPU Spike

```mermaid
graph LR
    Client["Client Browser<br/>(React UI)"]
    API["API Gateway<br/>(NestJS / Bun)"]
    Queue["BullMQ Queue<br/>(Redis 7)"]
    AIService["AI Engine<br/>(FastAPI / PyTorch)"]
    DB[("PostgreSQL 17<br/>pgvector + GIN")]

    Client -->|REST & SSE Stream| API
    API -->|Async Job| Queue
    Queue -->|Process PDF / Text| AIService
    API -->|Synchronous RAG Request| AIService
    AIService -->|Hybrid Search & Memory| DB
    API -->|CRUD & Auth| DB
```

---

## 🗄️ โครงสร้างฐานข้อมูล (Entity-Relationship Diagram)

```mermaid
erDiagram
    users ||--o{ knowledge_bases : "owns"
    users ||--o{ conversations : "participates"
    knowledge_bases ||--o{ documents : "contains"
    knowledge_bases ||--o{ conversations : "links"
    documents ||--o{ document_chunks : "chunked into"
    conversations ||--o{ conversation_messages : "contains"

    users {
        uuid id PK
        varchar email UK
        varchar password
        varchar name
        Role role
        timestamp created_at
        timestamp updated_at
    }

    knowledge_bases {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        timestamp created_at
        timestamp updated_at
    }

    documents {
        text id PK
        uuid knowledge_base_id FK
        text title
        varchar filename
        text content
        DocumentStatus status
        timestamp created_at
        timestamp updated_at
    }

    document_chunks {
        uuid id PK
        text document_id FK
        text content
        vector embedding "vector(1024)"
        int chunk_index
        jsonb metadata
        timestamp created_at
    }

    conversations {
        uuid id PK
        uuid user_id FK
        uuid knowledge_base_id FK
        varchar title
        timestamp created_at
        timestamp updated_at
    }

    conversation_messages {
        uuid id PK
        uuid conversation_id FK
        varchar role
        text content
        jsonb sources
        timestamp created_at
    }
```

### การตั้งค่า Index สำคัญบน PostgreSQL
1. **`document_chunks.embedding`**:
   - ชนิด: `HNSW (vector_cosine_ops)`
   - จุดประสงค์: ค้นหา Approximate Nearest Neighbors (ANN) ด้วยความเร็วสูงระดับ sub-millisecond
2. **`document_chunks.content`**:
   - ชนิด: `GIN (to_tsvector('simple', content))`
   - จุดประสงค์: ค้นหาคำแบบ Full-Text Search (BM25) รองรับตัวเลข, รหัสเฉพาะ, และภาษาไทย
3. **`documents(knowledge_base_id, status)`**:
   - ชนิด: `Composite B-Tree`
   - จุดประสงค์: ป้องกัน Sequential Scan ในคำสั่ง JOIN ระหว่างค้นหาเวกเตอร์
4. **`conversation_messages(conversation_id, created_at)`**:
   - ชนิด: `Composite B-Tree`
   - จุดประสงค์: ดึงประวัติบทสนทนาย้อนหลังตามลำดับเวลาได้อย่างรวดเร็ว

---

## 🔍 กระบวนการ Hybrid Search & RRF Pipeline

เมื่อมีคำถามเข้ามาในระบบ ขั้นตอนการสืบค้นจะดำเนินไปตามแผนภาพดังนี้:

```mermaid
flowchart TD
    Q["❓ คำถามจากผู้ใช้ (Question)"]
    QSanitize["🧹 Sanitization & Prompt Injection Check"]
    QCache{"⚡ ตรวจสอบ LRU Cache?"}
    ComputeVec["🧬 คำนวณเวกเตอร์ BGE-M3 (512 tokens)"]
    VectorSearch["📐 Vector Search (HNSW Cosine)<br/>Top-15 Candidates"]
    BM25Search["🔤 Full-Text BM25 Search (GIN)<br/>Top-15 Candidates"]
    RRF["🔀 Reciprocal Rank Fusion (RRF)<br/>RRF Score = 1/(60+r_v) + 1/(60+r_t)"]
    Rerank["🎯 Cross-Encoder Reranker<br/>(BAAI/bge-reranker-base)"]
    ContextBuild["📄 Context Window Limiter (6,000 tokens)"]
    LLM["🤖 Google Gemini 2.5 Flash Generation"]

    Q --> QSanitize
    QSanitize --> QCache
    QCache -- Hit --> VectorSearch
    QCache -- Miss --> ComputeVec --> VectorSearch
    QSanitize --> BM25Search

    VectorSearch --> RRF
    BM25Search --> RRF
    RRF --> Rerank
    Rerank --> ContextBuild
    ContextBuild --> LLM
```

---

## 📬 วงจรการทำงานของ Background Ingestion (BullMQ + Redis)

```mermaid
sequenceDiagram
    autonumber
    actor User as ผู้ใช้งาน (Browser)
    participant UI as React Frontend
    participant API as NestJS Gateway
    participant Redis as Redis 7 (BullMQ)
    participant Worker as Ingestion Processor
    participant AI as FastAPI Engine
    participant DB as PostgreSQL

    User->>UI: อัปโหลด PDF (employee_handbook.pdf)
    UI->>API: POST /api/v1/documents/upload (Multipart)
    API->>DB: บันทึก Document (status: PROCESSING)
    API->>Redis: Enqueue Job เข้าคิว document-ingestion
    API-->>UI: ส่งกลับ HTTP 201 (Processing started)

    Note over Redis,Worker: ประมวลผลแบบ Asynchronous ในพื้นหลัง
    Worker->>Redis: ดึงงานจากคิว (Pop Job)
    Worker->>AI: ยิงเรียก POST /api/v1/documents/upload-pdf
    AI->>AI: แยกหน้า PDF (PdfExtractor) + ตัดเป็น Chunks (500 tokens)
    AI->>AI: คำนวณ Embeddings ผ่าน BGE-M3
    AI->>DB: บันทึก Chunks เป็น Single Batch (executemany)
    AI-->>Worker: แจ้งผล Ingestion Completed
    Worker->>DB: อัปเดตสถานะ Document เป็น COMPLETED

    UI->>API: Polling หรือ Refresh ดูสถานะ
    API-->>UI: สถานะเป็น COMPLETED (พร้อมใช้งานใน Chat)
```

---

## ⏱️ การวัดผลและ Observability

ในทุกคำตอบที่ AI ส่งกลับมา ระบบจะแนบข้อมูล Metadata การใช้ทรัพยากรและเวลาในการประมวลผล เพื่อให้สามารถติดตามและปรับแต่งประสิทธิภาพได้:

```json
{
  "timings": {
    "retrieval_ms": 2.66,
    "reranking_ms": 400.74,
    "generation_ms": 140.65,
    "total_ms": 555.70
  },
  "estimated_prompt_tokens": 278,
  "estimated_answer_tokens": 154,
  "retrieval_count": 2,
  "used_context_count": 2
}
```
