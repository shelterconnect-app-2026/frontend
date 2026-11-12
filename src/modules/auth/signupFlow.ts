import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveConsents, updateDisplayName } from './api/profile';
import { registerServiceUser } from './api/account';
import { normalizeNickname } from './signupRules';

export interface SignupExtras {
  nickname: string;
  /** null while the terms/privacy documents aren't published (policy.available === false). */
  consent: { termsVersion: string; privacyVersion: string } | null;
}

interface PendingSignup extends SignupExtras {
  authUserId: string;
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
// nickname/consent can't be sent yet. Bind them to the newly created auth user so
// another account with the same email can never receive these profile changes.
export function savePendingSignup(email: string, authUserId: string, extras: SignupExtras) {
  return AsyncStorage.setItem(pendingKey(email), JSON.stringify({ ...extras, authUserId } satisfies PendingSignup));
}

/** Applies parked signup data after a successful sign-in. Returns false when there was none.
 * On failure the data stays parked so the next sign-in retries it. */
export async function applyPendingSignup(email: string, authUserId: string): Promise<boolean> {
  const key = pendingKey(email);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return false;
  }
  let pending: PendingSignup;
  try {
    pending = JSON.parse(raw) as PendingSignup;
  } catch {
    await AsyncStorage.removeItem(key);
    return false;
  }
  // Older pending records have no user ID. They cannot safely be associated with
  // this sign-in, and obfuscated duplicate-signup responses use a different ID.
  if (pending.authUserId !== authUserId) {
    await AsyncStorage.removeItem(key);
    return false;
  }
  await completeServiceSetup(pending);
  await AsyncStorage.removeItem(key);
  return true;
}
