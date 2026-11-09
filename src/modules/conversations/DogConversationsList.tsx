import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Canvas, useImage } from '@shopify/react-native-skia';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
// Same cross-module composition as the other tab screens: this screen stitches dog data,
// the dot sprite and shared UI together.
import { SpriteFrame } from '../game/core/entities/SpriteFrame';
import { DOG_FRAME_SIZE, dogIdleRow, dogWalkAtlas } from '../game/core/assets/dog/dogWalkAtlas';
import { fetchDog } from '../dog/api/shelters';
import { svgAssets as dogSvgAssets } from '../dog/assets/svgAssets';
import { useDogConversations } from '../dog/hooks/useDogConversations';
import { useSavedDogsList } from '../dog/hooks/useSavedDogs';
import type { DogConversation, SavedDog } from '../dog/types';
import { fonts } from '../../shared/lib/fonts';
import { formatRoomTime } from '../../shared/lib/chatTime';
import { SvgIcon } from '../../shared/ui/SvgIcon';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { SortButton } from '../../shared/ui/SortButton';
import { FilterRow, SearchBox } from './ListControls';
import { DOG_SORTS, sortDogConversations, type DogSort } from './listSort';
import type { HomeTabScreenNavigationProp } from '../../app/navigation';

const SCENES = [
  { scene: '#f0ebdd', ground: '#dfe7cf' },
  { scene: '#e5ede0', ground: '#dfe7cf' },
];

// Figma "04 대화 · 강아지" (pencil pM6TD 목록 / op6X3 빈 목록 / I9iwWd).
export function DogConversationsList() {
  const navigation = useNavigation<HomeTabScreenNavigationProp>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const [sort, setSort] = useState<DogSort>('RECENT');
  const { state, reload } = useDogConversations({ q: search, savedOnly: filter === 'saved' });
  const saved = useSavedDogsList(50);

  if (state.status === 'anon') {
    return (
      <EmptyCard
        title="로그인이 필요해요"
        lines={['로그인하면 강아지와 나눈 이야기를', '여기서 이어갈 수 있어요.']}
        action="로그인하기"
        onAction={() => navigation.navigate('LoginGuide')}
      />
    );
  }

  const conversations = state.status === 'ready' ? sortDogConversations(state.conversations, sort) : [];
  // 저장했지만 아직 말을 걸지 않은 친구 — "처음 나눌 이야기".
  const firstChats = saved.state.status === 'ready' ? saved.state.dogs.filter(d => d.sessionId === null) : [];
  const needle = search.trim().toLowerCase();
  const visibleFirstChats = firstChats.filter(d => !needle || d.dogName.toLowerCase().includes(needle) || d.shelterName.toLowerCase().includes(needle));

  return (
    <View>
      <SearchBox value={search} onChangeText={setSearch} placeholder="친구 이름이나 보호소로 찾아보기" />
      <FilterRow
        options={[
          { key: 'all', label: '전체 대화' },
          { key: 'saved', label: '저장한 친구' },
        ]}
        selected={filter}
        onSelect={key => setFilter(key as 'all' | 'saved')}
        sort={<SortButton options={DOG_SORTS} value={sort} onChange={setSort} />}
      />

      {state.status === 'loading' && <ActivityIndicator style={styles.gap} />}
      {state.status === 'error' && (
        <View style={styles.gap}>
          <ConnectionErrorView message="대화 목록을 불러오지 못했어요." onRetry={reload} />
        </View>
      )}

      {state.status === 'ready' && (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>나누던 이야기</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{conversations.length}</Text>
            </View>
          </View>

          {conversations.length === 0 ? (
            <EmptyCard
              title="아직 나눈 이야기가 없어요"
              lines={['마음에 드는 친구에게 인사해 보세요.']}
              action="보호소에서 친구 만나기"
              onAction={() => navigation.navigate('보호소')}
            />
          ) : (
            conversations.map((conversation, index) => (
              <ConversationCard
                key={conversation.sessionId}
                conversation={conversation}
                index={index}
                onPress={() =>
                  navigation.navigate('Chat', {
                    dogId: conversation.dogId,
                    dogName: conversation.dogName,
                    identityIndex: index % 3,
                    shelterName: conversation.shelterName,
                    sessionId: conversation.sessionId,
                  })
                }
              />
            ))
          )}
        </>
      )}

      {visibleFirstChats.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.firstTitle]}>처음 나눌 이야기</Text>
          <Text style={styles.firstDesc}>마음에 담아둔 친구에게 먼저 인사해 볼까요?</Text>
          {visibleFirstChats.map((dog, index) => (
            <FirstChatCard
              key={dog.dogId}
              dog={dog}
              index={index}
              onPress={() =>
                navigation.navigate('Chat', { dogId: dog.dogId, dogName: dog.dogName, identityIndex: index % 3, shelterName: dog.shelterName })
              }
            />
          ))}
        </>
      )}

      <View style={styles.footer}>
        <MessageSquare size={12} color="#b4a8bc" strokeWidth={1.8} />
        <Text style={styles.footerText}>친구를 누르면 마지막 대화부터 이어져요.</Text>
      </View>
    </View>
  );
}

function Portrait({ index, width, height, groundHeight }: { index: number; width: number; height: number; groundHeight: number }) {
  const sheet = useImage(dogWalkAtlas);
  const theme = SCENES[index % SCENES.length];
  const dogSize = Math.round(height * 0.75);
  return (
    <View style={[styles.portrait, { width, height, backgroundColor: theme.scene }]}>
      <View style={[styles.ground, { height: groundHeight, backgroundColor: theme.ground }]} />
      <Canvas style={{ position: 'absolute', left: (width - dogSize) / 2, top: height - groundHeight - dogSize * 0.55, width: dogSize, height: dogSize }}>
        {sheet && <SpriteFrame sheet={sheet} frameSize={DOG_FRAME_SIZE} col={0} row={dogIdleRow(index)} x={0} y={0} size={dogSize} />}
      </Canvas>
    </View>
  );
}

// Figma "Card / Conversation room" (382×184). The "마지막 주제" chip in the design has no
// backing field in the API, so it's left out.
function ConversationCard({ conversation, index, onPress }: { conversation: DogConversation; index: number; onPress: () => void }) {
  return (
    <Pressable style={styles.roomCard} onPress={onPress}>
      <View style={styles.roomPortrait}>
        <Portrait index={index} width={86} height={93} groundHeight={23} />
      </View>
      <Text style={styles.roomName} numberOfLines={1}>
        {conversation.dogName}
      </Text>
      <Text style={styles.roomTime}>{formatRoomTime(conversation.updatedAt, new Date(), false)}</Text>
      <View style={styles.roomShelter}>
        <SvgIcon xml={dogSvgAssets.house11} width={10} height={10} />
        <Text style={styles.roomShelterText} numberOfLines={1}>
          {conversation.available ? conversation.shelterName : '더 이상 공개되지 않는 친구예요'}
        </Text>
      </View>
      <Text style={styles.roomMessage} numberOfLines={2}>
        {conversation.lastMessage ?? '아직 나눈 말이 없어요.'}
      </Text>
      <SvgIcon xml={dogSvgAssets.dottedDivider} width="100%" height={0.7} style={styles.roomDivider} />
      <View style={styles.roomContinue}>
        <Text style={styles.roomContinueText}>대화 이어가기</Text>
        <ChevronRight size={15} color="#9781a8" strokeWidth={2} />
      </View>
    </Pressable>
  );
}

// Figma "Card / First conversation" (382×124).
function FirstChatCard({ dog, index, onPress }: { dog: SavedDog; index: number; onPress: () => void }) {
  const [trait, setTrait] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchDog(dog.dogId).then(
      ({ data }) => !cancelled && setTrait(data.traitLabels[0] ?? null),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [dog.dogId]);

  return (
    <Pressable style={styles.firstCard} onPress={onPress}>
      <View style={styles.firstPortrait}>
        <Portrait index={index + 1} width={74} height={88} groundHeight={22} />
      </View>
      <View style={styles.firstNameRow}>
        <Text style={styles.firstName} numberOfLines={1}>
          {dog.dogName}
        </Text>
        <SvgIcon xml={dogSvgAssets.savedHeart10} width={11} height={11} />
      </View>
      <Text style={styles.firstMeta} numberOfLines={1}>
        {trait ? `${dog.shelterName} · ${trait}` : dog.shelterName}
      </Text>
      <View style={styles.firstButton}>
        <MessageSquare size={12} color="#927c9f" strokeWidth={1.8} />
        <Text style={styles.firstButtonText}>첫 이야기 시작</Text>
      </View>
    </Pressable>
  );
}

function EmptyCard({ title, lines, action, onAction }: { title: string; lines: string[]; action: string; onAction: () => void }) {
  return (
    <View style={styles.empty}>
      <MessageSquare size={32} color="#b9a4cc" strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <View>
        {lines.map(line => (
          <Text key={line} style={styles.emptyLine}>
            {line}
          </Text>
        ))}
      </View>
      <Pressable style={styles.emptyButton} onPress={onAction}>
        <Text style={styles.emptyButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 28, marginBottom: 14, marginLeft: 1 },
  sectionTitle: { fontFamily: fonts.pixel, fontSize: 16, lineHeight: 22, color: '#747186' },
  sectionCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 9, backgroundColor: '#efe8f1', alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 14, color: '#a390b0' },
  portrait: { borderRadius: 13, borderWidth: 0.5, borderColor: '#e8e5d8', overflow: 'hidden' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  roomCard: {
    height: 184,
    marginBottom: 16,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 20,
    shadowColor: '#4a4659',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  roomPortrait: { position: 'absolute', left: 16, top: 18 },
  roomName: { position: 'absolute', left: 118, right: 70, top: 17, fontFamily: fonts.pixel, fontSize: 21, lineHeight: 29, color: '#6b6878' },
  roomTime: { position: 'absolute', right: 18, top: 24, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#a8a0aa' },
  roomShelter: { position: 'absolute', left: 119, right: 18, top: 49, flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomShelterText: { flex: 1, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a09591' },
  roomMessage: { position: 'absolute', left: 118, right: 18, top: 79, fontFamily: fonts.body, fontSize: 12, lineHeight: 21, color: '#8d8594' },
  roomDivider: { position: 'absolute', left: 17, right: 18, top: 134 },
  roomContinue: { position: 'absolute', right: 16, top: 146, height: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomContinueText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#9781a8' },
  firstTitle: { marginTop: 18, marginLeft: 1 },
  firstDesc: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: '#a298a3', marginTop: 10, marginBottom: 14, marginLeft: 2 },
  firstCard: {
    height: 124,
    marginBottom: 14,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 18,
    shadowColor: '#4a4659',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  firstPortrait: { position: 'absolute', left: 16, top: 17 },
  firstNameRow: { position: 'absolute', left: 107, right: 16, top: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  firstName: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 25, color: '#746d7d', flexShrink: 1 },
  firstMeta: { position: 'absolute', left: 108, right: 16, top: 46, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a09591' },
  firstButton: { position: 'absolute', left: 107, top: 75, width: 132, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#e8ddf0', borderWidth: 1, borderColor: '#c3afcf', borderRadius: 10 },
  firstButtonText: { fontFamily: fonts.pixel, fontSize: 10.5, lineHeight: 15, color: '#927c9f' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14 },
  footerText: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#ada0ad' },
  empty: { minHeight: 320, marginTop: 20, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: '#fffef8', borderWidth: 1, borderColor: '#e2dacf', borderRadius: 20 },
  emptyTitle: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 25, color: '#7d708b' },
  emptyLine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#a0959b', textAlign: 'center' },
  emptyButton: { width: 240, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ddd2e3', borderRadius: 10 },
  emptyButtonText: { fontFamily: fonts.pixel, fontSize: 10.5, color: '#98859e' },
});
