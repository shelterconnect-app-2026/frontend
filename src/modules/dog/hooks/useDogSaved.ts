import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '../../../shared/lib/useAuthSession';
import { fetchDogSaved, saveDog, unsaveDog } from '../api/savedDogs';

/** Save/unsave toggle for one dog (docs/personal-discovery-api.md `/v1/me/saved-dogs/{dogId}`).
 * `needsLogin` is true while signed out — the caller sends the user to Login instead. */
export function useDogSaved(dogId: string) {
  const session = useAuthSession();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // The initial lookup failed, so `saved` is unknown; toggling retries the lookup instead of guessing.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (session.status !== 'signedIn') {
      setSaved(false);
      setLoadFailed(false);
      return;
    }
    let cancelled = false;
    fetchDogSaved(dogId).then(
      ({ data }) => {
        if (cancelled) return;
        setSaved(data.saved);
        setLoadFailed(false);
      },
      () => !cancelled && setLoadFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [dogId, session.status, reloadKey]);

  /** Resolves true only when the change reached the server — callers show success only then. */
  const toggle = useCallback(async (): Promise<boolean> => {
    if (busy) {
      return false;
    }
    if (loadFailed) {
      setReloadKey(key => key + 1);
      return false;
    }
    const next = !saved;
    setSaved(next);
    setBusy(true);
    try {
      await (next ? saveDog(dogId) : unsaveDog(dogId));
      return true;
    } catch {
      setSaved(!next);
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, dogId, loadFailed, saved]);

  return { saved, toggle, loadFailed, needsLogin: session.status === 'anon' };
}
