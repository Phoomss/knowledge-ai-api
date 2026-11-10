export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents: number;
  };
}

export interface DocumentItem {
  id: string;
  knowledgeBaseId: string;
  title: string;
  filename?: string;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface SourceCitation {
  document_id: string;
  chunk_id: string;
  filename: string;
  content?: string;
  score: number;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  timings?: {
    retrieval_ms?: number;
    reranking_ms?: number;
    generation_ms?: number;
    total_ms?: number;
  };
}

export interface ConversationItem {
  id: string;
  title: string;
  knowledgeBaseId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}

export type AppTab =
  | 'overview'
  | 'chat'
  | 'knowledge-bases'
  | 'documents'
  | 'explorer'
  | 'settings';

