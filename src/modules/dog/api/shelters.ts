import { apiFetch } from '../../../shared/lib/apiClient';
import { displayDogName } from '../displayDogName';
import type { DogAssetManifest, DogBehavior, DogPhoto, DogProfile, DogSummary, Page, Shelter, ShelterDetail } from '../types';

export function fetchShelters(params?: { region?: string; limit?: number; cursor?: string }) {
  const query = new URLSearchParams();
  if (params?.region) query.set('region', params.region);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<Page<Shelter>>(`/v1/shelters${qs ? `?${qs}` : ''}`);
}

export function fetchShelterDetail(shelterId: string) {
  return apiFetch<{ data: ShelterDetail }>(`/v1/shelters/${shelterId}`);
}

export function fetchShelterDogs(shelterId: string, params?: { limit?: number; cursor?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<Page<DogSummary>>(`/v1/shelters/${shelterId}/dogs${qs ? `?${qs}` : ''}`).then(result => ({
    ...result,
    data: result.data.map(dog => ({ ...dog, name: displayDogName(dog.name) })),
  }));
}

export function fetchDog(dogId: string) {
  return apiFetch<{ data: DogProfile }>(`/v1/dogs/${dogId}`).then(result => ({
    ...result,
    data: { ...result.data, name: displayDogName(result.data.name) },
  }));
}

export function fetchDogBehavior(dogId: string) {
  return apiFetch<{ data: DogBehavior }>(`/v1/dogs/${dogId}/behavior`);
}

// docs/dog-action-playback-spec.md — 404 when the dog has no approved art yet. Sheet URLs are
// signed and expire ~60s after this response, so load them right away.
export function fetchDogAssets(dogId: string) {
  return apiFetch<{ data: DogAssetManifest }>(`/v1/dogs/${dogId}/assets`);
}

// docs/photo-read-api.md — 403 PHOTO_LOCKED until the caller has a COMPLETED chat
// reply from this dog (enforced server-side, not just a UI gate).
export function fetchDogPhotos(dogId: string, params?: { limit?: number; cursor?: string }) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.cursor) query.set('cursor', params.cursor);
  const qs = query.toString();
  return apiFetch<Page<DogPhoto>>(`/v1/dogs/${dogId}/photos${qs ? `?${qs}` : ''}`);
}
