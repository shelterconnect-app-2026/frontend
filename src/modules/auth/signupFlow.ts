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
// nickname/consent can't be sent yet. Park them on the device, bound to the new auth user, and
// apply them on that user's first sign-in — never to another account with the same email.
export function savePendingSignup(email: string, authUserId: string, extras: SignupExtras) {
  return AsyncStorage.setItem(pendingKey(email), JSON.stringify({ ...extras, authUserId }));
}

/** Applies parked signup data after a successful sign-in. Returns false when there was none.
 * On failure the data stays parked so the next sign-in retries it. */
export async function applyPendingSignup(email: string, authUserId: string): Promise<boolean> {
  const key = pendingKey(email);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return false;
  }
  const pending = JSON.parse(raw) as SignupExtras & { authUserId?: string };
  // Parked for a different account (or by an older build without the ID) — drop it.
  if (pending.authUserId !== authUserId) {
    await AsyncStorage.removeItem(key);
    return false;
  }
  await completeServiceSetup(pending);
  await AsyncStorage.removeItem(key);
  return true;
}
