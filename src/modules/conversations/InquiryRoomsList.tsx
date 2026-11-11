import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight, MessageSquare, User } from 'lucide-react-native';
import type { InquiryRoomsState } from '../inquiry/hooks/useInquiryRooms';
import { postStatusLabel } from '../inquiry/messages';
import { MediaImage } from '../community/components/MediaImage';
import type { InquiryRoom } from '../inquiry/types';
import { fonts } from '../../shared/lib/fonts';
import { formatRoomTime } from '../../shared/lib/chatTime';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { SortButton } from '../../shared/ui/SortButton';
import { FilterRow, SearchBox } from './ListControls';
import { ROOM_SORTS, sortRooms, type RoomSort } from './listSort';
import type { HomeTabScreenNavigationProp } from '../../app/navigation';

const AVATAR_COLORS = ['#eee6d7', '#e7eedc', '#ebe4f0'];
// Status chip colors from the Figma cards (찾는 중 / 보호 중 / 가족 만남).
const STATUS_CHIP: Record<string, { bg: string; fg: string }> = {
  '찾는 중': { bg: '#f8e9ec', fg: '#af8090' },
  '보호 중': { bg: '#eaf0e2', fg: '#8a9c79' },
  '가족 만남': { bg: '#e6eddc', fg: '#8b9d7b' },
};
const DEFAULT_CHIP = { bg: '#efeaf3', fg: '#9d8cab' };

// Figma "04 대화 · 이웃 문의" (pencil xdNoF) and its 안 읽음 filter state (H96Do7).
type InquiryRoomsListProps = {
  state: InquiryRoomsState;
  reload: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  filter: 'all' | 'unread';
  onFilterChange: (value: 'all' | 'unread') => void;
};

export function InquiryRoomsList({ state, reload, search, onSearchChange, filter, onFilterChange }: InquiryRoomsListProps) {
  const navigation = useNavigation<HomeTabScreenNavigationProp>();
  const [sort, setSort] = useState<RoomSort>('RECENT');

  if (state.status === 'anon') {
    return (
      <View style={styles.empty}>
        <MessageSquare size={30} color="#b9a4cc" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>로그인이 필요해요</Text>
        <Text style={styles.emptyLine}>로그인하면 이웃과 나눈 문의를 볼 수 있어요.</Text>
        <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('LoginGuide')}>
          <Text style={styles.emptyButtonText}>로그인하기</Text>
        </Pressable>
      </View>
    );
  }

  const rooms = state.status === 'ready' ? sortRooms(state.rooms, sort) : [];
  const unreadRooms = state.status === 'ready' ? state.unreadRoomCount : 0;

  return (
    <View>
      <SearchBox value={search} onChangeText={onSearchChange} placeholder="이웃 이름이나 게시글로 검색" />
      <FilterRow
        options={[
          { key: 'all', label: '전체', count: filter === 'all' ? rooms.length : undefined },
          { key: 'unread', label: '안 읽음', count: unreadRooms },
        ]}
        selected={filter}
        onSelect={key => onFilterChange(key as 'all' | 'unread')}
        sort={<SortButton options={ROOM_SORTS} value={sort} onChange={setSort} />}
      />

      {state.status === 'loading' && <ActivityIndicator style={styles.gap} />}
      {state.status === 'error' && (
        <View style={styles.gap}>
          <ConnectionErrorView message="문의 목록을 불러오지 못했어요." onRetry={reload} />
        </View>
      )}
      {state.status === 'ready' && rooms.length === 0 && (
        <Text style={[styles.emptyLine, styles.gap]}>{filter === 'unread' ? '안 읽은 문의가 없어요.' : '아직 이웃과 나눈 문의가 없어요.'}</Text>
      )}

      <View style={styles.list}>
        {rooms.map((room, index) => (
          <RoomCard key={room.id} room={room} index={index} onPress={() => navigation.navigate('InquiryRoom', { roomId: room.id })} />
        ))}
      </View>

      <View style={styles.footer}>
        <MessageSquare size={11} color="#b0a1b5" strokeWidth={1.8} />
        <Text style={styles.footerText}>커뮤니티에서 시작한 문의가 여기에 모여요.</Text>
      </View>
    </View>
  );
}

// Figma "Card / 이웃 문의" (382×150): counterpart row + related-post preview row.
function RoomCard({ room, index, onPress }: { room: InquiryRoom; index: number; onPress: () => void }) {
  const unread = room.unreadCount > 0;
  const statusLabel = postStatusLabel(room.post.category, room.post.status, room.post.available);
  const chip = STATUS_CHIP[statusLabel] ?? DEFAULT_CHIP;
  const lastText = room.lastMessage ? messagePreview(room.lastMessage.kind, room.lastMessage.text) : '문의를 시작했어요.';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
        <User size={22} color="#fffefa" strokeWidth={1.8} />
      </View>
      <Text style={[styles.name, !unread && styles.nameRead]} numberOfLines={1}>
        {room.counterpart.nickname}
      </Text>
      <Text style={styles.time}>{formatRoomTime(room.updatedAt)}</Text>
      <Text style={[styles.message, !unread && styles.messageRead]} numberOfLines={1}>
        {lastText}
      </Text>
      {unread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{room.unreadCount}</Text>
        </View>
      )}
      <View style={[styles.post, !room.post.available && styles.postMasked]}>
        <MediaImage mediaId={room.post.available ? room.post.thumbnailMediaId : null} width={40} height={40} radius={8} />
        <View style={styles.postCopy}>
          <View style={[styles.postChip, { backgroundColor: chip.bg }]}>
            <Text style={[styles.postChipText, { color: chip.fg }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.postTitle} numberOfLines={1}>
            {room.post.available ? room.post.title : '볼 수 없는 게시글이에요'}
          </Text>
        </View>
        <ChevronRight size={14} color="#c4b6cc" strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function messagePreview(kind: string, text: string | null): string {
  if (kind === 'IMAGE') return '사진을 보냈어요.';
  if (kind === 'LOCATION') return '위치를 공유했어요.';
  return text ?? '';
}

const styles = StyleSheet.create({
  gap: { marginTop: 18 },
  list: { marginTop: 20, gap: 16 },
  card: {
    height: 150,
    backgroundColor: '#fffefa',
    borderWidth: 1,
    borderColor: '#cebdd9',
    borderRadius: 18,
    shadowColor: '#4a4659',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: { position: 'absolute', left: 16, top: 17, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { position: 'absolute', left: 70, right: 90, top: 17, fontFamily: fonts.pixel, fontSize: 16, lineHeight: 22, color: '#74647f' },
  nameRead: { color: '#847b8b' },
  time: { position: 'absolute', right: 16, top: 21, fontFamily: fonts.body, fontSize: 9.5, lineHeight: 13, color: '#aa9caf' },
  message: { position: 'absolute', left: 70, right: 44, top: 46, fontFamily: fonts.body, fontSize: 11.3, lineHeight: 16, color: '#877c8e' },
  messageRead: { color: '#a49aa6' },
  unreadBadge: { position: 'absolute', right: 16, top: 46, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#b69acc', alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#ffffff' },
  post: { position: 'absolute', left: 16, right: 16, top: 82, height: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, paddingRight: 12, backgroundColor: '#f6f3f4', borderRadius: 11 },
  postMasked: { opacity: 0.7 },
  postCopy: { flex: 1, gap: 3 },
  postChip: { alignSelf: 'flex-start', height: 17, paddingHorizontal: 7, borderRadius: 6, justifyContent: 'center' },
  postChipText: { fontFamily: fonts.pixel, fontSize: 8.5, lineHeight: 12 },
  postTitle: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: '#9b8d9f' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22 },
  footerText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#b0a1b5' },
  empty: { minHeight: 280, marginTop: 20, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#fffef8', borderWidth: 1, borderColor: '#e2dacf', borderRadius: 20 },
  emptyTitle: { fontFamily: fonts.pixel, fontSize: 18, lineHeight: 25, color: '#7d708b' },
  emptyLine: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#a0959b', textAlign: 'center' },
  emptyButton: { width: 240, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#ddd2e3', borderRadius: 10 },
  emptyButtonText: { fontFamily: fonts.pixel, fontSize: 10.5, color: '#98859e' },
});
