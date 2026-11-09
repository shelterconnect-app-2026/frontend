import { apiFetch } from '../../../shared/lib/apiClient';
import type { ChatMessage, ChatReplyResult, ChatSession, Page } from '../types';

// docs/chat-storage-api.md (B-06) + docs/grounded-chat-api.md (B-07)
export function openChatSession(dogId: string) {
  return apiFetch<{ data: ChatSession }>(`/v1/dogs/${dogId}/chat-sessions`, { method: 'POST' });
}

export function fetchChatSession(sessionId: string) {
  return apiFetch<{ data: ChatSession }>(`/v1/chat-sessions/${sessionId}`);
}

export function fetchChatMessages(sessionId: string, params?: { limit?: number; cursor?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<Page<ChatMessage>>(`/v1/chat-sessions/${sessionId}/messages${qs ? `?${qs}` : ''}`);
}

export function sendChatMessage(sessionId: string, clientMessageId: string, text: string) {
  return apiFetch<{ data: ChatMessage }>(`/v1/chat-sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ clientMessageId, text }),
  });
}

// Blocks up to ~30s server-side while the AI call runs, then returns the finished
// reply in this same response — no polling needed (docs/grounded-chat-api.md).
export function requestChatReply(sessionId: string, messageId: string, retry?: boolean) {
  return apiFetch<{ data: ChatReplyResult }>(
    `/v1/chat-sessions/${sessionId}/messages/${messageId}/reply`,
    retry ? { method: 'POST', body: JSON.stringify({ retry: true }) } : { method: 'POST' },
  );
}
