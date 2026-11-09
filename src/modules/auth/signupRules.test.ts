import { authErrorMessage, nicknameError, signUpError, type SignUpForm } from './signupRules';

const valid: SignUpForm = {
  nickname: '두부네',
  email: 'puppy@example.com',
  password: 'password1',
  passwordConfirm: 'password1',
  termsAccepted: true,
  privacyAccepted: true,
};

describe('nicknameError', () => {
  test('rejects blank and over-long names after trimming', () => {
    expect(nicknameError('   ')).not.toBeNull();
    expect(nicknameError('가'.repeat(31))).not.toBeNull();
    expect(nicknameError(`  ${'가'.repeat(30)}  `)).toBeNull();
  });
});

describe('signUpError', () => {
  test('a valid form passes', () => {
    expect(signUpError(valid)).toBeNull();
  });

  test('reports the first problem in field order', () => {
    expect(signUpError({ ...valid, nickname: '', email: 'bad' })).toContain('닉네임');
    expect(signUpError({ ...valid, email: 'bad' })).toContain('이메일');
    expect(signUpError({ ...valid, password: 'short', passwordConfirm: 'short' })).toContain('8자');
    expect(signUpError({ ...valid, passwordConfirm: 'different1' })).toContain('달라요');
  });

  test('both required agreements must be checked', () => {
    expect(signUpError({ ...valid, termsAccepted: false })).toContain('약관');
    expect(signUpError({ ...valid, privacyAccepted: false })).toContain('약관');
    expect(signUpError({ ...valid, termsAccepted: false, privacyAccepted: false }, false)).toBeNull();
  });
});

describe('authErrorMessage', () => {
  test('translates the common Supabase errors', () => {
    expect(authErrorMessage('Invalid login credentials')).toContain('맞지 않아요');
    expect(authErrorMessage('Email not confirmed')).toContain('확인');
    expect(authErrorMessage('User already registered')).toContain('이미 가입');
  });

  test('passes unknown messages through', () => {
    expect(authErrorMessage('Something else')).toBe('Something else');
  });
});
