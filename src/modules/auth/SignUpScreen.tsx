import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronRight, Lock, Mail, PawPrint, User } from 'lucide-react-native';
import { supabase } from '../../shared/lib/supabase';
import { ApiError } from '../../shared/lib/apiClient';
import { fonts } from '../../shared/lib/fonts';
import { AuthField } from './components/AuthField';
import { AuthHeader } from './components/AuthHeader';
import { AuthPrimaryButton } from './components/AuthButtons';
import { AuthScreenFrame } from './components/AuthScreenFrame';
import { fetchRegistrationPolicy, type RegistrationPolicy } from './api/policy';
import { completeServiceSetup, isAlreadyRegistered, savePendingSignup, type SignupExtras } from './signupFlow';
import { authErrorMessage, signUpError } from './signupRules';
import { leaveAuthFlow } from './leaveAuthFlow';
import type { RootStackParamList } from '../../app/navigation';

// Figma "16 회원가입" (43:26015).
export function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [policy, setPolicy] = useState<RegistrationPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRegistrationPolicy().then(
      ({ data }) => !cancelled && setPolicy(data),
      // 정책을 못 불러와도 가입은 막지 않는다 — 동의 저장만 건너뜀.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const allAccepted = termsAccepted && privacyAccepted;
  const requiresConsent = policy?.available !== false;
  const toggleAll = () => {
    setTermsAccepted(!allAccepted);
    setPrivacyAccepted(!allAccepted);
  };

  async function submit() {
    if (!supabase || busy) {
      return;
    }
    const problem = signUpError({ nickname, email, password, passwordConfirm, termsAccepted, privacyAccepted }, requiresConsent);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (authError) {
        throw authError;
      }
      if (isAlreadyRegistered(data.user)) {
        // Don't park the new nickname — it would overwrite the existing account's on its next sign-in.
        Alert.alert('이미 가입된 이메일이에요', '이 이메일로 로그인해 주세요. 확인 메일을 받지 못했다면 로그인 화면에서 다시 보낼 수 있어요.', [
          { text: '로그인하기', onPress: () => navigation.replace('Login') },
        ]);
        return;
      }
      const extras: SignupExtras = {
        nickname,
        consent: policy?.available && policy.termsVersion && policy.privacyVersion
          ? { termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion }
          : null,
      };
      if (data.session) {
        await completeServiceSetup(extras);
        leaveAuthFlow(navigation);
        return;
      }
      // 이메일 확인이 필요한 프로젝트 설정 — 확인 후 첫 로그인 때 닉네임·동의를 적용한다.
      await savePendingSignup(email, extras);
      Alert.alert('확인 메일을 보냈어요', '메일의 확인 링크를 누른 뒤 로그인해 주세요.', [
        { text: '확인', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setError(authErrorMessage(message));
    } finally {
      setBusy(false);
    }
  }

  const showDocument = (title: string) =>
    Alert.alert(title, '약관 문서는 곧 공개될 예정이에요.');

  return (
    <AuthScreenFrame>
      <AuthHeader title="회원가입" />

      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.heading}>우리, 친구가 되어볼까요?</Text>
          <Text style={styles.subheading}>이웃에게 보여줄 이름으로 시작해요.</Text>
        </View>
        <View style={styles.pawBadge}>
          <PawPrint size={22} color="#a5b98e" strokeWidth={1.8} />
        </View>
      </View>

      <View style={styles.fields}>
        <AuthField label="닉네임" Icon={User} value={nickname} onChangeText={setNickname} placeholder="이웃에게 보여줄 이름" maxLength={40} editable={!busy} />
        <AuthField label="이메일" Icon={Mail} value={email} onChangeText={setEmail} placeholder="이메일 주소를 입력해 주세요" keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'email-address'} autoComplete="email" editable={!busy} />
        <AuthField label="비밀번호" Icon={Lock} secure value={password} onChangeText={setPassword} placeholder="비밀번호를 입력해 주세요" autoComplete="new-password" editable={!busy} />
        <AuthField label="비밀번호 확인" Icon={Lock} secure value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="비밀번호를 한 번 더 입력해 주세요" autoComplete="new-password" editable={!busy} />
      </View>

      {requiresConsent ? (
        <View style={styles.agreements}>
          <Pressable style={styles.allRow} onPress={toggleAll}>
            <Checkbox checked={allAccepted} />
            <Text style={styles.allText}>필수 약관에 모두 동의해요</Text>
          </Pressable>
          <View style={styles.agreementDivider} />
          <AgreementRow label="이용약관 동의 (필수)" checked={termsAccepted} onToggle={() => setTermsAccepted(v => !v)} onOpen={() => showDocument('이용약관')} />
          <AgreementRow label="개인정보 수집·이용 동의 (필수)" checked={privacyAccepted} onToggle={() => setPrivacyAccepted(v => !v)} onOpen={() => showDocument('개인정보 수집·이용')} />
        </View>
      ) : (
        <Text style={styles.policyNotice}>약관 안내는 준비 중이에요. 현재 가입에는 동의 내역을 저장하지 않아요.</Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.submit}>
        <AuthPrimaryButton label="가입하기" onPress={submit} busy={busy} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchHint}>이미 계정이 있나요?</Text>
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={8}>
          <Text style={styles.switchLink}>로그인</Text>
        </Pressable>
      </View>
    </AuthScreenFrame>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Check size={12} color="#fffefb" strokeWidth={2.4} />}
    </View>
  );
}

function AgreementRow({ label, checked, onToggle, onOpen }: { label: string; checked: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <View style={styles.agreementRow}>
      <Pressable style={styles.agreementLabel} onPress={onToggle}>
        <Checkbox checked={checked} />
        <Text style={styles.agreementText}>{label}</Text>
      </Pressable>
      <Pressable onPress={onOpen} hitSlop={10}>
        <ChevronRight size={14} color="#b8a9c4" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32 },
  titleCopy: { flex: 1 },
  heading: { fontFamily: fonts.pixel, fontSize: 22, lineHeight: 31, color: '#667583' },
  subheading: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#939faa', marginTop: 9 },
  pawBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eef3e3', alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 22, marginTop: 28 },
  agreements: { marginTop: 32, backgroundColor: '#fffefa', borderWidth: 0.9, borderColor: '#e0d5e4', borderRadius: 15, paddingHorizontal: 17, paddingVertical: 14, gap: 4 },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: 13, height: 36 },
  allText: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 17, color: '#9983a6' },
  agreementDivider: { height: 0.8, backgroundColor: '#ebe3ee', marginVertical: 8 },
  agreementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },
  agreementLabel: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 },
  agreementText: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: '#a093aa' },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: '#c6b8d1', backgroundColor: '#fffefa', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#a68abf', borderColor: '#a68abf' },
  errorText: { fontFamily: fonts.body, fontSize: 12, color: '#c0526b', marginTop: 14 },
  policyNotice: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: '#8a7e92', marginTop: 18 },
  submit: { marginTop: 28 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, marginTop: 22 },
  switchHint: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: '#aa9ab2' },
  switchLink: { fontFamily: fonts.pixel, fontSize: 11.5, lineHeight: 16, color: '#967da7', textDecorationLine: 'underline' },
});
