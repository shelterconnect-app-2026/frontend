// Pure validation for the 회원가입 form (Figma 16) — mirrors the server's own limits
// (docs/personal-discovery-api.md: displayName trimmed 1~30 chars).

export const NICKNAME_MAX = 30;
export const PASSWORD_MIN = 8;

export function normalizeNickname(raw: string): string {
  return raw.trim();
}

export function nicknameError(raw: string): string | null {
  const nickname = normalizeNickname(raw);
  if (nickname.length === 0) {
    return '닉네임을 입력해 주세요.';
  }
  if (nickname.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  }
  return null;
}

export interface SignUpForm {
  nickname: string;
  email: string;
  password: string;
  passwordConfirm: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

/** First problem found, in the order the fields appear — null when the form can be submitted. */
export function signUpError(form: SignUpForm, requireConsent = true): string | null {
  const nickname = nicknameError(form.nickname);
  if (nickname) {
    return nickname;
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    return '이메일 주소를 확인해 주세요.';
  }
  if (form.password.length < PASSWORD_MIN) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
  }
  if (form.password !== form.passwordConfirm) {
    return '비밀번호가 서로 달라요.';
  }
  if (requireConsent && (!form.termsAccepted || !form.privacyAccepted)) {
    return '필수 약관에 모두 동의해 주세요.';
  }
  return null;
}

/** Supabase auth errors arrive in English — show the ones people actually hit in Korean. */
export function authErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('network request failed') || text.includes('failed to fetch')) {
    return '인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  if (text.includes('signups not allowed') || text.includes('signup disabled') || text.includes('signups disabled')) {
    return '현재 새 계정 가입이 중지되어 있어요. 기존 계정으로 로그인해 주세요.';
  }
  if (text.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 맞지 않아요.';
  }
  if (text.includes('email not confirmed')) {
    return '이메일 확인이 필요해요. 받은 편지함의 확인 메일을 눌러 주세요.';
  }
  if (text.includes('already registered') || text.includes('already been registered')) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  }
  return message;
}
