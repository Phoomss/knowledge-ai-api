import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Plus,
  MessageSquare,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Award,
  History,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Database,
  AlertCircle,
} from 'lucide-react';
import { ConversationItem, ChatMessage, SourceCitation, KnowledgeBase } from '../types';
import { api } from '../api';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';

interface ChatViewProps {
  selectedKbId: string;
  knowledgeBases: KnowledgeBase[];
  onSelectKb: (id: string) => void;
  onNavigateToKnowledgeBases: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  selectedKbId,
  knowledgeBases,
  onSelectKb,
  onNavigateToKnowledgeBases,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedKb = knowledgeBases.find((kb) => kb.id === selectedKbId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const convs = await api.getConversations(selectedKbId || undefined);
      setConversations(convs);
    } catch (err) {
      console.error(err);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConvId(id);
    setMobileHistoryOpen(false);
    try {
      const data = await api.getConversationMessages(id);
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setMobileHistoryOpen(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation session?')) return;
    try {
      await api.deleteConversation(id);
      if (activeConvId === id) {
        startNewChat();
      }
      await loadConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  useEffect(() => {
    loadConversations();
  }, [selectedKbId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || streaming || !selectedKbId) return;

    const question = inputQuery.trim();
    setInputQuery('');

    // Append user message
    const userMsg: ChatMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);

    // Placeholder AI assistant message
    const assistantMsgIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', sources: [], timings: {} },
    ]);

    setStreaming(true);

    try {
      const assignedConvId = await api.streamChat(
        {
          question,
          knowledge_base_id: selectedKbId,
          conversation_id: activeConvId || undefined,
        },
        {
          onSources: (sources: SourceCitation[]) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].sources = sources;
              }
              return updated;
            });
          },
          onChunk: (chunk: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].content += chunk;
              }
              return updated;
            });
          },
          onDone: (timings?: any) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].timings = timings;
              }
              return updated;
            });
          },
          onError: (errMsg: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].content = `Error in RAG generation: ${errMsg}`;
              }
              return updated;
            });
          },
        },
      );

      if (assignedConvId && !activeConvId) {
        setActiveConvId(assignedConvId);
        await loadConversations();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setStreaming(false);
    }
  };

  const toggleSource = (idx: number) => {
    setExpandedSources((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const filteredConversations = conversations.filter((c) =>
    (c.title || 'Conversation Session').toLowerCase().includes(historySearch.toLowerCase()),
  );

  if (!selectedKbId) {
    return (
      <EmptyState
        icon={<Database className="w-8 h-8 text-indigo-500" />}
        title="Please Select a Knowledge Base for AI Chat"
        description="Select an active Knowledge Base partition from the header to engage with the AI Knowledge Assistant."
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

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={startNewChat}
            className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Knowledge Chat</span>
          </button>
          <button
            onClick={() => setMobileHistoryOpen(false)}
            className="lg:hidden ml-2 p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* History Search Box */}
        <div className="mb-2.5">
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search conversation history..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2 flex items-center justify-between">
          <span>Chat History</span>
          <span className="text-[10px] text-indigo-600 font-mono font-medium">PostgreSQL</span>
        </div>

        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-21rem)]">
          {filteredConversations.length === 0 ? (
            <div className="text-xs text-slate-400 px-2 py-4 text-center">
              {historySearch ? 'No matching conversations' : 'No previous conversations'}
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = activeConvId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between gap-1 group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="truncate flex-1">{c.title || 'Chat Session'}</span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {c._count?.messages || 0}
                    </span>
                    <button
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-slate-400 transition"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-xl text-[10px] text-slate-500 font-mono space-y-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-600">
            <Layers className="w-3 h-3 text-indigo-600" /> Hybrid + RRF
          </span>
          <span className="text-emerald-700 bg-emerald-50 px-1 rounded">pgvector</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-slate-600">
            <Sparkles className="w-3 h-3 text-indigo-600" /> BGE-M3
          </span>
          <span>1024 Dim</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100dvh-7.5rem)] lg:h-[calc(100vh-8.5rem)] flex gap-4 relative max-w-7xl mx-auto">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-72 bg-white border border-slate-200/90 rounded-2xl p-4 flex-col justify-between shrink-0 shadow-subtle">
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      {mobileHistoryOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileHistoryOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white border-r border-slate-200 p-4 h-full shadow-2xl flex flex-col z-10">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main AI Knowledge Chat Area */}
      <div className="flex-1 bg-white border border-slate-200/90 rounded-2xl flex flex-col overflow-hidden shadow-subtle min-w-0">
        {/* Workspace Top Header Bar */}
        <div className="px-4 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 min-w-0">
            <button
              onClick={() => setMobileHistoryOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="View chat history"
            >
              <History className="w-4 h-4 text-indigo-600" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {activeConversation?.title || 'AI Knowledge Assistant Workspace'}
                </span>
                {selectedKb && (
                  <Badge variant="primary" size="sm">
                    {selectedKb.name}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Hybrid vector semantic search + BM25 keyword fusion with real-time SSE token stream
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={startNewChat}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200/60 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Ready to answer questions from "{selectedKb?.name}"
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                ถามคำถามด้วยภาษาไทยหรืออังกฤษ ระบบจะค้นหาข้อมูลจากเอกสารผ่าน <strong>Hybrid Search (Dense Vector + BM25)</strong> และสังเคราะห์คำตอบแบบเรียลไทม์
              </p>

              {/* Sample Queries */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 w-full text-left text-xs">
                {[
                  {
                    label: 'สรุปประเด็นสำคัญในเอกสาร',
                    prompt: 'ช่วยสรุปประเด็นสำคัญและหัวข้อหลักของเอกสารในคลังความรู้นี้ให้ฟังหน่อย',
                  },
                  {
                    label: 'ค้นหากฎระเบียบหรือเงื่อนไข',
                    prompt: 'มีข้อกำหนด ระเบียบ หรือเงื่อนไขสำคัญอะไรบ้างที่ระบุไว้ในเอกสาร?',
                  },
                  {
                    label: 'วิเคราะห์ขั้นตอนการดำเนินงาน',
                    prompt: 'ช่วยอธิบายขั้นตอนหรือกระบวนการทำงานหลักตามเอกสารให้เข้าใจง่ายๆ',
                  },
                  {
                    label: 'ตรวจสอบรายละเอียดเฉพาะเจาะจง',
                    prompt: 'มีรายละเอียดเกี่ยวกับข้อกำหนดทางเทคนิคหรือตัวชี้วัดความสำเร็จอย่างไรบ้าง?',
                  },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(item.prompt);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="p-3 rounded-xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-700 transition shadow-xs text-left"
                  >
                    <p className="font-semibold text-slate-900 leading-snug">💡 {item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.prompt}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const hasSources = msg.sources && msg.sources.length > 0;
              const isSourceExpanded = expandedSources[idx];

              return (
                <div
                  key={idx}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-xs mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[88%] sm:max-w-xl md:max-w-2xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Speaker Header Label */}
                    <div className={`text-[11px] font-medium flex items-center gap-1.5 ${isUser ? 'justify-end text-slate-500' : 'text-indigo-700'}`}>
                      <span>{isUser ? 'User' : 'KnowledgeAI Assistant'}</span>
                    </div>

                    {/* Content Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-subtle ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content || (streaming ? 'Synthesizing response from retrieved knowledge chunks...' : '')}</p>
                    </div>

                    {/* Source Citations */}
                    {!isUser && hasSources && (
                      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden text-xs shadow-xs">
                        <button
                          onClick={() => toggleSource(idx)}
                          className="w-full px-3 py-2 flex items-center justify-between text-slate-600 hover:text-slate-900 transition bg-slate-50/80 text-left"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-indigo-700 text-[11px] sm:text-xs truncate">
                            <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                            <span>Referenced Sources ({msg.sources?.length} Citations)</span>
                          </span>
                          {isSourceExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 shrink-0 ml-1 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1 text-slate-400" />
                          )}
                        </button>

                        {isSourceExpanded && (
                          <div className="p-3 space-y-2 border-t border-slate-100 bg-white">
                            {msg.sources?.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className="bg-slate-50/70 border border-slate-200/70 p-2.5 rounded-lg space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono gap-2">
                                  <span className="font-semibold text-slate-700 truncate">
                                    📄 {s.filename}
                                  </span>
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded shrink-0 text-[10px]">
                                    Match: {Math.round(s.score * 100)}%
                                  </span>
                                </div>
                                {s.content && (
                                  <p className="text-[11px] text-slate-600 leading-normal line-clamp-3 italic break-words">
                                    "{s.content}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Latency & Observability Timing */}
                    {!isUser && msg.timings && msg.timings.total_ms && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono px-1">
                        <Cpu className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Latency: {Math.round(msg.timings.total_ms)}ms</span>
                        {msg.timings.retrieval_ms && (
                          <span>(Retr: {Math.round(msg.timings.retrieval_ms)}ms)</span>
                        )}
                        {msg.timings.reranking_ms && (
                          <span>(Rerank: {Math.round(msg.timings.reranking_ms)}ms)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 shrink-0 shadow-xs mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask any question about your indexed knowledge bases (Press Enter to send, Shift+Enter for new line)..."
                disabled={streaming}
                className="w-full resize-none bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none min-w-0"
              />

              <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                <span className="text-[11px] text-slate-400 font-mono">
                  {inputQuery.length} characters
                </span>

                <button
                  type="submit"
                  disabled={!inputQuery.trim() || streaming}
                  className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{streaming ? 'Synthesizing...' : 'Query Knowledge'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
