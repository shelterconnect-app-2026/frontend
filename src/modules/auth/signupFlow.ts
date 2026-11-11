import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveConsents, updateDisplayName } from './api/profile';
import { registerServiceUser } from './api/account';
import { normalizeNickname } from './signupRules';

export interface SignupExtras {
  nickname: string;
  /** null while the terms/privacy documents aren't published (policy.available === false). */
  consent: { termsVersion: string; privacyVersion: string } | null;
}

/** With email confirmation on, signing up an already-registered email returns a stand-in user
 * with no identities and sends no mail (Supabase hides which emails exist). */
export function isAlreadyRegistered(user: { identities?: unknown[] } | null): boolean {
  return !!user && user.identities?.length === 0;
}

const pendingKey = (email: string) => `pendingSignup:${email.trim().toLowerCase()}`;

/** Registers the service user, then applies the nickname and (when published) the consents. */
export async function completeServiceSetup(extras: SignupExtras) {
  await registerServiceUser();
  await updateDisplayName(normalizeNickname(extras.nickname));
  if (extras.consent) {
    await saveConsents(extras.consent);
  }
}

// Supabase may require email confirmation, so there's no session right after signUp — the
// nickname/consent can't be sent yet. Park them on the device and apply them on that
// email's first sign-in.
export function savePendingSignup(email: string, extras: SignupExtras) {
  return AsyncStorage.setItem(pendingKey(email), JSON.stringify(extras));
}

/** Applies parked signup data after a successful sign-in. Returns false when there was none.
 * On failure the data stays parked so the next sign-in retries it. */
export async function applyPendingSignup(email: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(pendingKey(email));
  if (!raw) {
    return false;
  }
  await completeServiceSetup(JSON.parse(raw) as SignupExtras);
  await AsyncStorage.removeItem(pendingKey(email));
  return true;
}
