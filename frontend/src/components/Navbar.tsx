import React from 'react';
import { Bot, Database, FileText, MessageSquare, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { User, KnowledgeBase } from '../types';

interface NavbarProps {
  currentTab: 'chat' | 'documents' | 'knowledge-bases';
  setCurrentTab: (tab: 'chat' | 'documents' | 'knowledge-bases') => void;
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string;
  onSelectKb: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  onOpenAuth,
  onLogout,
  knowledgeBases,
  selectedKbId,
  onSelectKb,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-100 flex items-center gap-2">
              KnowledgeAI <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">Enterprise</span>
            </span>
            <p className="text-xs text-slate-400">Hybrid RAG & Vector Intelligence</p>
          </div>
        </div>

        {/* Knowledge Base Selector & Tabs */}
        <div className="flex items-center space-x-2">
          {/* KB Dropdown */}
          <div className="relative">
            <select
              value={selectedKbId}
              onChange={(e) => onSelectKb(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-8 cursor-pointer"
            >
              <option value="">-- เลือก Knowledge Base --</option>
              {knowledgeBases.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  📚 {kb.name} ({kb._count?.documents || 0} docs)
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-2" />

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setCurrentTab('chat')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                currentTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Chat</span>
            </button>

            <button
              onClick={() => setCurrentTab('documents')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                currentTab === 'documents'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>

            <button
              onClick={() => setCurrentTab('knowledge-bases')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                currentTab === 'knowledge-bases'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Knowledge Bases</span>
            </button>
          </nav>
        </div>

        {/* User Auth */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3 bg-slate-800/70 border border-slate-700/80 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{user.name}</p>
                <p className="text-slate-400 text-[10px] uppercase font-mono">{user.role}</p>
              </div>
              <button
                onClick={onLogout}
                title="ออกจากระบบ"
                className="text-slate-400 hover:text-rose-400 p-1 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-600/20"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ / ลงทะเบียน</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
