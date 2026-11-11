import { useCallback, useEffect, useState } from 'react';
import { fetchDogAssets, fetchDogBehavior, fetchShelterDogs } from '../api/shelters';
import { normalizeBehavior } from '../behaviorSettings';
import { ApiError } from '../../../shared/lib/apiClient';
import type { DogAssetManifest, DogBehavior, DogSummary } from '../types';

/** Demo: unconfirmed dogs fetch the ball too (see normalizeBehavior). */
const DEMO_BALL_PLAY = true;

export interface DogWithBehavior extends DogSummary {
  behavior: DogBehavior;
  /** null = no approved art yet (404) — the game falls back to its bundled sprites. */
  manifest: DogAssetManifest | null;
}

export type ShelterDogsState =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; dogs: DogWithBehavior[] };

/** Fetches a shelter's public dogs and each one's behavior settings (docs/dog-behavior-api.md). */
export function useShelterDogs(shelterId: string): ShelterDogsState {
  const [state, setState] = useState<ShelterDogsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      try {
        const { data: summaries } = await fetchShelterDogs(shelterId, { limit: 20 });
        const withBehavior = await Promise.all(
          summaries.map(async dog => {
            const [behavior, manifest] = await Promise.all([
              fetchDogBehavior(dog.id),
              // Only "no approved art" (404) falls back to the bundled sprites; any other failure
              // surfaces as an error with retry rather than drawing a stand-in for this dog.
              fetchDogAssets(dog.id).then(
                res => res.data,
                err => {
                  if (err instanceof ApiError && err.status === 404) return null;
                  throw err;
                },
              ),
            ]);
            return {
              ...dog,
              behavior: normalizeBehavior(behavior.data, { demoBallPlay: DEMO_BALL_PLAY }),
              manifest,
            };
          }),
        );
        if (!cancelled) {
          setState({ status: 'ready', dogs: withBehavior });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err), retry });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shelterId, reloadKey, retry]);

  return state;
}
