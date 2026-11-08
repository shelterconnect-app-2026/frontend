import { apiFetch } from '../../../shared/lib/apiClient';
import { displayDogName } from '../displayDogName';
import type { Page, SavedDog } from '../types';

export function fetchSavedDogs(params?: { limit?: number; cursor?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<Page<SavedDog>>(`/v1/me/saved-dogs${qs ? `?${qs}` : ''}`).then(result => ({
    ...result,
    data: result.data.map(dog => ({ ...dog, dogName: displayDogName(dog.dogName) })),
  }));
}

export function fetchDogSaved(dogId: string) {
  return apiFetch<{ data: { dogId: string; saved: boolean } }>(`/v1/me/saved-dogs/${dogId}`);
}

// Idempotent — repeated saves keep the original order.
export function saveDog(dogId: string) {
  return apiFetch<unknown>(`/v1/me/saved-dogs/${dogId}`, { method: 'PUT' });
}

// Only removes the saved flag; chat history and adoption notes stay.
export function unsaveDog(dogId: string) {
  return apiFetch<unknown>(`/v1/me/saved-dogs/${dogId}`, { method: 'DELETE' });
}
