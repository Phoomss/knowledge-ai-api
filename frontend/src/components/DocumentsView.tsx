import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, Clock, AlertCircle, RefreshCw, File } from 'lucide-react';
import { DocumentItem } from '../types';
import { api } from '../api';

interface DocumentsViewProps {
  selectedKbId: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ selectedKbId }) => {
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

  if (!selectedKbId) {
    return (
      <div className="text-center py-20 border border-slate-800 rounded-2xl bg-slate-900/40">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">กรุณาเลือก Knowledge Base ก่อน</h3>
        <p className="text-sm text-slate-500 mt-1">
          เลือก Knowledge Base จากแถบด้านบนเพื่อดูหรืออัปโหลดเอกสาร
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('pdf')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'pdf'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📄 อัปโหลดไฟล์ PDF
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'text'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📝 ใส่เนื้อหาข้อความ (Text)
            </button>
          </div>
          <span className="text-xs text-slate-400 font-mono">Queue Worker (BullMQ + Redis)</span>
        </div>

        {activeTab === 'pdf' ? (
          <form onSubmit={handleUploadPdf} className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-8 text-center transition cursor-pointer bg-slate-950/40">
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
                <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                {selectedFile ? (
                  <p className="text-sm font-medium text-emerald-400 flex items-center justify-center gap-2">
                    <File className="w-4 h-4" />
                    {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-200">
                      คลิกเพื่อเลือกไฟล์ PDF หรือลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      รองรับไฟล์ PDF สูงสุด 50MB ระบบจะแยกหน้า ดึงข้อความ และตัดเป็น Chunk พร้อมแนบเลขหน้าอัตโนมัติ
                    </p>
                  </>
                )}
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {uploading ? 'กำลังส่งข้อมูลเข้า Queue...' : 'เริ่มกระบวนการ Ingest PDF'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleIngestText} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">หัวข้อเอกสาร</label>
              <input
                type="text"
                required
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="เช่น กฎระเบียบบริษัท 2026"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">เนื้อหาข้อความ</label>
              <textarea
                rows={5}
                required
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="พิมพ์หรือคัดลอกข้อความยาวๆ มาวางที่นี่..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!textTitle || !textContent || uploading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                {uploading ? 'กำลังส่งเข้าคิว...' : 'บันทึกและแปลงเป็นเวกเตอร์'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Document List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            เอกสารใน Knowledge Base นี้ ({documents.length})
          </h3>
          <button
            onClick={loadDocuments}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-10 border border-slate-800 rounded-xl bg-slate-900/30 text-xs text-slate-500">
            ยังไม่มีเอกสารในฐานความรู้นี้ ลองอัปโหลด PDF หรือเพิ่มข้อความด้านบน
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
            {documents.map((doc) => {
              const isDone = doc.status === 'COMPLETED';
              const isProc = doc.status === 'PROCESSING' || doc.status === 'PENDING';
              return (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300">
                      <File className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{doc.title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {doc.filename || 'Text Content'} • {new Date(doc.createdAt).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {isDone && (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>COMPLETED</span>
                      </span>
                    )}
                    {isProc && (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>PROCESSING...</span>
                      </span>
                    )}
                    {doc.status === 'FAILED' && (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>FAILED</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
