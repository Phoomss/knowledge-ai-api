import {
  KnowledgeBase,
  DocumentItem,
  ConversationItem,
  ChatMessage,
  User,
  SourceCitation,
} from './types';

const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

function getHeaders(isJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async register(data: { email: string; password: string; name: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Registration failed');
    return res.json() as Promise<{ user: User; access_token: string }>;
  },

  async login(data: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Login failed');
    return res.json() as Promise<{ user: User; access_token: string }>;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<User>;
  },

  // Knowledge Bases
  async getKnowledgeBases() {
    const res = await fetch(`${API_BASE}/knowledge-bases`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load knowledge bases');
    return res.json() as Promise<KnowledgeBase[]>;
  },

  async createKnowledgeBase(data: { name: string; description?: string }) {
    const res = await fetch(`${API_BASE}/knowledge-bases`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create knowledge base');
    return res.json() as Promise<KnowledgeBase>;
  },

  async deleteKnowledgeBase(id: string) {
    const res = await fetch(`${API_BASE}/knowledge-bases/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete knowledge base');
  },

  // Documents
  async getDocuments(knowledgeBaseId?: string) {
    const url = knowledgeBaseId
      ? `${API_BASE}/documents?knowledge_base_id=${knowledgeBaseId}`
      : `${API_BASE}/documents`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load documents');
    return res.json() as Promise<DocumentItem[]>;
  },

  async uploadPdf(knowledgeBaseId: string, file: File, title?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('knowledge_base_id', knowledgeBaseId);
    if (title) formData.append('title', title);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: getHeaders(false),
      body: formData,
    });
    if (!res.ok) throw new Error((await res.json()).message || 'PDF upload failed');
    return res.json() as Promise<DocumentItem>;
  },

  async ingestText(data: {
    knowledge_base_id: string;
    title: string;
    content: string;
    filename?: string;
  }) {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Ingestion failed');
    return res.json() as Promise<DocumentItem>;
  },

  // Chat
  async getConversations(knowledgeBaseId?: string) {
    const url = knowledgeBaseId
      ? `${API_BASE}/chat/conversations?knowledge_base_id=${knowledgeBaseId}`
      : `${API_BASE}/chat/conversations`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load conversations');
    return res.json() as Promise<ConversationItem[]>;
  },

  async getConversationMessages(id: string) {
    const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load conversation history');
    return res.json() as Promise<{ messages: ChatMessage[] }>;
  },

  async streamChat(
    payload: {
      question: string;
      knowledge_base_id: string;
      conversation_id?: string;
    },
    callbacks: {
      onSources?: (sources: SourceCitation[]) => void;
      onChunk?: (text: string) => void;
      onDone?: (timings?: any) => void;
      onError?: (error: string) => void;
    },
  ) {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Stream request failed' }));
      callbacks.onError?.(err.message || 'Stream failed');
      return;
    }

    const conversationId = res.headers.get('x-conversation-id') || payload.conversation_id;
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = 'message';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'sources') {
              callbacks.onSources?.(data);
            } else if (currentEvent === 'done') {
              callbacks.onDone?.(data.timings);
            } else {
              // message / chunk
              if (data.content) {
                callbacks.onChunk?.(data.content);
              }
            }
          } catch {
            // non-json payload
          }
        }
      }
    }

    return conversationId;
  },
};
