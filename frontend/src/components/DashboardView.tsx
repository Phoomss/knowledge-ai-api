import React from 'react';
import {
  Layers,
  Database,
  FileText,
  MessageSquare,
  Search,
  ArrowRight,
  TrendingUp,
  Cpu,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Server,
  Activity,
  Plus,
} from 'lucide-react';
import { User, KnowledgeBase, DocumentItem, ConversationItem, AppTab } from '../types';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface DashboardViewProps {
  user: User | null;
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string;
  onSelectKb: (id: string) => void;
  documents: DocumentItem[];
  conversations: ConversationItem[];
  onNavigate: (tab: AppTab) => void;
  onStartChat: (kbId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  knowledgeBases,
  selectedKbId,
  onSelectKb,
  documents,
  conversations,
  onNavigate,
  onStartChat,
}) => {
  const selectedKb = knowledgeBases.find((kb) => kb.id === selectedKbId);
  const totalCompletedDocs = documents.filter((d) => d.status === 'COMPLETED').length;
  const totalProcessingDocs = documents.filter((d) => d.status === 'PROCESSING' || d.status === 'PENDING').length;
  const totalFailedDocs = documents.filter((d) => d.status === 'FAILED').length;
  const totalSessions = conversations.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-elevated border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-indigo-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Next-Gen Hybrid RAG Platform • Dense Vector + BM25 + RRF</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              KnowledgeAI Enterprise Console{user ? `, ${user.name}` : ''}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              แพลตฟอร์มบริหารจัดการองค์ความรู้ระดับองค์กร ค้นหาและดึงบริบทด้วยสถาปัตยกรรม Hybrid Search (HNSW Cosine Vector + GIN Full-Text) พร้อมประมวลผลคำตอบผ่าน LLM ด้วยความแม่นยำสูง
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => onStartChat(selectedKbId)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs sm:text-sm hover:bg-indigo-500 transition shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              <span>เปิด AI Knowledge Chat</span>
            </button>
            <button
              onClick={() => onNavigate('explorer')}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs sm:text-sm border border-white/20 transition"
            >
              <Search className="w-4 h-4" />
              <span>Retrieval Explorer</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Knowledge Bases */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Knowledge Bases
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{knowledgeBases.length}</span>
            <span className="text-xs text-slate-500 font-medium">คลังข้อมูล</span>
          </div>
          <p className="text-xs text-indigo-600 font-medium mt-1 truncate">
            {selectedKb ? `เลือกอยู่: ${selectedKb.name}` : 'ยังไม่ได้เลือก Active Base'}
          </p>
        </Card>

        {/* Total Documents & Indexing Status */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Documents & Ingestion
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{documents.length}</span>
            <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
              {totalCompletedDocs} Indexed
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
            {totalProcessingDocs > 0 && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" /> {totalProcessingDocs} Ingesting
              </span>
            )}
            {totalFailedDocs > 0 && (
              <span className="text-rose-600 font-medium">
                {totalFailedDocs} Failed
              </span>
            )}
            {totalProcessingDocs === 0 && totalFailedDocs === 0 && (
              <span className="text-slate-400">คิว BullMQ ทั้งหมดพร้อมใช้งาน</span>
            )}
          </div>
        </Card>

        {/* AI Conversations */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Query Sessions
            </span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{totalSessions}</span>
            <span className="text-xs text-slate-500 font-medium">เซสชันบทสนทนา</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">ประวัติสนทนาแบบ Realtime SSE</p>
        </Card>

        {/* Hybrid RAG Performance */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              RAG Retrieval Stack
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-slate-900">Hybrid + RRF</span>
            <Badge variant="violet" size="sm">BGE-M3</Badge>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dense 1024 + GIN BM25 + Cross-Encoder</p>
        </Card>
      </div>

      {/* Main Grid: Pipeline Architecture Health & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: System Architecture Health */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader
              title="Infrastructure & Pipeline Status"
              subtitle="สถานะการทำงานของ Microservices ภายในระบบ"
            />
            <CardBody className="space-y-3">
              {[
                { name: 'Vector Database', desc: 'PostgreSQL 17 + pgvector (1024-dim HNSW)', status: 'Connected', icon: <Database className="w-4 h-4 text-emerald-600" /> },
                { name: 'Embedding Service', desc: 'BAAI/bge-m3 (PyTorch FastAPI Engine)', status: 'Active', icon: <Cpu className="w-4 h-4 text-indigo-600" /> },
                { name: 'Async Ingestion Queue', desc: 'BullMQ + Redis 7 Worker', status: 'Operational', icon: <Server className="w-4 h-4 text-emerald-600" /> },
                { name: 'LLM Generation', desc: 'Google Gemini 2.5 Flash (SSE Stream)', status: 'Ready', icon: <Sparkles className="w-4 h-4 text-violet-600" /> },
              ].map((svc, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-start space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      {svc.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-900 truncate">{svc.name}</h4>
                      <p className="text-[11px] text-slate-500 leading-snug">{svc.desc}</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm" className="shrink-0">
                    {svc.status}
                  </Badge>
                </div>
              ))}

              <button
                onClick={() => onNavigate('settings')}
                className="w-full mt-2 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <span>ดูรายละเอียดการกำหนดค่าสถาปัตยกรรม (System Info)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Recent Sessions & Quick Access */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Recent AI Knowledge Query Sessions"
              subtitle="บทสนทนาและการค้นหาล่าสุดในฐานข้อมูลความรู้"
              action={
                <button
                  onClick={() => onNavigate('chat')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <span>ดูแชททั้งหมด</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              }
            />
            <CardBody className="p-0">
              {conversations.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="w-6 h-6" />}
                  title="ยังไม่มีประวัติการค้นหาหรือสนทนา"
                  description="เลือก Knowledge Base และเริ่มต้นตั้งคำถามกับ AI เพื่อตรวจสอบการดึงบริบทแบบ Hybrid RAG"
                  action={
                    <button
                      onClick={() => onStartChat(selectedKbId)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                    >
                      เริ่มแชทแรกของคุณ
                    </button>
                  }
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {conversations.slice(0, 5).map((conv) => {
                    const kb = knowledgeBases.find((k) => k.id === conv.knowledgeBaseId);
                    return (
                      <div
                        key={conv.id}
                        className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition cursor-pointer"
                        onClick={() => {
                          if (conv.knowledgeBaseId) onSelectKb(conv.knowledgeBaseId);
                          onNavigate('chat');
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                              {conv.title || 'เซสชันบทสนทนา'}
                            </h4>
                            {kb && (
                              <Badge variant="primary" size="sm">
                                {kb.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{new Date(conv.updatedAt || conv.createdAt).toLocaleString('th-TH')}</span>
                            <span>•</span>
                            <span>{conv._count?.messages || 0} ข้อความถาม-ตอบ</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (conv.knowledgeBaseId) onSelectKb(conv.knowledgeBaseId);
                              onNavigate('chat');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition flex items-center gap-1"
                          >
                            <span>เปิดต่อ</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
