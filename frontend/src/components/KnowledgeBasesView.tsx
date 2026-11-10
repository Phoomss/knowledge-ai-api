import React, { useState } from 'react';
import { Database, Plus, Trash2, FolderOpen, Calendar, ArrowRight } from 'lucide-react';
import { KnowledgeBase } from '../types';
import { api } from '../api';

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
    if (!confirm(`คุณแน่ใจว่าต้องการลบ Knowledge Base "${name}" และเอกสารทั้งหมดในนี้?`)) return;
    try {
      await api.deleteKnowledgeBase(id);
      if (selectedKbId === id) onSelectKb('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Knowledge Bases (ฐานความรู้)
          </h2>
          <p className="text-sm text-slate-400">
            สร้างและจัดการฐานข้อมูลเพื่อแบ่งหมวดหมู่เอกสารและให้ AI นำไปค้นหาบริบทตอบคำถาม
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>สร้าง Knowledge Base</span>
        </button>
      </div>

      {/* Grid of Knowledge Bases */}
      {knowledgeBases.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
          <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">ยังไม่มี Knowledge Base</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            กดปุ่มสร้างด้านบนเพื่อเริ่มต้นสร้างฐานความรู้สำหรับใส่ไฟล์ PDF หรือเอกสารของคุณ
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBases.map((kb) => {
            const isSelected = selectedKbId === kb.id;
            return (
              <div
                key={kb.id}
                className={`p-5 rounded-2xl border transition-all relative group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-emerald-400">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-100 text-base">{kb.name}</h4>
                        <span className="text-xs text-emerald-400 font-mono">
                          {kb._count?.documents || 0} เอกสาร
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(kb.id, kb.name)}
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                      title="ลบฐานความรู้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mt-3 line-clamp-2">
                    {kb.description || 'ไม่มีคำอธิบาย'}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(kb.createdAt).toLocaleDateString('th-TH')}
                  </span>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => { onSelectKb(kb.id); onNavigateToDocs(kb.id); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px]"
                    >
                      จัดการไฟล์
                    </button>
                    <button
                      onClick={() => { onSelectKb(kb.id); onNavigateToChat(kb.id); }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 transition text-[11px] flex items-center gap-1"
                    >
                      <span>เปิดแชท</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-2">สร้าง Knowledge Base ใหม่</h3>
            <p className="text-xs text-slate-400 mb-4">
              กำหนดชื่อและคำอธิบายสำหรับกลุ่มข้อมูลนี้
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อ Knowledge Base</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น นโยบายบริษัท, คู่มือผลิตภัณฑ์ 2026"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">คำอธิบาย (ทางเลือก)</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติมของเอกสารชุดนี้..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {loading ? 'กำลังสร้าง...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
