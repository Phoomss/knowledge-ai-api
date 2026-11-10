import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Bot,
  User,
  Plus,
  MessageSquare,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ConversationItem, ChatMessage, SourceCitation } from '../types';
import { api } from '../api';

interface ChatViewProps {
  selectedKbId: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ selectedKbId }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  };

  useEffect(() => {
    loadConversations();
  }, [selectedKbId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || streaming || !selectedKbId) return;

    const question = inputQuery.trim();
    setInputQuery('');

    // Append user message
    const userMsg: ChatMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);

    // Placeholder assistant message
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
          onSources: (sources) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].sources = sources;
              }
              return updated;
            });
          },
          onChunk: (chunk) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].content += chunk;
              }
              return updated;
            });
          },
          onDone: (timings) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].timings = timings;
              }
              return updated;
            });
          },
          onError: (errMsg) => {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[assistantMsgIndex]) {
                updated[assistantMsgIndex].content = `ขออภัย เกิดข้อผิดพลาด: ${errMsg}`;
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

  if (!selectedKbId) {
    return (
      <div className="text-center py-24 border border-slate-800 rounded-2xl bg-slate-900/40">
        <Bot className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">กรุณาเลือก Knowledge Base ก่อน</h3>
        <p className="text-sm text-slate-500 mt-1">
          เลือกฐานความรู้จากแถบเมนูด้านบนเพื่อเริ่มต้นสนทนาแบบ Hybrid RAG
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] flex gap-4">
      {/* Sidebar (Conversations) */}
      <div className="w-64 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between shrink-0">
        <div>
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 mb-3"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างบทสนทนาใหม่</span>
          </button>

          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
            ประวัติการแชท (Postgres)
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-17rem)]">
            {conversations.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-4 text-center">
                ยังไม่มีประวัติการแชท
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activeConvId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center space-x-2 ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 font-medium border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1">{c.title || 'ห้องสนทนา'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {c._count?.messages || 0}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="p-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" /> Hybrid + RRF
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" /> BGE-M3
          </span>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
                <Bot className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">พร้อมตอบทุกคำถามจากฐานความรู้</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                ถามคำถามด้วยภาษาไทยหรืออังกฤษ ระบบจะดึงข้อมูลบริบทจาก PDF ผ่าน **Hybrid Search (Vector + Full-Text BM25)** และประมวลผลคำตอบแบบ Realtime
              </p>
              <div className="grid grid-cols-2 gap-2 mt-6 w-full text-left text-xs">
                <button
                  onClick={() => setInputQuery('พนักงานสามารถเบิกค่ารักษาพยาบาล OPD ได้เท่าไหร่?')}
                  className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-slate-300 transition"
                >
                  💡 ค่ารักษาพยาบาล OPD เบิกได้เท่าไหร่?
                </button>
                <button
                  onClick={() => setInputQuery('สรุปนโยบายและระเบียบการทำงานให้ฟังหน่อย')}
                  className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-slate-300 transition"
                >
                  💡 สรุปนโยบายบริษัทสั้นๆ
                </button>
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
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-2xl space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none shadow-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content || (streaming ? '...' : '')}</p>
                    </div>

                    {/* Sources Citation Accordion */}
                    {!isUser && hasSources && (
                      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl overflow-hidden text-xs">
                        <button
                          onClick={() => toggleSource(idx)}
                          className="w-full px-3 py-2 flex items-center justify-between text-slate-400 hover:text-slate-200 transition bg-slate-800/40"
                        >
                          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                            <BookOpen className="w-3.5 h-3.5" />
                            อ้างอิงจาก {msg.sources?.length} แหล่งข้อมูล (Citations)
                          </span>
                          {isSourceExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isSourceExpanded && (
                          <div className="p-3 space-y-2 border-t border-slate-800">
                            {msg.sources?.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg space-y-1"
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="font-semibold text-slate-300 truncate max-w-xs">
                                    📄 {s.filename}
                                  </span>
                                  <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    Score: {s.score.toFixed(2)}
                                  </span>
                                </div>
                                {s.content && (
                                  <p className="text-[11px] text-slate-400 leading-normal line-clamp-3 italic">
                                    "{s.content}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Observability Timing Badge */}
                    {!isUser && msg.timings && msg.timings.total_ms && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono px-1">
                        <Cpu className="w-3 h-3 text-slate-400" />
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
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
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
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="พิมพ์คำถามของคุณที่นี่..."
              disabled={streaming}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || streaming}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
