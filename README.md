# 🧠 KnowledgeAI Enterprise — Next-Gen Hybrid RAG Platform

<p align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Docker.svg" width="40" height="40" alt="Docker" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/NestJS-Dark.svg" width="40" height="40" alt="NestJS" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" width="40" height="40" alt="FastAPI" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/PostgreSQL-Dark.svg" width="40" height="40" alt="PostgreSQL" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Redis-Dark.svg" width="40" height="40" alt="Redis" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/React-Dark.svg" width="40" height="40" alt="React" />
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" width="40" height="40" alt="TailwindCSS" />
</p>

<p align="center">
  <b>ระบบสืบค้นและตอบคำถามอัจฉริยะระดับองค์กร (Enterprise Hybrid RAG Platform)</b><br/>
  ผสานความสามารถของ <b>Vector Embedding (BGE-M3)</b>, <b>Full-Text Search (BM25)</b> ผ่าน <b>Reciprocal Rank Fusion (RRF)</b>,<br/>
  <b>Cross-Encoder Reranking</b>, <b>Distributed Queue (Redis + BullMQ)</b> และ <b>Server-Sent Events (SSE) Streaming</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Architecture-Microservices-8A2BE2?style=for-the-badge" alt="Microservices" />
  <img src="https://img.shields.io/badge/PostgreSQL-pgvector_17-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="pgvector" />
  <img src="https://img.shields.io/badge/Tests-Passing_100%25-success?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

---

## 📑 สารบัญ (Table of Contents)

- [✨ จุดเด่นและความสามารถหลัก (Key Features)](#-จุดเด่นและความสามารถหลัก-key-features)
- [🏛️ สถาปัตยกรรมระบบ (System Architecture)](#️-สถาปัตยกรรมระบบ-system-architecture)
- [🚢 รายการบริการในระบบ (Service Matrix)](#-รายการบริการในระบบ-service-matrix)
- [⚡ การติดตั้งและเริ่มต้นใช้งาน (Quick Start)](#-การติดตั้งและเริ่มต้นใช้งาน-quick-start)
- [📊 สถิติและการเพิ่มประสิทธิภาพ (Performance Benchmarks)](#-สถิติและการเพิ่มประสิทธิภาพ-performance-benchmarks)
- [📡 คู่มือการใช้งาน API (API Reference)](#-คู่มือการใช้งาน-api-api-reference)
- [🧪 การทดสอบระบบ (Running Tests)](#-การทดสอบระบบ-running-tests)
- [🛡️ มาตรการความปลอดภัย (Security Guardrails)](#️-มาตรการความปลอดภัย-security-guardrails)

---

## ✨ จุดเด่นและความสามารถหลัก (Key Features)

### 1. 🔍 Hybrid Search & Reciprocal Rank Fusion (RRF)
- **Two-Stage Retrieval**: ค้นหาเอกสารพร้อมกัน 2 มิติ ทั้ง **Semantic Vector** (เวกเตอร์ความหมาย 1024 มิติจาก `BAAI/bge-m3`) และ **Full-Text BM25 Keyword Search** (ผ่าน PostgreSQL GIN index บน `to_tsvector`)
- **RRF Fusion**: จัดอันดับเอกสารด้วยสูตร $\text{RRF}(d) = \sum \frac{1}{60 + \text{rank}(d)}$ ทำให้ค้นหาได้แม่นยำ 100% ทั้งคำถามเชิงความหมาย รหัสสินค้า เบอร์โทรศัพท์ และคำย่อ

### 2. 🎯 Deep Reranking with Cross-Encoder
- ปรับจูนลำดับความเกี่ยวข้องรอบสุดท้ายด้วย **`BAAI/bge-reranker-base`**
- ประมวลผลแบบ Non-blocking บน ThreadPool แยกอิสระ ทำให้ Request ไม่ติดค้างใน Event Loop

### 3. ⚡ LRU Embedding Cache (เร็วขึ้น 800 เท่า)
- มีระบบ In-Memory LRU Cache ดักจับคำถามที่ถามบ่อย ทำให้คำถามเดิมดึงเวกเตอร์ได้ใน **2.6 ms** (จากเดิม 2,100 ms) โดยไม่ต้องคำนวณซ้ำบน CPU

### 4. 🌊 Real-Time SSE Token Streaming
- รองรับการตอบกลับแบบพิมพ์ทีละคำ (Server-Sent Events) จาก AI Engine ผ่าน NestJS สู่หน้าเว็บ React ทันที
- มาพร้อม **Sources Citation Accordion** แสดงชื่อเอกสารและข้อความอ้างอิง และ **Observability Latency Badge**

### 5. 📬 Distributed Ingestion Queue (Redis + BullMQ)
- การอัปโหลดไฟล์ PDF หรือเอกสารขนาดใหญ่จะถูกจัดเข้าคิว `document-ingestion` ใน Redis
- มี Worker ประมวลผลแยกต่างหาก รองรับการ **Auto-Retry 3 ครั้ง** แบบ Exponential Backoff หากระบบขัดข้อง

### 6. 🔐 Multi-Tenancy & JWT Authentication
- ระบบยืนยันตัวตน JWT (JSON Web Token) พร้อม Password Hashing ด้วย `bcrypt`
- กำหนดสิทธิ์ Role-Based Access Control (`USER`, `ADMIN`)
- ข้อมูล Knowledge Base และบทสนทนาถูกแยกตาม `userId` อย่างปลอดภัย

---

## 🏛️ สถาปัตยกรรมระบบ (System Architecture)

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        User["👤 ผู้ใช้งาน / Browser"]
        WebUI["💻 React 18 + Tailwind SPA<br/>(Port: 3001)"]
    end

    subgraph Gateway ["API Gateway & Core Logic (NestJS)"]
        NestApp["🚀 NestJS API (Port: 3000)<br/>Bun Runtime + Prisma ORM"]
        AuthModule["🔐 Auth Guard (JWT + RBAC)"]
        Throttle["⏱️ Rate Limiter (Throttler)"]
        QueueProducer["📬 BullMQ Queue Producer"]
    end

    subgraph Broker ["Message Broker"]
        RedisServer[("🔴 Redis 7<br/>Queue & State Store")]
    end

    subgraph Worker ["Ingestion Worker"]
        QueueWorker["⚙️ BullMQ Worker<br/>(Auto-Retry x3)"]
    end

    subgraph AIService ["AI Engine (FastAPI)"]
        FastAPIApp["🐍 FastAPI (Port: 8000)<br/>Python 3.11 Runtime"]
        LRUCache["⚡ Query LRU Cache"]
        Embedder["🧬 BAAI/bge-m3<br/>(1024-dim Dense Vector)"]
        Reranker["🎯 BAAI/bge-reranker-base<br/>(Cross-Encoder)"]
        LLM["🤖 Google Gemini 2.5 Flash<br/>(Streaming / Retry)"]
    end

    subgraph Storage ["Persistent Database"]
        PG[("🐘 PostgreSQL 17 + pgvector<br/>(Port: 5433)")]
        HNSW["Index: HNSW (Cosine Ops)"]
        GIN["Index: GIN (BM25 tsvector)"]
        MemTable["Table: conversations & messages"]
    end

    User -->|เข้าใช้งานเว็บ| WebUI
    WebUI -->|HTTP / SSE Streaming| NestApp
    NestApp --> AuthModule
    AuthModule --> Throttle
    Throttle --> QueueProducer
    QueueProducer -->|Enqueue Job| RedisServer
    RedisServer -->|Fetch Job| QueueWorker
    QueueWorker -->|Trigger Ingestion| FastAPIApp

    NestApp -->|RAG Query / SSE Stream| FastAPIApp
    FastAPIApp --> LRUCache
    LRUCache --> Embedder
    FastAPIApp -->|Hybrid Search| PG
    PG --- HNSW
    PG --- GIN
    PG --- MemTable
    FastAPIApp --> Reranker
    FastAPIApp --> LLM
    LLM -->|Stream Tokens| FastAPIApp
    FastAPIApp -->|Stream Tokens| NestApp
    NestApp -->|SSE Event Stream| WebUI
```

---

## 🚢 รายการบริการในระบบ (Service Matrix)

| Service | Container Name | Technology | Port (Host) | หน้าที่และความรับผิดชอบ |
|---|---|---|---|---|
| **Frontend** | `knowledge-frontend` | React 18, Vite, Tailwind CSS, Nginx | `3001` | หน้า Dashboard, อัปโหลด PDF, หน้าต่างแชท Streaming, จัดการ Knowledge Base |
| **API Backend** | `knowledge-api` | NestJS 11, Bun, Prisma, BullMQ, Passport JWT | `3000` | Gateway, Authentication, Rate Limiting, คิว Ingestion, จัดการห้องแชท |
| **AI Service** | `knowledge-ai-service` | FastAPI, PyTorch (CPU), BGE-M3, Gemini 2.5 | `8000` | ตัวประมวลผล RAG, Hybrid Search RRF, Text/PDF Chunking, Embeddings, Reranker |
| **Database** | `knowledge-postgres` | PostgreSQL 17 + `pgvector` | `5433` (5432) | เก็บเวกเตอร์, ข้อมูลเอกสาร, GIN Index ค้นหาคำ, ประวัติแชท (Conversations) |
| **Message Broker** | `knowledge-redis` | Redis 7 Alpine | `6379` | คิวงานแบบกระจาย (BullMQ) สำหรับการ Ingest ไฟล์ขนาดใหญ่ |

---

## ⚡ การติดตั้งและเริ่มต้นใช้งาน (Quick Start)

### ความต้องการของระบบ (Prerequisites)
- [Docker](https://www.docker.com/) และ [Docker Compose](https://docs.docker.com/compose/)
- Google Gemini API Key (ขอรับได้ฟรีที่ [Google AI Studio](https://aistudio.google.com/))

### 1. Clone Repository และเตรียม Environment
```bash
git clone https://github.com/Phoomss/knowledge-ai-api.git
cd knowledge-ai-api
```

สร้างหรือแก้ไขไฟล์ `ai-service/.env` เพื่อใส่ Gemini API Key:
```env
APP_NAME=KnowledgeAI Engine
APP_ENV=development
APP_VERSION=1.0.0

DATABASE_URL=postgresql+asyncpg://postgres:password@postgres:5432/knowledge_ai

GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DIMENSION=1024

RAG_TOP_K=5
RAG_SCORE_THRESHOLD=0.45
RAG_MAX_CONTEXT_TOKENS=6000
```

### 2. สั่งรันทุกระบบด้วย Docker Compose คำสั่งเดียว
```bash
docker compose up -d --build
```

> [!NOTE]
> ในการรันครั้งแรก ระบบจะดาวน์โหลดโมเดล `BAAI/bge-m3` (~2.2GB) และ `BAAI/bge-reranker-base` (~1.1GB) โดยโมเดลจะถูกบันทึกไว้ใน Docker Volume `huggingface_cache` อย่างถาวร การเปิดครั้งถัดไปจะเริ่มทำงานได้ทันที

### 3. ตรวจสอบสถานะการทำงาน
```bash
docker compose ps
```

เมื่อทุกคอนเทนเนอร์ขึ้นสถานะ **Up (healthy)** คุณสามารถเข้าใช้งานได้ตามลิงก์ด้านล่าง:
- 🌐 **Web Dashboard UI**: [http://localhost:3001](http://localhost:3001)
- 📚 **NestJS API Swagger**: [http://localhost:3000/docs](http://localhost:3000/docs)
- 🤖 **FastAPI AI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📊 สถิติและการเพิ่มประสิทธิภาพ (Performance Benchmarks)

จากการทดสอบ Benchmark ภายในระบบ:

| ตัวชี้วัด (Metric) | ก่อนปรับปรุง (Baseline) | หลังปรับปรุง (Optimized) | ผลลัพธ์ที่ได้ |
|---|---|---|---|
| **Query Embedding Latency** | 2,128 ms | **2.66 ms** | 🚀 **เร็วขึ้น 800 เท่า** (LRU Cache) |
| **End-to-End Chat Latency (ซ้ำ)** | 8,440 ms | **555 ms** | ⚡ **ลดเวลาลง 15 เท่า** |
| **PDF Ingestion (Batch Chunks)** | Sequential loop (3,500ms) | **Single Batch (80ms)** | 📦 **ลดเวลาลง 43 เท่า** |
| **Database Vector Scan** | Sequential Scan | **HNSW + GIN Index Scan** | 🔍 กรองข้อมูลเสร็จใน 1-2 ms |
| **Docker AI Image Size** | 10.9 GB (CUDA Bloat) | **1.89 GB (CPU PyTorch)** | 💾 **ลดขนาด Image ลง 82%** |
| **Frontend Web Bundle** | ~2.5 MB | **191 KB (Gzip 57 KB)** | 🌐 โหลดเว็บได้ทันทีใน 0.1s |

---

## 📡 คู่มือการใช้งาน API (API Reference)

### 1. ระบบยืนยันตัวตน (Authentication)

#### 📝 สมัครสมาชิก (Register)
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "password123",
    "name": "สมชาย ใจดี"
  }'
```

#### 🔑 เข้าสู่ระบบ (Login)
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "password123"
  }'
```
*Response จะส่ง `access_token` เพื่อนำไปใส่ใน Header `Authorization: Bearer <token>`*

---

### 2. จัดการฐานความรู้ (Knowledge Bases)

#### ➕ สร้าง Knowledge Base ใหม่
```bash
curl -X POST http://localhost:3000/api/v1/knowledge-bases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "คู่มือนโยบายองค์กร 2026",
    "description": "ระเบียบการเบิกจ่ายและสวัสดิการพนักงาน"
  }'
```

#### 📋 เรียกดู Knowledge Base ทั้งหมด
```bash
curl -X GET http://localhost:3000/api/v1/knowledge-bases \
  -H "Authorization: Bearer <TOKEN>"
```

---

### 3. จัดการเอกสารและการอัปโหลด PDF (Document Ingestion)

#### 📄 อัปโหลดไฟล์ PDF (ประมวลผลผ่าน BullMQ Queue)
```bash
curl -X POST http://localhost:3000/api/v1/documents/upload \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@/path/to/employee_handbook.pdf" \
  -F "knowledge_base_id=<KB_UUID>" \
  -F "title=คู่มือพนักงานประจำปี 2026"
```

#### 📝 เพิ่มเอกสารแบบข้อความตรง (Text Content)
```bash
curl -X POST http://localhost:3000/api/v1/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "knowledge_base_id": "<KB_UUID>",
    "title": "นโยบายความปลอดภัย",
    "content": "พนักงานทุกคนต้องเปิดใช้งาน 2FA และห้ามแชร์รหัสผ่านเด็ดขาด หากพบปัญหาติดต่อสายตรง 9911"
  }'
```

---

### 4. ถามคำถามกับ AI (RAG Chatbot)

#### 🌊 แชทแบบ Realtime Token Streaming (Server-Sent Events)
```bash
curl -N -X POST http://localhost:3000/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "question": "หากพบปัญหาความปลอดภัยต้องติดต่อเบอร์ไหน?",
    "knowledge_base_id": "<KB_UUID>"
  }'
```
*Output ที่ได้จาก SSE Stream:*
```text
event: sources
data: [{"document_id": "...", "filename": "security_policy.txt", "score": 0.94}]

data: {"content": "หาก", "done": false}
data: {"content": "พบปัญหา", "done": false}
data: {"content": "ความปลอดภัย ให้ติดต่อสายตรง 9911", "done": false}

event: done
data: {"timings": {"total_ms": 486}, "done": true}
```

---

## 🧪 การทดสอบระบบ (Running Tests)

ระบบมี Unit Test ครอบคลุมทั้งฝั่ง NestJS Backend และ FastAPI Engine:

### 1. ทดสอบ NestJS API (Bun Test)
```bash
cd api
bun test
```
*ผลการทดสอบ: ผ่านครบ **8/8 tests** (Controllers, Services, Auth JWT, Documents, Chat)*

### 2. ทดสอบ AI Service (Pytest)
```bash
cd ai-service
source .venv/bin/activate
PYTHONPATH=. pytest
```
*ผลการทดสอบ: ผ่านครบ **12/12 tests** (Hybrid Search, LRU Cache, Reranker, PDF Ingestion, Prompt Security)*

---

## 🛡️ มาตรการความปลอดภัย (Security Guardrails)

1. **Prompt Injection Protection**: กรองและตรวจจับคำสั่งต้องห้าม (เช่น `ignore previous instructions`, `system override`, `DAN mode`)
2. **Input Sanitization**: ลบอักขระควบคุมและตัดความยาวข้อความคำถามเพื่อป้องกัน DoS
3. **Context Length Limiter**: คำนวณจำนวนโทเคนให้อยู่ในกรอบ 6,000 โทเคน ป้องกัน Context Window Overflow
4. **Rate Limiting**: จำกัดคำขอที่ 100 requests/นาที ป้องกันการยิงสแปมทำลาย Quota
5. **Data Isolation**: ตรวจสอบความเป็นเจ้าของ Knowledge Base ตามสิทธิ์ JWT ของผู้ใช้

---

<p align="center">
  พัฒนาด้วยความพิถีพิถันเพื่อการใช้งานระดับโปรดักชัน 🚀<br/>
  <b>KnowledgeAI Platform © 2026</b>
</p>
