import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyPendingSignup, isAlreadyRegistered, savePendingSignup } from './signupFlow';
import { registerServiceUser } from './api/account';
import { saveConsents, updateDisplayName } from './api/profile';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    removeItem: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock('./api/account', () => ({ registerServiceUser: jest.fn() }));
jest.mock('./api/profile', () => ({ updateDisplayName: jest.fn(), saveConsents: jest.fn() }));

const consent = { termsVersion: 't1', privacyVersion: 'p1' };

beforeEach(() => jest.clearAllMocks());

test('applies register → nickname → consent in order, then clears the parked data', async () => {
  const calls: string[] = [];
  (registerServiceUser as jest.Mock).mockImplementation(async () => calls.push('register'));
  (updateDisplayName as jest.Mock).mockImplementation(async () => calls.push('nickname'));
  (saveConsents as jest.Mock).mockImplementation(async () => calls.push('consent'));

  await savePendingSignup('Puppy@Example.com', { nickname: ' 두부네 ', consent });
  expect(await applyPendingSignup('puppy@example.com')).toBe(true);

  expect(calls).toEqual(['register', 'nickname', 'consent']);
  expect(updateDisplayName).toHaveBeenCalledWith('두부네');
  expect(await applyPendingSignup('puppy@example.com')).toBe(false);
});

test('skips consent when the documents are not published yet', async () => {
  await savePendingSignup('a@b.co', { nickname: 'x', consent: null });
  await applyPendingSignup('a@b.co');
  expect(saveConsents).not.toHaveBeenCalled();
});

test('keeps the parked data when applying fails so the next sign-in retries', async () => {
  (updateDisplayName as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  await savePendingSignup('c@d.co', { nickname: 'x', consent });
  await expect(applyPendingSignup('c@d.co')).rejects.toThrow('boom');
  expect(await AsyncStorage.getItem('pendingSignup:c@d.co')).not.toBeNull();
});

test('an already-registered email is recognised by its empty identities', () => {
  expect(isAlreadyRegistered({ identities: [] })).toBe(true);
  expect(isAlreadyRegistered({ identities: [{ provider: 'email' }] })).toBe(false);
  expect(isAlreadyRegistered(null)).toBe(false);
});
