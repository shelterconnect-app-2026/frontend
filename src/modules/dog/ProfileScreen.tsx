import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useImage } from '@shopify/react-native-skia';
import { ChevronLeft, Heart } from 'lucide-react-native';
// Same cross-module reuse as ChatScreen — see the comment there.
import { dogWalkAtlas } from '../game/core/assets/dog/dogWalkAtlas';
import { fonts } from '../../shared/lib/fonts';
import { RemoteImage } from '../../shared/ui/RemoteImage';
import { formatBirthDate } from './birthDate';
import { DogSprite } from './console/DogSprite';
import { useDogProfile } from './hooks/useDogProfile';
import { useDogSaved } from './hooks/useDogSaved';
import { displayDogName, withKoreanConjunction } from './displayDogName';
import { displayDogIntroduction } from './displayDogIntroduction';
import { Clip, HeartSticker, PawSticker, Sparkle, Tape, Ticket } from './profile/Decor';
import type { RootStackParamList } from '../../app/navigation';

const SEX_LABEL: Record<string, string> = { MALE: '남아', FEMALE: '여아', UNKNOWN: '성별 미확인' };
const TAG_ICONS = ['♡', '✿', '♧', 'ϟ'];

// "친구의 프로필" (design: puppy-profile.html .dog-profile): a clipboard with a paper form — polaroid portrait,
// dashed fact rows, trait tags, a memo with a second polaroid — then 두부와 대화하기. Everything shown is
// the backend's (GET /v1/dogs/{id}, /photos) plus what the chat gathered; the design's 건강상태·활동성 meters
// have no API behind them, so only the shelter's own traitLabels are shown as tags.
export function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const dogName = displayDogName(params.dogName);
  const dogSheet = useImage(dogWalkAtlas);
  const state = useDogProfile(params.dogId);
  const dogSaved = useDogSaved(params.dogId);
  const [showRealPhoto, setShowRealPhoto] = useState(true);

  const body = (() => {
    if (state.status === 'loading') {
      return <ActivityIndicator style={styles.center} />;
    }
    if (state.status === 'error') {
      return <Text style={[styles.error, styles.center]}>프로필을 못 불러왔어요: {state.message}</Text>;
    }
    const { profile, photos } = state;
    const firstPhoto = photos.status === 'ready' ? photos.photos[0] ?? null : null;
    const showPhoto = showRealPhoto && firstPhoto;
    const facts: [string, string][] = [
      ['보호소', params.shelterName || '보호소'],
      ['성별 · 나이', `${SEX_LABEL[profile.sex]} · ${formatBirthDate(profile)}`],
      ['품종', profile.breed ?? '아직 기록 없음'],
      ['체중 · 중성화', `${profile.weightKg != null ? `${profile.weightKg}kg` : '체중 기록 없음'} · ${profile.neutered === true ? '중성화 완료' : profile.neutered === false ? '미실시' : '미확인'}`],
    ];
    return (
      <View style={styles.board}>
        <Clip />
        <View style={styles.paper}>
          <View style={styles.topline}>
            <HeartSticker />
            <View style={styles.titleWrap}>
              <Text style={styles.title}>PUPPY</Text>
              <Text style={styles.titleSub}>CONNECT</Text>
            </View>
            <Ticket />
          </View>

          <View style={styles.intro}>
            <View style={styles.portraitCol}>
              <View style={styles.portrait}>
                <Tape />
                <Text style={styles.photoNote}>나랑 친구할래? ↘</Text>
                <View style={styles.portraitImage}>
                  {showPhoto ? <RemoteImage url={showPhoto.url} width={118} height={137} radius={2} /> : <DogSprite sheet={dogSheet} identityIndex={params.identityIndex} size={137} />}
                </View>
                <Text style={styles.portraitCaption}>HELLO, {profile.name.toUpperCase()} ♡</Text>
              </View>
              {photos.status === 'ready' && photos.photos.length > 0 && (
                <View style={styles.switchRow}>
                  <Pressable style={[styles.switchPill, !showRealPhoto && styles.switchPillOn]} onPress={() => setShowRealPhoto(false)}>
                    <Text style={styles.switchText}>도트</Text>
                  </Pressable>
                  <Pressable style={[styles.switchPill, showRealPhoto && styles.switchPillOn]} onPress={() => setShowRealPhoto(true)}>
                    <Text style={styles.switchText}>사진</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.facts}>
              <View style={[styles.factRow, styles.nameRow]}>
                <Text style={styles.factLabel}>이름</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name}
                </Text>
              </View>
              {facts.map(([label, value]) => (
                <View key={label} style={styles.factRow}>
                  <Text style={styles.factLabel}>{label}</Text>
                  <Text style={styles.factValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {photos.status === 'locked' && <Text style={styles.note}>실제 사진은 대화를 나눈 뒤에 열려요. 조금 더 이야기해 볼까요?</Text>}
          {photos.status === 'error' && <Text style={styles.note}>사진을 못 불러왔어요: {photos.message}</Text>}

          <View style={styles.divider}>
            <Sparkle />
            <Text style={styles.dividerText}>조금씩, 나를 알아가 줘!</Text>
            <PawSticker />
          </View>

          {profile.traitLabels.length > 0 && (
            <View style={styles.traits}>
              <View style={styles.traitsHead}>
                <Text style={styles.traitsHeart}>♡</Text>
                <Text style={styles.traitsTitle}>성향정보</Text>
                <Text style={styles.traitsSub}>ABOUT ME</Text>
              </View>
              <View style={styles.tags}>
                {profile.traitLabels.map((label, index) => (
                  <View key={label} style={styles.tag}>
                    <Text style={styles.tagIcon}>{TAG_ICONS[index % TAG_ICONS.length]}</Text>
                    <Text style={styles.tagText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.memo}>
            <View style={styles.notes}>
              <Text style={styles.notesTitle}>우리, 이렇게 친해져요</Text>
              <Text style={styles.notesText}>{displayDogIntroduction(profile.introduction, profile.name)}</Text>
              <Text style={styles.handHeart}>♡</Text>
            </View>
            <View style={styles.polaroid}>
              <View style={styles.polaroidScene}>
                <View style={styles.polaroidCloud} />
                <View style={styles.polaroidDog}>
                  <DogSprite sheet={dogSheet} identityIndex={params.identityIndex} size={83} />
                </View>
              </View>
              <Text style={styles.polaroidCaption}>너랑 걷고 싶어 ♪</Text>
            </View>
          </View>

          {params.knownFacts.length > 0 && (
            <Section title="우리 대화에서 알아본 것">
              {params.knownFacts.map((fact, i) => (
                <Text key={i} style={styles.item}>
                  · {fact}
                </Text>
              ))}
            </Section>
          )}
          {params.pendingQuestions.length > 0 && (
            <Section title="아직 확인할 이야기">
              {params.pendingQuestions.map((question, i) => (
                <Text key={i} style={styles.item}>
                  · {question}
                </Text>
              ))}
            </Section>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{(params.shelterName || 'SHELTER').toUpperCase()} · FRIEND RECORD</Text>
            <Text style={styles.footerText}>01</Text>
          </View>
        </View>
        <View style={[styles.sideTab, { top: 140 }]} />
        <View style={[styles.sideTab, { bottom: 90 }]} />
      </View>
    );
  })();

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="profileBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#dcedf5" />
            <Stop offset="0.5" stopColor="#f6f4ec" />
            <Stop offset="1" stopColor="#fcf9f0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#profileBg)" />
      </Svg>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.nav}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="돌아가기">
            <ChevronLeft size={18} color="#7b8d99" strokeWidth={2} />
          </Pressable>
          <Text style={styles.navTitle}>친구의 프로필</Text>
          <Pressable onPress={() => dogSaved.toggle()} hitSlop={10} accessibilityLabel={dogSaved.saved ? '저장 취소' : '저장하기'}>
            <Heart size={28} color={dogSaved.saved ? '#df78a3' : '#b28bc4'} fill={dogSaved.saved ? '#df78a3' : 'none'} strokeWidth={1.8} />
          </Pressable>
        </View>
        <Text style={styles.lead}>하나씩, 천천히 알아가요.</Text>

        {body}

        <Pressable style={styles.talk} onPress={() => navigation.goBack()}>
          <Text style={styles.talkText}>{withKoreanConjunction(dogName)} 대화하기</Text>
          <Text style={styles.talkArrow}>↗</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const INK = '#655143';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e4f2fa' },
  content: { paddingHorizontal: 22 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#cfe1e7' },
  navTitle: { flex: 1, marginLeft: 16, fontFamily: fonts.pixel, fontSize: 22, color: '#5e7383' },
  lead: { fontFamily: fonts.body, fontSize: 12, color: '#9aa9b3', marginTop: 16 },
  center: { marginTop: 80 },
  error: { fontFamily: fonts.body, fontSize: 13, color: '#c0526b', textAlign: 'center' },
  board: { marginTop: 56, padding: 10, paddingTop: 12, paddingBottom: 14, backgroundColor: '#cfb38a', borderWidth: 1.5, borderColor: '#a58969', borderRadius: 28, transform: [{ rotate: '-1.5deg' }], shadowColor: '#a58661', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 7 } },
  paper: { overflow: 'hidden', minHeight: 680, paddingHorizontal: 17, paddingTop: 16, paddingBottom: 13, backgroundColor: '#fffcef', borderWidth: 1, borderColor: '#c2a887', borderRadius: 22 },
  topline: { height: 83, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { alignItems: 'center', transform: [{ rotate: '2deg' }], marginTop: 10 },
  title: { fontFamily: fonts.pixel, fontSize: 32, lineHeight: 34, color: '#369dbf', letterSpacing: -1 },
  titleSub: { fontFamily: fonts.pixel, fontSize: 13, letterSpacing: 3, color: '#369dbf' },
  intro: { flexDirection: 'row', gap: 12, marginTop: 5, marginHorizontal: -2 },
  portraitCol: { width: '44%', alignItems: 'center' },
  portrait: { alignSelf: 'stretch', marginTop: 6, paddingTop: 18, paddingBottom: 12, paddingHorizontal: 2, alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f4f0e9', transform: [{ rotate: '-4deg' }], shadowColor: '#5c4c44', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 3, height: 5 } },
  photoNote: { alignSelf: 'flex-end', marginRight: 6, fontFamily: fonts.body, fontSize: 9, color: '#759db2', transform: [{ rotate: '-5deg' }] },
  portraitImage: { width: 118, height: 137, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  portraitCaption: { fontFamily: fonts.pixel, fontSize: 8, letterSpacing: 0.6, color: '#92786b', paddingTop: 6 },
  switchRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  switchPill: { height: 24, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#f6f0e4', borderWidth: 1, borderColor: '#e5d9c9', borderRadius: 12 },
  switchPillOn: { backgroundColor: '#f8d9b0', borderColor: '#d29566' },
  switchText: { fontFamily: fonts.pixel, fontSize: 9.5, color: '#786454' },
  facts: { flex: 1, marginTop: 3 },
  factRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: '#a78276', borderStyle: 'dashed' },
  nameRow: { minHeight: 42 },
  factLabel: { width: 54, fontFamily: fonts.pixel, fontSize: 9, color: '#97685f' },
  factValue: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: '#5c5144', letterSpacing: -0.4 },
  name: { flex: 1, fontFamily: fonts.pixel, fontSize: 20, color: '#5c5144' },
  note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: '#a58473', marginTop: 12, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 58, marginTop: 7 },
  dividerText: { fontFamily: fonts.body, fontSize: 11.5, color: '#a58473' },
  traits: { paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#a78276', borderStyle: 'dashed' },
  traitsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  traitsHeart: { fontSize: 23, lineHeight: 26, color: '#dc8c63' },
  traitsTitle: { fontFamily: fonts.pixel, fontSize: 17, color: '#775b4c', letterSpacing: -0.8 },
  traitsSub: { marginLeft: 'auto', fontFamily: fonts.pixel, fontSize: 8, letterSpacing: 1, color: '#ad9b81' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 9, backgroundColor: '#f6f0e4', borderWidth: 1, borderColor: '#e5d9c9', borderRadius: 15 },
  tagIcon: { fontSize: 13, color: '#d29566' },
  tagText: { fontFamily: fonts.body, fontSize: 11, color: '#786454' },
  memo: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 22, paddingBottom: 12, minHeight: 150 },
  notes: { flex: 1, alignSelf: 'flex-start', paddingTop: 5 },
  notesTitle: { fontFamily: fonts.pixel, fontSize: 12, color: '#95815e', marginBottom: 12 },
  notesText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 25, color: '#807160' },
  handHeart: { marginLeft: '75%', fontSize: 23, color: '#cc9774', transform: [{ rotate: '12deg' }] },
  polaroid: { width: 93, padding: 6, paddingBottom: 9, marginTop: 5, backgroundColor: '#ffffff', transform: [{ rotate: '12deg' }], shadowColor: '#65543a', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 3, height: 4 } },
  polaroidScene: { height: 92, overflow: 'hidden', backgroundColor: '#a5deec', justifyContent: 'flex-end' },
  polaroidCloud: { position: 'absolute', top: 13, right: 7, width: 30, height: 10, borderRadius: 10, backgroundColor: '#fffff2' },
  polaroidDog: { position: 'absolute', bottom: 0, left: 0, width: 83, height: 83 },
  polaroidCaption: { fontFamily: fonts.body, fontSize: 8, color: '#9a8d7b', paddingTop: 8, textAlign: 'center' },
  section: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e9decc', gap: 6 },
  sectionTitle: { fontFamily: fonts.pixel, fontSize: 12, color: '#95815e', marginBottom: 4 },
  item: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, color: INK },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#e9decc' },
  footerText: { fontFamily: fonts.pixel, fontSize: 7, letterSpacing: 0.4, color: '#b5a18b' },
  sideTab: { position: 'absolute', left: -6, width: 9, height: 40, backgroundColor: '#83c6dd', borderWidth: 1, borderColor: '#74a0ae', borderTopLeftRadius: 3, borderBottomLeftRadius: 3, zIndex: -1 },
  talk: { height: 54, marginTop: 30, marginHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: '#e5d9f0', borderWidth: 1, borderColor: '#b9a6ca', borderRadius: 14, shadowColor: '#c5b6cf', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 3 } },
  talkText: { fontFamily: fonts.pixel, fontSize: 15, color: '#6c5483' },
  talkArrow: { fontSize: 22, color: '#6c5483' },
});
