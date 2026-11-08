import { apiFetch } from '../../../shared/lib/apiClient';
import { displayDogName } from '../displayDogName';
import type { DogConversation, Page } from '../types';

// docs/personal-discovery-api.md — latest-activity order. Unsaved dogs the user chatted with
// appear too; `savedOnly` narrows to saved ones. Dogs never chatted with are NOT listed —
// those come from the saved-dogs list (sessionId null).
export function fetchDogConversations(params?: { q?: string; savedOnly?: boolean; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.savedOnly) query.set('savedOnly', 'true');
  query.set('limit', String(params?.limit ?? 50));
  return apiFetch<Page<DogConversation>>(`/v1/me/dog-conversations?${query.toString()}`).then(result => ({
    ...result,
    data: result.data.map(conversation => ({ ...conversation, dogName: displayDogName(conversation.dogName) })),
  }));
}
