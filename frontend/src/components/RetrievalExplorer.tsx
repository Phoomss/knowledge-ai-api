import React, { useState } from 'react';
import {
  Search,
  Layers,
  Sparkles,
  Cpu,
  Clock,
  BookOpen,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
} from 'lucide-react';
import { KnowledgeBase, SourceCitation } from '../types';
import { api } from '../api';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface RetrievalExplorerProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string;
  onSelectKb: (id: string) => void;
  onNavigateToKnowledgeBases: () => void;
}

export const RetrievalExplorer: React.FC<RetrievalExplorerProps> = ({
  knowledgeBases,
  selectedKbId,
  onSelectKb,
  onNavigateToKnowledgeBases,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    answer: string;
    sources: SourceCitation[];
    metadata?: {
      retrieval_count?: number;
      used_context_count?: number;
      model?: string;
      timings?: {
        retrieval_ms?: number;
        reranking_ms?: number;
        generation_ms?: number;
        total_ms?: number;
      };
    };
  } | null>(null);

  const selectedKb = knowledgeBases.find((kb) => kb.id === selectedKbId);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedKbId || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.queryChat({
        question: query.trim(),
        knowledge_base_id: selectedKbId,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Retrieval query failed');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedKbId) {
    return (
      <EmptyState
        icon={<Database className="w-8 h-8 text-indigo-500" />}
        title="Please Select a Knowledge Base for Retrieval Inspection"
        description="Select an active Knowledge Base from the top header to inspect Hybrid Search (Dense Vector + BM25 tsvector) candidate rankings and score distributions."
        action={
          <button
            onClick={onNavigateToKnowledgeBases}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
          >
            Manage Knowledge Bases
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            <span>Hybrid Retrieval Explorer & RAG Debugger</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ทดสอบและตรวจสอบการค้นหาแบบไฮบริด (Dense Vector Cosine + BM25 Keyword) พร้อมวิเคราะห์คะแนน RRF และผลการจัดอันดับจาก Cross-Encoder Reranker
          </p>
        </div>

        <Badge variant="violet" size="md">
          Active: {selectedKb?.name}
        </Badge>
      </div>

      {/* Query Search Card */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="พิมพ์ข้อความค้นหา หรือคำถามที่ต้องการทดสอบการดึงบริบท..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Executing RAG Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Execute Retrieval</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
              <span>Pipeline: BGE-M3 (512 token chunk) ➔ HNSW Cosine + GIN BM25 ➔ RRF Score ➔ Reranker</span>
              <span className="text-indigo-600 font-medium">Top-K: 5 Candidates</span>
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Execution Error</p>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Telemetry Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Execution Time
              </span>
              <span className="text-lg font-bold text-slate-900 mt-1 block">
                {result.metadata?.timings?.total_ms ? `${Math.round(result.metadata.timings.total_ms)}ms` : '-'}
              </span>
            </Card>

            <Card className="p-3.5 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Vector + BM25 Retrieval
              </span>
              <span className="text-lg font-bold text-indigo-600 mt-1 block">
                {result.metadata?.timings?.retrieval_ms ? `${Math.round(result.metadata.timings.retrieval_ms)}ms` : '-'}
              </span>
            </Card>

            <Card className="p-3.5 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Cross-Encoder Rerank
              </span>
              <span className="text-lg font-bold text-violet-600 mt-1 block">
                {result.metadata?.timings?.reranking_ms ? `${Math.round(result.metadata.timings.reranking_ms)}ms` : '-'}
              </span>
            </Card>

            <Card className="p-3.5 bg-slate-50/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Candidate Chunks Found
              </span>
              <span className="text-lg font-bold text-emerald-600 mt-1 block">
                {result.sources.length} Documents
              </span>
            </Card>
          </div>

          {/* Retrieved Chunks Ranking Table */}
          <Card>
            <CardHeader
              title="Retrieved Chunks & Candidate Relevance"
              subtitle="อันดับเอกสารที่ดึงขึ้นมาผ่านการคำนวณเวกเตอร์และวิเคราะห์คะแนน RRF"
              action={
                <Badge variant="primary" size="sm">
                  {result.sources.length} Candidate Chunks
                </Badge>
              }
            />
            <CardBody className="p-0">
              {result.sources.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  ไม่พบคอนเทนต์ที่เกี่ยวข้องกับคำค้นหานี้ใน Knowledge Base
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {result.sources.map((source, idx) => (
                    <div key={idx} className="p-4 sm:p-5 hover:bg-slate-50/60 transition space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                            📄 {source.filename}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="success" size="sm">
                            Score: {(source.score * 100).toFixed(1)}%
                          </Badge>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
                            ID: {source.chunk_id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>

                      {source.content && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">
                          {source.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Response Preview */}
          <Card>
            <CardHeader
              title="Synthesized AI Response"
              subtitle="คำตอบสรุปที่สังเคราะห์จากบริบทเอกสารข้างต้น"
              action={
                <Badge variant="violet" size="sm">
                  {result.metadata?.model || 'Gemini 2.5 Flash'}
                </Badge>
              }
            />
            <CardBody>
              <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
};
