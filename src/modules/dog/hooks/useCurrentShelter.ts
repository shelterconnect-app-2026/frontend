import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthSession } from '../../../shared/lib/useAuthSession';
import { fetchCurrentShelterPreference, updateCurrentShelterPreference } from '../api/preferences';

const ANON_STORAGE_KEY = 'anonCurrentShelterId';

export type CurrentShelterState = { status: 'loading' } | { status: 'ready'; shelterId: string | null };

/** "현재 보호소" — logged-in users keep it server-side (/v1/me/preferences), signed-out
 * users keep a device-local stand-in (docs/personal-discovery-api.md: "비로그인 사용자의
 * 임시 보호소 선택은 기기에 보관한다"). Home's shelter-entrance card and ShelterTabScreen's
 * card tap both read/write through this one hook. */
export function useCurrentShelter() {
  const session = useAuthSession();
  const [state, setState] = useState<CurrentShelterState>({ status: 'loading' });

  useFocusEffect(useCallback(() => {
    if (session.status === 'loading') {
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const shelterId =
          session.status === 'signedIn'
            ? (await fetchCurrentShelterPreference()).data?.currentShelterId ?? null
            : await AsyncStorage.getItem(ANON_STORAGE_KEY);
        if (!cancelled) {
          setState({ status: 'ready', shelterId });
        }
      } catch {
        // A temporary preference request failure should not erase the last known selection.
        if (!cancelled) {
          setState(previous => previous.status === 'ready' ? previous : { status: 'ready', shelterId: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.status]));

  const setCurrentShelter = useCallback(
    async (shelterId: string) => {
      if (session.status === 'signedIn') {
        await updateCurrentShelterPreference(shelterId);
      } else {
        await AsyncStorage.setItem(ANON_STORAGE_KEY, shelterId);
      }
      setState({ status: 'ready', shelterId });
    },
    [session.status],
  );

  return { state, setCurrentShelter };
}
