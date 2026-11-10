export interface RagOptions {
  top_k: number;
  use_reranker: boolean;
}

export interface RagRequest {
  question: string;
  conversation_id?: string;
  knowledge_base_id: string;
  options?: RagOptions;
}

export interface RagSource {
  document_id: string;
  chunk_id: string;
  content: string;
  score: number;
}

export interface RagResponse {
  answer: string;
  sources: RagSource[];

  metadata: {
    model: string;
    retrieval_count: number;
  };
}
