export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
export type TaskStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type SearchResultType = 'document' | 'memory' | 'task' | 'asset' | 'expense' | 'trip' | 'conversation';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface AssistantResponse {
  message: string;
  sources: Array<{ type: SearchResultType; id: string; title: string }>;
  actions: Array<{ type: string; status: string; id?: string }>;
}
