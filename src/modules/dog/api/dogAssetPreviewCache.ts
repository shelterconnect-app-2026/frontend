import type { SkImage } from '@shopify/react-native-skia';
import type { DogAssetClip, DogAssetManifest } from '../types';

export interface DogPreviewArt {
  idle: { image: SkImage; clip: DogAssetClip } | null;
  travel: { image: SkImage; clip: DogAssetClip } | null;
}

const MAX_CACHED_DOGS = 24;
const previews = new Map<string, DogPreviewArt>();

/** Keep only the selected dog's idle and travel sheets for the immediate chat transition. */
export function cacheDogPreviewArt(
  dogId: string,
  manifest: DogAssetManifest,
  sheets: Record<string, SkImage | null>,
) {
  const idleClip = manifest.mapDirections?.DOWN?.IDLE ?? manifest.animations.IDLE;
  const travelClip = manifest.mapDirections?.RIGHT?.RUN ?? manifest.mapDirections?.RIGHT?.WALK
    ?? manifest.animations.RUN ?? manifest.animations.WALK;
  const idleImage = idleClip ? sheets[idleClip.spritesheetUrl] : null;
  const travelImage = travelClip ? sheets[travelClip.spritesheetUrl] : null;

  previews.delete(dogId);
  previews.set(dogId, {
    idle: idleClip && idleImage ? { image: idleImage, clip: idleClip } : null,
    travel: travelClip && travelImage ? { image: travelImage, clip: travelClip } : null,
  });
  while (previews.size > MAX_CACHED_DOGS) {
    const oldestDogId = previews.keys().next().value;
    if (!oldestDogId) break;
    previews.delete(oldestDogId);
  }
}

export function getDogPreviewArt(dogId: string): DogPreviewArt | null {
  const cached = previews.get(dogId);
  if (!cached) return null;
  previews.delete(dogId);
  previews.set(dogId, cached);
  return cached;
}
