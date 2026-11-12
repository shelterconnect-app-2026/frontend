import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyPendingSignup, savePendingSignup } from './signupFlow';
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

  await savePendingSignup('Puppy@Example.com', 'new-user-id', { nickname: ' 두부네 ', consent });
  expect(await applyPendingSignup('puppy@example.com', 'new-user-id')).toBe(true);

  expect(calls).toEqual(['register', 'nickname', 'consent']);
  expect(updateDisplayName).toHaveBeenCalledWith('두부네');
  expect(await applyPendingSignup('puppy@example.com', 'new-user-id')).toBe(false);
});

test('skips consent when the documents are not published yet', async () => {
  await savePendingSignup('a@b.co', 'new-user-id', { nickname: 'x', consent: null });
  await applyPendingSignup('a@b.co', 'new-user-id');
  expect(saveConsents).not.toHaveBeenCalled();
});

test('keeps the parked data when applying fails so the next sign-in retries', async () => {
  (updateDisplayName as jest.Mock).mockRejectedValueOnce(new Error('boom'));
  await savePendingSignup('c@d.co', 'new-user-id', { nickname: 'x', consent });
  await expect(applyPendingSignup('c@d.co', 'new-user-id')).rejects.toThrow('boom');
  expect(await AsyncStorage.getItem('pendingSignup:c@d.co')).not.toBeNull();
});

test('does not apply signup profile data to an existing account with the same email', async () => {
  await savePendingSignup('existing@example.com', 'obfuscated-user-id', { nickname: 'wrong nickname', consent });
  expect(await applyPendingSignup('existing@example.com', 'real-user-id')).toBe(false);
  expect(registerServiceUser).not.toHaveBeenCalled();
  expect(updateDisplayName).not.toHaveBeenCalled();
  expect(saveConsents).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('pendingSignup:existing@example.com')).toBeNull();
});

test('discards old signup data that has no auth user ID', async () => {
  await AsyncStorage.setItem('pendingSignup:legacy@example.com', JSON.stringify({ nickname: 'old nickname', consent }));
  expect(await applyPendingSignup('legacy@example.com', 'real-user-id')).toBe(false);
  expect(updateDisplayName).not.toHaveBeenCalled();
});
