import React from 'react';
import {
  Cpu,
  Database,
  Layers,
  Sparkles,
  Server,
  Sliders,
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  HardDrive,
  Activity,
  Terminal,
} from 'lucide-react';
import { User, KnowledgeBase, DocumentItem } from '../types';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';

interface SettingsViewProps {
  user: User | null;
  knowledgeBases: KnowledgeBase[];
  documents: DocumentItem[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  knowledgeBases,
  documents,
}) => {
  const completedDocs = documents.filter((d) => d.status === 'COMPLETED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-600" />
          <span>System Architecture & Model Configuration</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          สถาปัตยกรรมระบบ Microservices การตั้งค่าโมเดลภาษา และพารามิเตอร์ของระบบ Hybrid RAG Pipeline
        </p>
      </div>

      {/* Account & Profile Summary */}
      <Card>
        <CardHeader
          title="Operator Profile & Role-Based Access"
          subtitle="ข้อมูลผู้ใช้งานปัจจุบันและระดับสิทธิ์การเข้าถึง"
          action={
            <Badge variant="primary" size="sm">
              {user ? user.role : 'Guest Mode'}
            </Badge>
          }
        />
        <CardBody className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                User Name
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {user ? user.name : 'Unauthenticated User'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Email Address
              </span>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                {user ? user.email : 'Public Session'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Authorization Mechanism
              </span>
              <p className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>JWT Bearer Auth</span>
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Models & Retrieval Stack Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Configurations */}
        <Card>
          <CardHeader
            title="AI & Foundation Models"
            subtitle="โมเดลภาษาและการสร้างเวกเตอร์ (Vector Embeddings)"
          />
          <CardBody className="space-y-4">
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    <span>Generation LLM</span>
                  </span>
                  <Badge variant="violet" size="sm">Active</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">Google Gemini 2.5 Flash</p>
                <p className="text-[11px] text-slate-400">Streaming tokens via Server-Sent Events (SSE)</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dense Embedding Model</span>
                  </span>
                  <Badge variant="primary" size="sm">PyTorch</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">BAAI/bge-m3 (Multi-lingual)</p>
                <p className="text-[11px] text-slate-400">1024-dimensional dense semantic vectors</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-600" />
                    <span>Cross-Encoder Reranker</span>
                  </span>
                  <Badge variant="warning" size="sm">Enabled</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">BAAI/bge-reranker-base</p>
                <p className="text-[11px] text-slate-400">Re-scores and filters top-15 fused candidate chunks</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Database & Vector Store Settings */}
        <Card>
          <CardHeader
            title="Storage & Ingestion Infrastructure"
            subtitle="ฐานข้อมูลเวกเตอร์และคิวประมวลผลเอกสาร"
          />
          <CardBody className="space-y-4">
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Vector Storage & Index</span>
                  </span>
                  <Badge variant="success" size="sm">Healthy</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">PostgreSQL 17 + pgvector</p>
                <p className="text-[11px] text-slate-400">HNSW vector_cosine_ops + GIN Full-Text Indexing</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Async Job Processor</span>
                  </span>
                  <Badge variant="primary" size="sm">BullMQ</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">Redis 7 Alpine Cache & Queue</p>
                <p className="text-[11px] text-slate-400">Asynchronous PDF extraction, chunking, and vector persistence</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-600" />
                    <span>RAG Fusion Hyperparameters</span>
                  </span>
                  <Badge variant="neutral" size="sm">Tuned</Badge>
                </div>
                <p className="text-xs text-slate-600 font-mono">RRF K-Constant: 60 • Score Threshold: 0.45</p>
                <p className="text-[11px] text-slate-400">Context Window Limiter: 6,000 Tokens</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
