import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Canvas, FilterMode, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { ChevronRight, Lock, Mail } from 'lucide-react-native';
import { supabase } from '../../shared/lib/supabase';
import { ApiError } from '../../shared/lib/apiClient';
import { fonts } from '../../shared/lib/fonts';
import { SvgIcon } from '../../shared/ui/SvgIcon';
import { authImages } from './assets/images';
import { svgAssets } from './assets/svgAssets';
import { AuthField } from './components/AuthField';
import { AuthHeader } from './components/AuthHeader';
import { AuthPrimaryButton } from './components/AuthButtons';
import { AuthScreenFrame } from './components/AuthScreenFrame';
import { registerServiceUser } from './api/account';
import { applyPendingSignup } from './signupFlow';
import { authErrorMessage } from './signupRules';
import { leaveAuthFlow } from './leaveAuthFlow';
import type { RootStackParamList } from '../../app/navigation';

const NEAREST = { filter: FilterMode.Nearest };

// Figma "15 로그인" (43:25905).
export function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  if (!supabase) {
    return (
      <AuthScreenFrame>
        <AuthHeader title="로그인" />
        <Text style={styles.notice}>로그인 기능은 아직 설정 중이에요.{'\n'}(SUPABASE_ANON_KEY 미설정 — 백엔드팀 확인 필요)</Text>
      </AuthScreenFrame>
    );
  }

  async function submit() {
    if (!supabase || busy) {
      return;
    }
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    setNeedsConfirmation(false);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        throw authError;
      }
      // "앱에서 연결할 순서" (auth-and-permissions.md): 로그인 직후 서비스 사용자 등록. 이메일 확인을
      // 거쳐 가입한 사용자의 보관해 둔 닉네임·동의는 여기서 처음 서버에 보낸다.
      if (!(await applyPendingSignup(email, data.user.id))) {
        await registerServiceUser();
      }
      leaveAuthFlow(navigation);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setNeedsConfirmation(message.toLowerCase().includes('email not confirmed'));
      setError(authErrorMessage(message));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!supabase || busy || !email.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (resendError) {
        throw resendError;
      }
      setNeedsConfirmation(false);
      setNotice('새 확인 메일을 보냈어요. 받은 편지함을 확인해 주세요.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(authErrorMessage(message));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      return;
    }
    if (!email.trim()) {
      setError('비밀번호를 재설정할 이메일을 먼저 입력해 주세요.');
      setNotice(null);
      return;
    }
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (resetError) {
      setError(authErrorMessage(resetError.message));
      return;
    }
    setNotice('비밀번호 재설정 메일을 보냈어요. 받은 편지함을 확인해 주세요.');
  }

  return (
    <AuthScreenFrame>
      <AuthHeader title="로그인" />
      <LoginScene />

      <Text style={styles.heading}>친구와 이야기를 이어가요</Text>
      <Text style={styles.subheading}>강아지와 대화하고, 이웃들과 소식을 나눠요.</Text>

      <View style={styles.fields}>
        <AuthField
          label="이메일"
          Icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder="이메일 주소를 입력해 주세요"
          keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'email-address'}
          autoComplete="email"
          editable={!busy}
        />
        <AuthField
          label="비밀번호"
          Icon={Lock}
          secure
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호를 입력해 주세요"
          autoComplete="current-password"
          editable={!busy}
          onSubmitEditing={submit}
        />
      </View>

      <Pressable style={styles.forgot} onPress={sendPasswordReset} hitSlop={8}>
        <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {needsConfirmation && (
        <Pressable onPress={resendConfirmation} disabled={busy} hitSlop={8}>
          <Text style={styles.resendText}>확인 메일 다시 보내기</Text>
        </Pressable>
      )}
      {notice && <Text style={styles.noticeText}>{notice}</Text>}

      <View style={styles.submit}>
        <AuthPrimaryButton label="로그인" onPress={submit} busy={busy} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchHint}>아직 계정이 없나요?</Text>
        <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={8}>
          <Text style={styles.switchLink}>회원가입</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />
      <Text style={styles.browseHint}>보호소와 강아지 정보는 로그인 없이 볼 수 있어요.</Text>
      <Pressable style={styles.browse} onPress={() => navigation.goBack()} hitSlop={8}>
        <Text style={styles.browseText}>먼저 둘러볼게요</Text>
        <ChevronRight size={12} color="#91a17f" strokeWidth={2} />
      </Pressable>
    </AuthScreenFrame>
  );
}

// Figma hero: mint blob + grass, a speech bubble, and the two dot dogs (sample art from the design).
function LoginScene() {
  const dubu = useImage(authImages.dubu);
  const bori = useImage(authImages.bori);
  return (
    <View style={styles.scene}>
      <View style={styles.blob} />
      <View style={styles.grass} />
      <View style={[styles.cloud, styles.cloudA]} />
      <View style={[styles.cloud, styles.cloudAHigh]} />
      <View style={[styles.cloud, styles.cloudB]} />
      <View style={[styles.cloud, styles.cloudBHigh]} />
      <View style={styles.shadowA} />
      <View style={styles.shadowB} />
      <Canvas style={styles.dubu}>
        {dubu && <SkiaImage image={dubu} x={0} y={0} width={69.3} height={93} fit="contain" sampling={NEAREST} />}
      </Canvas>
      <Canvas style={styles.bori}>
        {bori && <SkiaImage image={bori} x={0} y={0} width={60.8} height={67} fit="contain" sampling={NEAREST} />}
      </Canvas>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>다시 만나서 반가워!</Text>
      </View>
      <SvgIcon xml={svgAssets.sparkle8} width={8} height={8} style={styles.sparkleA} />
      <SvgIcon xml={svgAssets.sparkle10} width={10} height={10} style={styles.sparkleB} />
      <SvgIcon xml={svgAssets.heartSmall} width={10} height={9} style={styles.heart} />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { fontFamily: fonts.body, fontSize: 13, color: '#8c7b99', textAlign: 'center', marginTop: 48 },
  scene: { alignSelf: 'center', width: 260, height: 160, marginTop: 38 },
  blob: { position: 'absolute', top: 0, width: 228, height: 149, borderRadius: 70, backgroundColor: '#e9f3ee', left: 16 },
  grass: { position: 'absolute', left: 29, top: 97, width: 202, height: 44, borderRadius: 22, backgroundColor: '#e1eacf' },
  cloud: { position: 'absolute', backgroundColor: '#fffcf0' },
  cloudA: { left: 39, top: 33, width: 24, height: 6 },
  cloudAHigh: { left: 47, top: 29, width: 10, height: 4 },
  cloudB: { left: 204, top: 51, width: 18, height: 5 },
  cloudBHigh: { left: 209, top: 47, width: 7, height: 4 },
  shadowA: { position: 'absolute', left: 59, top: 125, width: 76, height: 8, borderRadius: 4, backgroundColor: '#cbd8b8' },
  shadowB: { position: 'absolute', left: 150, top: 124, width: 57, height: 7, borderRadius: 4, backgroundColor: '#cbd8b8' },
  dubu: { position: 'absolute', left: 64, top: 39, width: 70, height: 93 },
  bori: { position: 'absolute', left: 151, top: 60, width: 61, height: 67 },
  bubble: { position: 'absolute', left: 83, top: -5, width: 107, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffef6', borderWidth: 0.8, borderColor: '#d9d6cb', borderRadius: 10 },
  bubbleText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#9a9590' },
  sparkleA: { position: 'absolute', left: 7, top: 80 },
  sparkleB: { position: 'absolute', left: 241, top: 17 },
  heart: { position: 'absolute', left: 226, top: 108 },
  heading: { fontFamily: fonts.pixel, fontSize: 23, lineHeight: 32, color: '#657383', textAlign: 'center', marginTop: 18 },
  subheading: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#9b9ca5', textAlign: 'center', marginTop: 9 },
  fields: { gap: 22, marginTop: 38 },
  forgot: { alignSelf: 'flex-end', marginTop: 16 },
  forgotText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: '#a38aaf' },
  errorText: { fontFamily: fonts.body, fontSize: 12, color: '#c0526b', marginTop: 12 },
  resendText: { fontFamily: fonts.body, fontSize: 12, color: '#9278a6', textDecorationLine: 'underline', marginTop: 8 },
  noticeText: { fontFamily: fonts.body, fontSize: 12, color: '#6f8f5f', marginTop: 12 },
  submit: { marginTop: 24 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, marginTop: 28 },
  switchHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#ac9bb4' },
  switchLink: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 17, color: '#9278a6', textDecorationLine: 'underline' },
  divider: { height: 0.7, backgroundColor: '#e8e1d7', marginTop: 28 },
  browseHint: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a9a8a0', textAlign: 'center', marginTop: 24 },
  browse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  browseText: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: '#91a17f' },
});
