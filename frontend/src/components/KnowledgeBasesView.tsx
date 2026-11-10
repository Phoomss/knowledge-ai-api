import React, { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  FolderOpen,
  Calendar,
  ArrowRight,
  FileText,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { KnowledgeBase } from '../types';
import { api } from '../api';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

interface KnowledgeBasesViewProps {
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string;
  onSelectKb: (id: string) => void;
  onRefresh: () => void;
  onNavigateToDocs: (kbId: string) => void;
  onNavigateToChat: (kbId: string) => void;
}

export const KnowledgeBasesView: React.FC<KnowledgeBasesViewProps> = ({
  knowledgeBases,
  selectedKbId,
  onSelectKb,
  onRefresh,
  onNavigateToDocs,
  onNavigateToChat,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedTemplates = [
    { title: 'Engineering & Architecture Specs', desc: 'คู่มือสถาปัตยกรรมระบบ, API Specifications, DevOps guidelines และแนวทางการพัฒนาระบบ' },
    { title: 'HR & Employee Handbooks', desc: 'ระเบียบนโยบายบริษัท, สวัสดิการพนักงาน, กองทุนสำรองเลี้ยงชีพ และกระบวนการเบิกจ่าย' },
    { title: 'Product & Customer Operations', desc: 'เอกสารฟีเจอร์สินค้า, SOP การให้บริการลูกค้า และคู่มือการแก้ไขปัญหาเบื้องต้น' },
    { title: 'Legal & Compliance Knowledge', desc: 'สัญญามาตรฐาน, ข้อกำหนดทางกฎหมาย และแนวปฏิบัติด้านความปลอดภัยข้อมูล PDPA' },
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const kb = await api.createKnowledgeBase({ name, description });
      setName('');
      setDescription('');
      setShowCreateModal(false);
      onSelectKb(kb.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to create knowledge base');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Knowledge Base "${name}" and all associated documents and vector chunks?`)) return;
    try {
      await api.deleteKnowledgeBase(id);
      if (selectedKbId === id) onSelectKb('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>Knowledge Base Partitions & Repositories</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            สร้างและจัดการกลุ่มองค์ความรู้ขององค์กร เพื่อให้ RAG Pipeline สกัดคำตอบเฉพาะบริบทที่ถูกต้อง
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Knowledge Base</span>
        </button>
      </div>

      {/* Grid of Knowledge Bases */}
      {knowledgeBases.length === 0 ? (
        <EmptyState
          icon={<Database className="w-8 h-8 text-indigo-500" />}
          title="No Knowledge Bases Found"
          description="Click the button above to create your first Knowledge Base partition for indexing corporate files and PDFs."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
            >
              Create First Knowledge Base
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBases.map((kb) => {
            const isSelected = selectedKbId === kb.id;
            return (
              <Card
                key={kb.id}
                hoverable
                className={`flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : ''
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                          {kb.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="primary" size="sm">
                            {kb._count?.documents || 0} documents
                          </Badge>
                          {isSelected && (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(kb.id, kb.name)}
                      className="text-slate-400 hover:text-rose-600 transition p-1 rounded-lg hover:bg-rose-50 shrink-0"
                      title="Delete Knowledge Base"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
                    {kb.description || 'No description provided for this knowledge repository.'}
                  </p>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between text-xs text-slate-500 gap-2">
                  <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {new Date(kb.createdAt).toLocaleDateString('th-TH')}
                  </span>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        onSelectKb(kb.id);
                        onNavigateToDocs(kb.id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition shadow-xs flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Docs</span>
                    </button>
                    <button
                      onClick={() => {
                        onSelectKb(kb.id);
                        onNavigateToChat(kb.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-elevated">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Create Knowledge Base Partition
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Define a name and descriptive scope for this knowledge partition to guide hybrid vector indexing.
            </p>

            {/* Quick Template Fillers */}
            <div className="mb-4 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Or select an enterprise starter template:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {predefinedTemplates.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setName(t.title);
                      setDescription(t.desc);
                    }}
                    className="p-2 text-left rounded-xl border border-slate-100 hover:border-indigo-200 bg-slate-50/70 hover:bg-indigo-50/40 transition text-xs flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-indigo-700">{t.title}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-md">{t.desc}</p>
                    </div>
                    <span className="text-[10px] font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                      Use template
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Knowledge Base Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Enterprise Architecture & API Specs"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Scope & Context)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the topics and purpose of documents stored in this base..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Save Knowledge Base'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
