import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Canvas, useImage } from '@shopify/react-native-skia';
// Same cross-module reuse as ChatScreen/HomeScreen — the dot-sprite is this screen's UX too.
import { SpriteFrame } from '../game/core/entities/SpriteFrame';
import { DOG_FRAME_SIZE, dogIdleRow, dogWalkAtlas } from '../game/core/assets/dog/dogWalkAtlas';
import { fonts } from '../../shared/lib/fonts';
import { SvgIcon } from '../../shared/ui/SvgIcon';
import { SortButton } from '../../shared/ui/SortButton';
import { SAVED_SORTS, sortSavedDogs, type SavedSort } from './savedSort';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { svgAssets } from './assets/svgAssets';
import { fetchDog } from './api/shelters';
import { unsaveDog } from './api/savedDogs';
import { useSavedDogsList } from './hooks/useSavedDogs';
import { displayDogIntroduction } from './displayDogIntroduction';
import type { HomeTabScreenNavigationProp } from '../../app/navigation';
import type { SavedDog } from './types';

const PORTRAIT_THEMES = [
  { scene: '#f0ebdd', ground: '#e0e8cb', chip: '#f0f1e3' },
  { scene: '#e5ede0', ground: '#d7e6d0', chip: '#eaf0e5' },
];

// Figma "03 저장한 친구" (nodes 22:10300 목록 / 22:10746 빈 목록).
export function SavedFriendsScreen() {
  const navigation = useNavigation<HomeTabScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { state, removeLocally, reload } = useSavedDogsList(50);
  const [search, setSearch] = useState('');
  const [chattedOnly, setChattedOnly] = useState(false);
  const [sort, setSort] = useState<SavedSort>('RECENT');

  const dogs = useMemo(() => (state.status === 'ready' ? state.dogs : []), [state]);
  const chattedCount = dogs.filter(d => d.sessionId !== null).length;
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = dogs.filter(
      d =>
        (!chattedOnly || d.sessionId !== null) &&
        (!needle || d.dogName.toLowerCase().includes(needle) || d.shelterName.toLowerCase().includes(needle)),
    );
    return sortSavedDogs(filtered, sort);
  }, [dogs, search, chattedOnly, sort]);

  const unsave = async (dog: SavedDog) => {
    removeLocally(dog.dogId);
    try {
      await unsaveDog(dog.dogId);
    } catch {
      reload();
      Alert.alert('저장을 해제하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#dcf0f5" />
            <Stop offset="0.397" stopColor="#fcf9f0" />
            <Stop offset="1" stopColor="#fcf9f0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bg)" />
      </Svg>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>저장한 친구</Text>
          <View style={styles.titleCount}>
            <Text style={styles.titleCountText}>{dogs.length}</Text>
          </View>
          <View style={styles.titleDeco}>
            <SvgIcon xml={svgAssets.savedHeart24} width={24} height={24} />
            <SvgIcon xml={svgAssets.star6} width={6} height={6} style={styles.titleStar} />
          </View>
        </View>
        <Text style={styles.subtitle}>다시 만나고 싶은 친구들을 모아뒀어요.</Text>

        <View style={styles.searchBox}>
          <SvgIcon xml={svgAssets.search18} width={18} height={19} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="이름이나 보호소로 찾아보기"
            placeholderTextColor="#aaa4ae"
            returnKeyType="search"
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable style={[styles.chip, !chattedOnly && styles.chipSelected]} onPress={() => setChattedOnly(false)}>
            <Text style={[styles.chipText, !chattedOnly && styles.chipTextSelected]}>전체</Text>
          </Pressable>
          <Pressable style={[styles.chip, chattedOnly && styles.chipSelected]} onPress={() => setChattedOnly(true)}>
            <Text style={[styles.chipText, chattedOnly && styles.chipTextSelected]}>대화한 친구</Text>
            <View style={styles.chipCount}>
              <Text style={styles.chipCountText}>{chattedCount}</Text>
            </View>
          </Pressable>
          <View style={styles.sortLabel}>
            <SortButton options={SAVED_SORTS} value={sort} onChange={setSort} />
          </View>
        </View>

        {state.status === 'loading' && <ActivityIndicator style={styles.gap} />}
        {state.status === 'error' && (
          <View style={styles.gap}>
            <ConnectionErrorView message="친구 목록을 불러오지 못했어요." onRetry={reload} />
          </View>
        )}

        {state.status === 'anon' && (
          <EmptyState
            title="로그인이 필요해요"
            lines={['로그인하면 마음에 담은 친구를', '여기서 다시 만날 수 있어요.']}
            action="로그인하기"
            onAction={() => navigation.navigate('LoginGuide')}
          />
        )}
        {state.status === 'ready' && dogs.length === 0 && (
          <EmptyState
            title="아직 저장한 친구가 없어요"
            lines={['마음이 가는 친구의 하트를 눌러주세요.', '다음에도 여기서 다시 만날 수 있어요.']}
            action="보호소에서 친구 만나기"
            onAction={() => navigation.navigate('보호소')}
          />
        )}
        {state.status === 'ready' && dogs.length > 0 && visible.length === 0 && (
          <Text style={[styles.hintText, styles.gap]}>조건에 맞는 친구가 없어요</Text>
        )}

        {visible.map(dog => (
          <FriendCard
            key={dog.dogId}
            dog={dog}
            index={dogs.indexOf(dog)}
            onUnsave={() => unsave(dog)}
            onProfile={() =>
              navigation.navigate('Profile', {
                dogId: dog.dogId,
                dogName: dog.dogName,
                identityIndex: dogs.indexOf(dog) % 3,
                shelterName: dog.shelterName,
                knownFacts: [],
                pendingQuestions: [],
              })
            }
            onChat={() =>
              navigation.navigate('Chat', {
                dogId: dog.dogId,
                dogName: dog.dogName,
                identityIndex: dogs.indexOf(dog) % 3,
                shelterName: dog.shelterName,
                sessionId: dog.sessionId ?? undefined,
              })
            }
          />
        ))}

        <View style={styles.footer}>
          <SvgIcon xml={svgAssets.savedHeart10} width={10} height={10} />
          <Text style={styles.footerText}>보호소가 달라도, 저장한 친구는 여기서 만나요.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({ title, lines, action, onAction }: { title: string; lines: string[]; action: string; onAction: () => void }) {
  return (
    <View style={styles.empty}>
      <SvgIcon xml={svgAssets.savedHeart42} width={42} height={42} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <View>
        {lines.map(line => (
          <Text key={line} style={styles.emptyLine}>
            {line}
          </Text>
        ))}
      </View>
      <Pressable style={styles.emptyButton} onPress={onAction}>
        <Text style={styles.profileButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

interface FriendCardProps {
  dog: SavedDog;
  index: number;
  onUnsave: () => void;
  onProfile: () => void;
  onChat: () => void;
}

// Figma "Card / Saved friend" (22:10187). 이름·보호소는 저장 목록에서, 성향·소개는 강아지
// 프로필 조회(`/v1/dogs/{id}`)에서 — 목록 응답에는 없다. 그림은 앱 도트 placeholder.
function FriendCard({ dog, index, onUnsave, onProfile, onChat }: FriendCardProps) {
  const dogSheet = useImage(dogWalkAtlas);
  const theme = PORTRAIT_THEMES[index % PORTRAIT_THEMES.length];
  const [trait, setTrait] = useState<string | null>(null);
  const [intro, setIntro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDog(dog.dogId).then(
      ({ data }) => {
        if (!cancelled) {
          setTrait(data.traitLabels[0] ?? null);
          setIntro(displayDogIntroduction(data.introduction, data.name));
        }
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [dog.dogId]);

  return (
    <View style={styles.card}>
      <View style={[styles.portrait, { backgroundColor: theme.scene }]}>
        <View style={[styles.ground, { backgroundColor: theme.ground }]} />
        <View style={[styles.pixelCloud, styles.cloudALow]} />
        <View style={[styles.pixelCloud, styles.cloudAHigh]} />
        <View style={[styles.pixelCloud, styles.cloudBLow]} />
        <View style={[styles.pixelCloud, styles.cloudBHigh]} />
        <SvgIcon xml={svgAssets.star6} width={6} height={6} style={styles.groundStarA} />
        <SvgIcon xml={svgAssets.star4} width={4} height={4} style={styles.groundStarB} />
        <SvgIcon xml={svgAssets.friendShadow} width={86} height={9} style={styles.groundShadow} />
        <Canvas style={styles.portraitDog}>
          {dogSheet && <SpriteFrame sheet={dogSheet} frameSize={DOG_FRAME_SIZE} col={0} row={dogIdleRow(index)} x={0} y={0} size={96} />}
        </Canvas>
      </View>

      <Text style={styles.cardName} numberOfLines={1}>
        {dog.dogName}
      </Text>
      <Pressable style={styles.unsaveButton} onPress={onUnsave} hitSlop={8}>
        <SvgIcon xml={svgAssets.savedHeart17} width={17} height={17} />
      </Pressable>
      <View style={styles.shelterRow}>
        <SvgIcon xml={svgAssets.house11} width={11} height={11} />
        <Text style={styles.shelterText} numberOfLines={1}>
          {dog.shelterName}
        </Text>
      </View>
      {trait && (
        <View style={[styles.traitChip, { backgroundColor: theme.chip }]}>
          <Text style={styles.traitText}>{trait}</Text>
        </View>
      )}
      {intro && (
        <Text style={styles.introText} numberOfLines={3}>
          {intro}
        </Text>
      )}

      <SvgIcon xml={svgAssets.dottedDivider} width="100%" height={0.7} style={styles.divider} />
      <View style={styles.actions}>
        <Pressable style={styles.profileButton} onPress={onProfile} hitSlop={{ top: 4, bottom: 4 }}>
          <Text style={styles.profileButtonText}>프로필 보기</Text>
        </Pressable>
        <Pressable style={styles.chatButton} onPress={onChat} hitSlop={{ top: 4, bottom: 4 }}>
          <SvgIcon xml={svgAssets.chat13} width={13} height={13} />
          <Text style={styles.chatButtonText}>{dog.sessionId ? '대화 이어가기' : '대화하기'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  titleRow: { flexDirection: 'row', alignItems: 'center', height: 41 },
  title: { fontFamily: fonts.pixel, fontSize: 29, lineHeight: 41, color: '#576d7e' },
  titleCount: { marginLeft: 9, width: 27, height: 27, borderRadius: 12, backgroundColor: '#efe1e9', alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  titleCountText: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: '#ae899e' },
  titleDeco: { flex: 1, alignItems: 'flex-end', marginTop: 9 },
  titleStar: { position: 'absolute', right: -2, top: -7 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#82959e', marginTop: 8, marginLeft: 1 },
  searchBox: {
    marginTop: 28,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 17,
    backgroundColor: '#fffefa',
    borderWidth: 1,
    borderColor: '#dddcd9',
    borderRadius: 13,
  },
  searchInput: { flex: 1, padding: 0, fontFamily: fonts.body, fontSize: 12, color: '#6b6878' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 24 },
  chip: {
    height: 32,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#fffef9',
    borderWidth: 0.8,
    borderColor: '#e4ded8',
    borderRadius: 13,
  },
  chipSelected: { backgroundColor: '#ede2f3', borderColor: '#d0bce0', paddingHorizontal: 14 },
  chipText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#99929e' },
  chipTextSelected: { color: '#8c749f' },
  chipCount: { width: 17, height: 17, borderRadius: 8, backgroundColor: '#f0eaf3', alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#a591b0' },
  sortLabel: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
  gap: { marginTop: 16 },
  hintText: { fontFamily: fonts.body, fontSize: 12, color: '#a1998e', textAlign: 'center' },
  card: {
    height: 244,
    marginBottom: 16,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 20,
    shadowColor: '#495e70',
    shadowOpacity: 0.06,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 4 },
  },
  portrait: { position: 'absolute', left: 15, top: 15, width: 132, height: 146, borderRadius: 13, borderWidth: 0.5, borderColor: '#e8e5d8', overflow: 'hidden' },
  ground: { position: 'absolute', left: -0.5, top: 106.5, width: 132, height: 39 },
  pixelCloud: { position: 'absolute', backgroundColor: '#fffbeb' },
  cloudALow: { left: 11.5, top: 31.5, width: 15, height: 4 },
  cloudAHigh: { left: 15.5, top: 28.5, width: 6, height: 7 },
  cloudBLow: { left: 101.5, top: 50.5, width: 15, height: 4 },
  cloudBHigh: { left: 105.5, top: 47.5, width: 6, height: 7 },
  groundStarA: { position: 'absolute', left: 13.5, top: 117.5 },
  groundStarB: { position: 'absolute', left: 113.5, top: 127.5 },
  groundShadow: { position: 'absolute', left: 22.5, top: 124.5 },
  portraitDog: { position: 'absolute', left: 18, top: 30, width: 96, height: 96 },
  cardName: { position: 'absolute', left: 163, right: 62, top: 19, fontFamily: fonts.pixel, fontSize: 22, lineHeight: 31, color: '#6b6878' },
  unsaveButton: { position: 'absolute', right: 13, top: 13, width: 37, height: 37, borderRadius: 12, backgroundColor: '#fbf0f2', alignItems: 'center', justifyContent: 'center' },
  shelterRow: { position: 'absolute', left: 164, right: 15, top: 55, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shelterText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: '#a09591' },
  traitChip: { position: 'absolute', left: 163, top: 82, height: 25, paddingHorizontal: 11, borderRadius: 10, justifyContent: 'center' },
  traitText: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 14, color: '#96a17f' },
  introText: { position: 'absolute', left: 163, right: 15, top: 120, fontFamily: fonts.body, fontSize: 11, lineHeight: 18, color: '#9a9195' },
  divider: { position: 'absolute', left: 16, right: 18, top: 180 },
  actions: { position: 'absolute', left: 15, right: 15, top: 192, height: 36, flexDirection: 'row', gap: 12 },
  profileButton: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ddd2e3', borderRadius: 10 },
  profileButtonText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#98859e' },
  chatButton: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    backgroundColor: '#e8ddf0',
    borderWidth: 1,
    borderColor: '#c3afcf',
    borderRadius: 10,
    shadowColor: '#bda9c9',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  chatButtonText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#846d95' },
  empty: {
    height: 320,
    marginTop: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 20,
  },
  emptyTitle: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 25, color: '#7d708b' },
  emptyLine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#a0959b', textAlign: 'center' },
  emptyButton: { width: 240, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ddd2e3', borderRadius: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 25, marginTop: 8 },
  footerText: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#aea0a6' },
});
