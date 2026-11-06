import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, ChevronDown, Heart, MoreHorizontal, Send, X } from 'lucide-react-native';
import { Skia } from '@shopify/react-native-skia';
import { fetchDogAssets } from './api/shelters';
import { GardenScene, type GardenDogArt } from './garden/GardenScene';
import { fonts } from '../../shared/lib/fonts';
import { TOPICS } from './console/topics';
import { useDogChat } from './hooks/useDogChat';
import { useDogSaved } from './hooks/useDogSaved';
import type { RootStackParamList } from '../../app/navigation';

/** The approved “둘만의 정원” conversation surface, using the selected dog's real sprite. */
export function ChatScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { state, send, retrySend } = useDogChat(params.dogId);
  const dogSaved = useDogSaved(params.dogId);
  const [dogArt, setDogArt] = useState<GardenDogArt | null>(null);
  const [artLoaded, setArtLoaded] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const [history, setHistory] = useState(false);
  const [dialogueIndex, setDialogueIndex] = useState<number | null>(null);
  const [talking, setTalking] = useState(false);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Decode signed art immediately; the image remains usable after the URL expires.
  useEffect(() => {
    let cancelled = false;
    setArtLoaded(false);
    setDogArt(null);
    (async () => {
      try {
        const { data: manifest } = await fetchDogAssets(params.dogId);
        const clip = manifest.mapDirections?.DOWN?.IDLE ?? manifest.animations.IDLE;
        if (!clip?.frames.length) return;
        const encoded = await Skia.Data.fromURI(clip.spritesheetUrl);
        const image = Skia.Image.MakeImageFromEncoded(encoded);
        if (!cancelled && image) setDogArt({ image, clip });
      } catch {
        // An unavailable sprite should never be replaced with a different dog's art.
      } finally {
        if (!cancelled) setArtLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [params.dogId]);

  useEffect(() => {
    if (!dogArt || dogArt.clip.frames.length < 2) return;
    const duration = dogArt.clip.frames[0]?.durationMs ?? 250;
    const timer = setInterval(() => setFrameIndex(index => (index + 1) % dogArt.clip.frames.length), Math.max(90, duration));
    return () => clearInterval(timer);
  }, [dogArt]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const ready = state.status === 'ready';
  const messages = ready ? state.messages : [];
  const replies = messages.filter(message => message.role === 'ASSISTANT');
  const selectedReply = replies[dialogueIndex ?? replies.length - 1];
  const lastQuestion = [...messages].reverse().find(message => message.role === 'USER');
  const canSend = ready && state.session.canSend;
  const sending = ready && state.sending;
  const needsLogin = state.status === 'error' && (state.code === 'UNAUTHENTICATED' || state.code === 'ACCOUNT_NOT_REGISTERED');
  const loading = state.status === 'loading' || !artLoaded;
  const showDialogue = talking || replies.length > 0;

  const openProfile = () => {
    setMenu(false);
    navigation.navigate('Profile', {
      dogId: params.dogId, dogName: params.dogName, identityIndex: params.identityIndex,
      shelterName: params.shelterName, knownFacts: replies.map(message => message.text), pendingQuestions,
    });
  };
  const submit = (message = draft) => {
    const text = message.trim();
    if (!text || !canSend || sending) return;
    send(text);
    setDraft('');
    setDialogueIndex(null);
    setMenu(false);
    setHistory(false);
  };
  const toggleSave = async () => {
    setMenu(false);
    if (dogSaved.needsLogin) { navigation.navigate('LoginGuide'); return; }
    const wasSaved = dogSaved.saved;
    await dogSaved.toggle();
    setToast(wasSaved ? '저장을 취소했어요' : '저장한 친구에 추가했어요');
  };

  let dialogue = selectedReply?.text ?? params.dogName + '와 어떤 이야기를 나눌까?';
  if (sending) dialogue = '잠깐만, 이야기를 생각하고 있어…';
  if (state.status === 'error') dialogue = needsLogin ? '로그인하면 이야기를 나눌 수 있어.' : '대화를 불러오지 못했어. 다시 들어와 줄래?';

  return (
    <View style={styles.root}>
      <GardenScene width={width} height={height} dog={dogArt} frameIndex={frameIndex} loading={loading} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <Pressable style={[styles.loadingBack, { top: insets.top + 12 }]} onPress={() => navigation.goBack()} accessibilityLabel="뒤로가기">
            <ArrowLeft size={24} color="#4d5a3a" />
          </Pressable>
        ) : (
          <>
            <View style={[styles.header, { marginTop: insets.top + 8 }]}>
              <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="뒤로가기" hitSlop={12}>
                <ArrowLeft size={25} color="#4d5a3a" />
              </Pressable>
              <Text style={styles.headerTitle}>둘만의 정원</Text>
              <Pressable style={styles.headerButton} onPress={() => setMenu(value => !value)} accessibilityLabel="대화 메뉴" hitSlop={12}>
                <MoreHorizontal size={26} color="#4d5a3a" />
              </Pressable>
            </View>
            {!dogArt && <Text style={styles.artUnavailable}>이 친구의 도트를 준비하고 있어요</Text>}
            {menu && (
              <View style={[styles.menu, { top: insets.top + 72 }]}>
                <Pressable style={styles.menuRow} onPress={() => { setHistory(true); setMenu(false); }}><Text style={styles.menuText}>지난 이야기 보기</Text></Pressable>
                <Pressable style={styles.menuRow} onPress={openProfile}><BookOpen size={17} color="#4e5c3c" /><Text style={styles.menuText}>소개서 보기</Text></Pressable>
                <Pressable style={styles.menuRow} onPress={toggleSave}><Heart size={17} color="#4e5c3c" fill={dogSaved.saved ? '#4e5c3c' : 'none'} /><Text style={styles.menuText}>{dogSaved.saved ? '저장 취소' : '저장한 친구로'}</Text></Pressable>
                <View style={styles.menuDivider} />
                {TOPICS.map(topic => <Pressable key={topic.key} style={styles.menuRow} onPress={() => submit(topic.prompt)} disabled={!canSend || sending}><Text style={styles.menuText}>{topic.chatLabel}</Text></Pressable>)}
              </View>
            )}
            {history && (
              <View style={[styles.history, { top: insets.top + 76, bottom: insets.bottom + 230 }]}>
                <View style={styles.historyHeading}><Text style={styles.historyTitle}>지난 이야기</Text><Pressable onPress={() => setHistory(false)} accessibilityLabel="대화 기록 닫기"><X size={22} color="#4c593c" /></Pressable></View>
                <ScrollView contentContainerStyle={styles.historyContent}>
                  {messages.length === 0 && <Text style={styles.historyEmpty}>아직 나눈 이야기가 없어요.</Text>}
                  {messages.map(message => <View key={message.id} style={[styles.historyMessage, message.role === 'USER' && styles.historyMine]}><Text style={styles.historySpeaker}>{message.role === 'USER' ? '나' : params.dogName}</Text><Text style={styles.historyBody}>{message.text}</Text></View>)}
                </ScrollView>
              </View>
            )}
            {showDialogue ? <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <View style={styles.dialogueCard}>
                <View style={styles.nameplate}><Text style={styles.nameplateText}>{params.dogName}</Text></View>
                <ScrollView style={styles.dialogueScroll} contentContainerStyle={styles.dialogueContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.dialogueText}>{dialogue}</Text>
                </ScrollView>
                {state.status === 'error' && needsLogin && <Pressable style={styles.loginButton} onPress={() => navigation.navigate('LoginGuide')}><Text style={styles.loginText}>로그인하기</Text></Pressable>}
                {replies.length > 1 && <Pressable style={styles.nextButton} onPress={() => setDialogueIndex(index => index === null ? 0 : (index + 1) % replies.length)} accessibilityLabel="다른 대화 보기"><ChevronDown size={25} color="#7d8750" fill="#7d8750" /></Pressable>}
              </View>
              {ready && state.sendError && <View style={styles.errorRow}><Text style={styles.errorText}>{state.sendError}</Text>{state.retryableMessageId && <Pressable onPress={retrySend}><Text style={styles.errorRetry}>다시 시도</Text></Pressable>}</View>}
              {selectedReply?.needsShelterConfirmation && lastQuestion && <Pressable style={styles.confirmButton} onPress={() => setPendingQuestions(previous => previous.includes(lastQuestion.text) ? previous : [...previous, lastQuestion.text])} disabled={pendingQuestions.includes(lastQuestion.text)}><Text style={styles.confirmText}>{pendingQuestions.includes(lastQuestion.text) ? '보호소 확인 질문에 담았어요' : '보호소에 확인할 질문으로 담기'}</Text></Pressable>}
              <View style={styles.composer}>
                <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder={params.dogName + '에게 답장하기…'} placeholderTextColor="#828572" editable={canSend && !sending} maxLength={300} returnKeyType="send" onSubmitEditing={() => submit()} accessibilityLabel="강아지에게 메시지 입력" />
                <Pressable style={[styles.sendButton, (!draft.trim() || !canSend || sending) && styles.sendDisabled]} onPress={() => submit()} disabled={!draft.trim() || !canSend || sending} accessibilityLabel="메시지 보내기"><Send size={20} color="#fff9e8" fill="#fff9e8" /></Pressable>
              </View>
            </View> : <View style={[styles.intro, { marginBottom: Math.max(insets.bottom, 14) + 20 }]}>
              <Text style={styles.introTitle}>{params.dogName}와 둘만의 시간</Text>
              <Text style={styles.introText}>가까이에서 천천히 이야기를 나눠봐요.</Text>
              <Pressable style={styles.talkButton} onPress={() => setTalking(true)} accessibilityLabel="강아지와 대화하기">
                <Text style={styles.talkButtonText}>대화하기</Text>
              </Pressable>
            </View>}
          </>
        )}
      </KeyboardAvoidingView>
      {loading && <View style={styles.loadingIndicator}><ActivityIndicator color="#718050" /><Text style={styles.loadingText}>잠시만 기다려 주세요</Text></View>}
      {toast && <View style={[styles.toast, { top: insets.top + 78 }]}><Text style={styles.toastText}>{toast}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#c9d98e' },
  screen: { flex: 1, justifyContent: 'space-between' },
  header: { height: 52, marginHorizontal: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,250,225,0.85)', borderWidth: 1, borderColor: '#e7d5a8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 42, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.pixel, fontSize: 17, color: '#3e4c30' },
  artUnavailable: { position: 'absolute', top: '44%', alignSelf: 'center', fontFamily: fonts.body, fontSize: 13, color: '#4b593a', backgroundColor: 'rgba(255,250,225,0.84)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9 },
  bottom: { paddingHorizontal: 18, gap: 11 },
  intro: { marginHorizontal: 24, padding: 20, borderRadius: 24, alignItems: 'center', backgroundColor: '#fcf4db', borderWidth: 2, borderColor: '#d9b977', shadowColor: '#52603c', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  introTitle: { fontFamily: fonts.pixelBold, fontSize: 18, color: '#3d4b31', marginBottom: 8 },
  introText: { fontFamily: fonts.body, fontSize: 14, color: '#536343', marginBottom: 16 },
  talkButton: { minWidth: 190, minHeight: 48, borderRadius: 24, backgroundColor: '#64774b', alignItems: 'center', justifyContent: 'center' },
  talkButtonText: { fontFamily: fonts.pixel, fontSize: 16, color: '#fff9e8' },
  dialogueCard: { minHeight: 136, maxHeight: 210, backgroundColor: '#fcf4db', borderRadius: 32, borderWidth: 2, borderColor: '#d9b977', paddingTop: 24, paddingBottom: 19, paddingHorizontal: 22, shadowColor: '#52603c', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  nameplate: { position: 'absolute', top: -16, left: 20, minWidth: 88, paddingHorizontal: 14, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#566942', borderColor: '#f9e7bc', borderWidth: 2, borderRadius: 8 },
  nameplateText: { fontFamily: fonts.pixel, fontSize: 14, color: '#fff9e9' },
  dialogueScroll: { maxHeight: 160 },
  dialogueContent: { paddingBottom: 5 },
  dialogueText: { fontFamily: fonts.body, fontSize: 17, lineHeight: 28, color: '#3b482d' },
  nextButton: { position: 'absolute', right: 23, bottom: 8, width: 38, height: 30, alignItems: 'center', justifyContent: 'center' },
  composer: { minHeight: 49, borderRadius: 30, borderWidth: 2, borderColor: '#d4bf8c', backgroundColor: '#fff9e8', flexDirection: 'row', alignItems: 'center', paddingLeft: 19, paddingRight: 5, shadowColor: '#53643c', shadowOpacity: 0.12, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  input: { flex: 1, height: 44, fontFamily: fonts.body, fontSize: 15, color: '#36452d', paddingVertical: 0 },
  sendButton: { width: 40, height: 38, borderRadius: 21, backgroundColor: '#7d8a53', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.55 },
  menu: { position: 'absolute', right: 17, width: 210, backgroundColor: '#fff8e7', borderColor: '#d3bd8d', borderWidth: 1, borderRadius: 15, padding: 5, zIndex: 10, shadowColor: '#435335', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  menuRow: { minHeight: 39, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuText: { fontFamily: fonts.body, fontSize: 14, color: '#3d4b31' },
  menuDivider: { height: 1, backgroundColor: '#e6dcc4', marginVertical: 5, marginHorizontal: 9 },
  history: { position: 'absolute', left: 18, right: 18, backgroundColor: '#fff8e7', borderColor: '#d3bd8d', borderWidth: 2, borderRadius: 22, zIndex: 9, overflow: 'hidden' },
  historyHeading: { minHeight: 50, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e6dcc4' },
  historyTitle: { fontFamily: fonts.pixel, fontSize: 16, color: '#405034' },
  historyContent: { padding: 14, gap: 10 },
  historyEmpty: { fontFamily: fonts.body, color: '#667159' },
  historyMessage: { padding: 10, borderRadius: 12, backgroundColor: '#f0ead2', alignSelf: 'flex-start', maxWidth: '90%' },
  historyMine: { backgroundColor: '#e3ebd0', alignSelf: 'flex-end' },
  historySpeaker: { fontFamily: fonts.pixel, fontSize: 11, color: '#576a44', marginBottom: 5 },
  historyBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: '#3c4c31' },
  errorRow: { backgroundColor: '#fff8e7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: '#7b3c38' },
  errorRetry: { fontFamily: fonts.pixel, fontSize: 12, color: '#6d793f' },
  confirmButton: { backgroundColor: '#fff8e7', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  confirmText: { fontFamily: fonts.body, color: '#4c6042', fontSize: 13 },
  loginButton: { marginTop: 7, alignSelf: 'flex-start' },
  loginText: { fontFamily: fonts.pixel, fontSize: 14, color: '#64773b', textDecorationLine: 'underline' },
  loadingBack: { position: 'absolute', left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loadingIndicator: { position: 'absolute', bottom: 108, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingText: { fontFamily: fonts.pixel, fontSize: 13, color: '#657852' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#fff8e7', borderColor: '#d3bd8d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { fontFamily: fonts.body, color: '#3c4b31' },
});
