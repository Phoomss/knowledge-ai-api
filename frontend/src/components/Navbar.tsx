import React, { useState } from 'react';
import {
  Layers,
  LayoutDashboard,
  MessageSquare,
  Database,
  FileText,
  Sliders,
  LogIn,
  LogOut,
  Menu,
  X,
  Search,
  Sparkles,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { User, KnowledgeBase, AppTab } from '../types';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedKb = knowledgeBases.find((kb) => kb.id === selectedKbId);

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'chat', label: 'AI Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'knowledge-bases', label: 'Knowledge Bases', icon: <Database className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents & Pipeline', icon: <FileText className="w-4 h-4" /> },
    { id: 'explorer', label: 'Retrieval Explorer', icon: <Search className="w-4 h-4" /> },
    { id: 'settings', label: 'Architecture & System', icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <div
            onClick={() => setCurrentTab('overview')}
            className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-1.5 leading-none">
                <span>KnowledgeAI</span>
                <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Enterprise
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
                Next-Gen Hybrid RAG Platform
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Actions: KB Selector & User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Active Knowledge Base Selector */}
            <div className="relative">
              <select
                value={selectedKbId}
                onChange={(e) => onSelectKb(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-800 text-xs rounded-xl px-2.5 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer max-w-[140px] sm:max-w-[210px] truncate font-medium"
                title="Select Active Knowledge Base"
              >
                <option value="">📚 Select Knowledge Base</option>
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name} ({kb._count?.documents || 0} docs)
                  </option>
                ))}
              </select>
            </div>

            {/* User Profile / Auth Button */}
            {user ? (
              <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200/60">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left text-xs leading-tight">
                  <p className="font-semibold text-slate-900 truncate max-w-[110px]">{user.name}</p>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{user.role}</span>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="hidden sm:flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow-xs hover:shadow-subtle"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-elevated animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Mobile Nav Links */}
            <div className="grid grid-cols-1 gap-1">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile User Section */}
            <div className="pt-2 border-t border-slate-100">
              {user ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-900">{user.name}</p>
                      <p className="text-[10px] text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-1 text-xs text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    onOpenAuth();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around safe-bottom shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
                isActive
                  ? 'text-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="mb-0.5">{item.icon}</span>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
