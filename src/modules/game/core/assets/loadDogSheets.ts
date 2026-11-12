import { Skia, type SkImage } from '@shopify/react-native-skia';
import type { DogAssetClip, DogAssetManifest } from '../../../dog/types';

export type DogSheets = Record<string, SkImage | null>;

/**
 * Loads every sheet a manifest references (`animations` + all `mapDirections`), keyed by
 * URL — what useImage does internally, just awaited up front so the game can wait for all
 * of them before showing the map (no placeholder-then-swap flicker), and before the signed
 * /assets URLs expire (~60s). A sheet that fails to load is `null` (DogSprite draws a
 * skeleton for it).
 */
export async function loadDogSheets(manifest: DogAssetManifest): Promise<DogSheets> {
  const clips: (DogAssetClip | undefined)[] = [
    ...Object.values(manifest.animations),
    ...Object.values(manifest.mapDirections ?? {}).flatMap(byAction => Object.values(byAction ?? {})),
  ];
  const urls = [...new Set(clips.flatMap(clip => (clip ? [clip.spritesheetUrl] : [])))];
  const images = await Promise.all(
    urls.map(url =>
      Skia.Data.fromURI(url)
        .then(data => Skia.Image.MakeImageFromEncoded(data))
        .catch(() => null),
    ),
  );
  return Object.fromEntries(urls.map((url, i) => [url, images[i]]));
}

/** Re-issues after an expired manifest or a failed sheet, before falling back to skeleton sheets. */
const MAX_REISSUES = 2;
/** Treat a URL this close to expiry as expired — the download itself takes time. */
const EXPIRY_MARGIN_MS = 5_000;

/**
 * loadDogSheets for a signed manifest: checks expiry right before downloading, and on an
 * expired manifest or a failed sheet asks `reissue` for a fresh one of the SAME dog
 * (limited retries). Returns the manifest the sheets were keyed by — callers must render
 * with it, since sheet keys are its URLs.
 */
export async function loadFreshDogSheets(
  manifest: DogAssetManifest,
  reissue: () => Promise<DogAssetManifest>,
  now: () => number = Date.now,
): Promise<{ manifest: DogAssetManifest; sheets: DogSheets }> {
  let current = manifest;
  let sheets: DogSheets = {};
  for (let attempt = 0; attempt <= MAX_REISSUES; attempt++) {
    const expired = Date.parse(current.expiresAt) - now() < EXPIRY_MARGIN_MS;
    if (attempt > 0 || expired) {
      try {
        current = await reissue();
      } catch {
        break;
      }
    }
    sheets = await loadDogSheets(current);
    if (Object.values(sheets).every(Boolean)) break;
  }
  return { manifest: current, sheets };
}
