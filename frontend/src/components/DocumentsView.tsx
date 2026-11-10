import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  File,
  Trash2,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../api';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface DocumentsViewProps {
  selectedKbId: string;
  onNavigateToKnowledgeBases: () => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  selectedKbId,
  onNavigateToKnowledgeBases,
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pdf' | 'text'>('pdf');

  // Text Ingestion State
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // PDF File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDocuments = async () => {
    if (!selectedKbId) return;
    setLoading(true);
    try {
      const docs = await api.getDocuments(selectedKbId);
      setDocuments(docs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // Auto-poll status every 4 seconds if any doc is processing
    const interval = setInterval(() => {
      if (documents.some((d) => d.status === 'PROCESSING' || d.status === 'PENDING')) {
        loadDocuments();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedKbId]);

  const handleUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedKbId) return;
    setUploading(true);
    try {
      await api.uploadPdf(selectedKbId, selectedFile);
      setSelectedFile(null);
      await loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleIngestText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textTitle || !textContent || !selectedKbId) return;
    setUploading(true);
    try {
      await api.ingestText({
        knowledge_base_id: selectedKbId,
        title: textTitle,
        content: textContent,
      });
      setTextTitle('');
      setTextContent('');
      await loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Ingestion failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete document "${title}" and its vector chunks?`)) return;
    try {
      await api.deleteDocument(id);
      await loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  if (!selectedKbId) {
    return (
      <EmptyState
        icon={<FileText className="w-8 h-8 text-indigo-500" />}
        title="Please Select a Knowledge Base First"
        description="Select an active Knowledge Base from the header to view, ingest, or manage document chunks."
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
      {/* Upload & Ingestion Box */}
      <Card>
        <CardHeader
          title="Document Ingestion & Processing Hub"
          subtitle="อัปโหลดไฟล์เอกสารเข้าสู่ระบบเพื่อตัดเป็น Chunk และสร้างเวกเตอร์อัตโนมัติ"
          action={
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>BullMQ Queue Active</span>
            </div>
          }
        />
        <CardBody className="p-4 sm:p-6 space-y-4">
          <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'pdf'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📄 Upload PDF File
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'text'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📝 Raw Text Ingestion
            </button>
          </div>

          {activeTab === 'pdf' ? (
            <form onSubmit={handleUploadPdf} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 sm:p-8 text-center transition cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20">
                <input
                  type="file"
                  accept=".pdf"
                  id="pdf-upload"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer block">
                  <UploadCloud className="w-10 h-10 text-indigo-600 mx-auto mb-2" />
                  {selectedFile ? (
                    <p className="text-xs sm:text-sm font-semibold text-indigo-700 flex items-center justify-center gap-2">
                      <File className="w-4 h-4 shrink-0" />
                      <span>{selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </p>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800">
                        Click to select PDF or drag and drop file here
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-md mx-auto leading-normal">
                        Supports PDF files. The pipeline automatically extracts text, chunks content, and calculates BGE-M3 1024-dim dense vectors.
                      </p>
                    </>
                  )}
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {uploading ? 'Dispatching to BullMQ Queue...' : 'Start PDF Ingestion Pipeline'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleIngestText} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="e.g., Corporate Engineering Standards 2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Text Content</label>
                <textarea
                  rows={5}
                  required
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste or type document content here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!textTitle || !textContent || uploading}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {uploading ? 'Queueing Job...' : 'Ingest and Vectorize Content'}
                </button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {/* Ingested Documents List */}
      <Card>
        <CardHeader
          title={`Indexed Documents (${documents.length})`}
          subtitle="รายการเอกสารที่ผ่านกระบวนการ Ingestion และพร้อมสำหรับการค้นหาแบบเวกเตอร์"
          action={
            <button
              onClick={loadDocuments}
              disabled={loading}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh Status</span>
            </button>
          }
        />
        <CardBody className="p-0">
          {documents.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No documents in this Knowledge Base yet. Ingest a PDF or text snippet above.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map((doc) => {
                const isDone = doc.status === 'COMPLETED';
                const isProc = doc.status === 'PROCESSING' || doc.status === 'PENDING';
                return (
                  <div
                    key={doc.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5 sm:mt-0">
                        <File className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {doc.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                          {doc.filename || 'Direct Text Content'} • {new Date(doc.createdAt).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-start sm:self-auto shrink-0 pl-12 sm:pl-0">
                      {isDone && (
                        <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                          COMPLETED
                        </Badge>
                      )}
                      {isProc && (
                        <Badge variant="warning" size="sm" icon={<Clock className="w-3.5 h-3.5 animate-spin" />}>
                          PROCESSING
                        </Badge>
                      )}
                      {doc.status === 'FAILED' && (
                        <Badge variant="error" size="sm" icon={<AlertCircle className="w-3.5 h-3.5" />}>
                          FAILED
                        </Badge>
                      )}

                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.title)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
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
  );
};
