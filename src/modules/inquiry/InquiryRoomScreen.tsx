import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Camera, ChevronLeft, ChevronRight, MapPin, Paperclip, SendHorizontal, User } from 'lucide-react-native';
import { MediaImage } from '../community/components/MediaImage';
import { formatClock, formatDayHeader, isSameDay } from '../../shared/lib/chatTime';
import { fonts } from '../../shared/lib/fonts';
import { getCurrentCoords, type Coords } from '../../shared/lib/deviceLocation';
import { openInMaps } from '../../shared/lib/mapLinks';
import { pickPhotos, uploadCommunityPhoto } from '../../shared/lib/photoUpload';
import { writeErrorMessage } from '../../shared/lib/communityErrors';
import { ActionSheet, PermissionSheet, SheetButton } from '../../shared/ui/ActionSheet';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { useInquiryRoom, type PendingMessage } from './hooks/useInquiryRoom';
import { lastReadMineSequence, POST_CATEGORY_LABEL, postStatusLabel } from './messages';
import type { InquiryMessage, InquiryRoom } from './types';
import type { RootStackParamList } from '../../app/navigation';

const AVATAR_COLORS = ['#efe7d7', '#e7eedc', '#ebe4f0'];

type Row =
  | { kind: 'day'; key: string; iso: string }
  | { kind: 'message'; key: string; message: InquiryMessage; showSender: boolean; read: boolean }
  | { kind: 'pending'; key: string; pending: PendingMessage };

// Figma "11 작성자에게 문의" (pencil TOPf6). Rendered as a full-screen route (no tab bar) so the
// keyboard doesn't fight the bottom tabs.
export function InquiryRoomScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'InquiryRoom'>>();
  const { state, send, sendAttachment, retry, reload, loadOlder } = useInquiryRoom(params.roomId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Row>>(null);
  const [attachSheet, setAttachSheet] = useState(false);
  const [photoDenied, setPhotoDenied] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null);
  const [placeLabel, setPlaceLabel] = useState('');
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  // 클립 → 사진 보내기: pick (PHPicker/photo picker, no album prompt) → upload → IMAGE message.
  const sendPhoto = async () => {
    setAttachSheet(false);
    setPhotoDenied(false);
    setAttachError(null);
    const picked = await pickPhotos(1);
    if (picked.status === 'denied') return setPhotoDenied(true);
    if (picked.status === 'error') return setAttachError(picked.message);
    if (picked.status !== 'picked') return;
    setAttachBusy(true);
    try {
      const mediaId = await uploadCommunityPhoto(picked.photos[0]);
      setAttachError(await sendAttachment({ kind: 'IMAGE', mediaId }));
    } catch (err) {
      setAttachError(writeErrorMessage(err));
    } finally {
      setAttachBusy(false);
    }
  };

  // 위치 보내기: current fix first (LOCATION needs coordinates), then a label the other side reads.
  const startLocation = async () => {
    setAttachSheet(false);
    setAttachError(null);
    setAttachBusy(true);
    try {
      setPendingCoords(await getCurrentCoords());
      setPlaceLabel('');
    } catch (failure) {
      if (failure === 'DENIED') setLocationDenied(true);
      else setAttachError('현재 위치를 가져오지 못했어요.');
    } finally {
      setAttachBusy(false);
    }
  };

  const sendLocation = async () => {
    if (!pendingCoords) return;
    const location = { label: placeLabel.trim() || '현재 위치', ...pendingCoords };
    setPendingCoords(null);
    setAttachBusy(true);
    setAttachError(await sendAttachment({ kind: 'LOCATION', location }));
    setAttachBusy(false);
  };

  const messageCount = state.status === 'ready' ? state.messages.length + state.pending.length : 0;
  useEffect(() => {
    if (messageCount > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messageCount]);

  const submit = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft('');
    send(text);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="roomBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#def1f6" />
            <Stop offset="0.515" stopColor="#fcf9f0" />
            <Stop offset="1" stopColor="#fcf9f0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#roomBg)" />
      </Svg>

      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={16} color="#7b8d99" strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>작성자에게 문의</Text>
      </View>

      {state.status === 'loading' && <ActivityIndicator style={styles.centerGap} />}
      {state.status === 'error' && (
        <View style={styles.errorWrap}>
          <ConnectionErrorView message="문의 내용을 불러오지 못했어요." onRetry={reload} onBack={() => navigation.goBack()} />
        </View>
      )}

      {state.status === 'ready' && (
        <>
          <FlatList
            ref={listRef}
            data={buildRows(state.messages, state.pending, state.room)}
            keyExtractor={row => row.key}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                <PostCard room={state.room} />
                <CounterpartRow room={state.room} />
                {state.olderBeforeSequence !== null && (
                  <Pressable style={styles.older} onPress={loadOlder}>
                    <Text style={styles.olderText}>이전 메시지 보기</Text>
                  </Pressable>
                )}
              </View>
            }
            ListFooterComponent={<Text style={styles.systemNote}>게시글과 관련된 이야기를 나누는 공간이에요.</Text>}
            renderItem={({ item }) => {
              if (item.kind === 'day') {
                return <Text style={styles.dayHeader}>{formatDayHeader(item.iso)}</Text>;
              }
              if (item.kind === 'pending') {
                return <PendingBubble pending={item.pending} onRetry={() => retry(item.pending.clientMessageId)} />;
              }
              return (
                <MessageBubble
                  message={item.message}
                  nickname={state.room.counterpart.nickname}
                  avatarColor={AVATAR_COLORS[hash(state.room.counterpart.id ?? state.room.id) % AVATAR_COLORS.length]}
                  showSender={item.showSender}
                  read={item.read}
                />
              );
            }}
          />

          {!!attachError && <Text style={styles.attachError}>{attachError}</Text>}
          {state.room.canSend ? (
            <View style={[styles.composer, { marginBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable onPress={() => setAttachSheet(true)} disabled={attachBusy} hitSlop={8}>
                {attachBusy ? <ActivityIndicator size="small" color="#b7a9c4" /> : <Paperclip size={18} color="#b7a9c4" strokeWidth={1.7} />}
              </Pressable>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="메시지를 입력해 주세요"
                placeholderTextColor="#baa6c0"
                multiline
                maxLength={1000}
              />
              <Pressable onPress={submit} disabled={!draft.trim()} hitSlop={8}>
                <SendHorizontal size={20} color={draft.trim() ? '#9a7bb0' : '#d6cadc'} strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : (
            <View style={[styles.readOnly, { marginBottom: Math.max(insets.bottom, 12) }]}>
              <Text style={styles.readOnlyText}>더 이상 메시지를 보낼 수 없어요. 지난 대화만 볼 수 있어요.</Text>
            </View>
          )}
        </>
      )}

      <ActionSheet visible={attachSheet} onClose={() => setAttachSheet(false)}>
        <SheetButton label="사진 보내기" onPress={sendPhoto} />
        <SheetButton label="내 위치 보내기" onPress={startLocation} />
        <SheetButton label="닫기" onPress={() => setAttachSheet(false)} />
      </ActionSheet>

      <ActionSheet visible={!!pendingCoords} onClose={() => setPendingCoords(null)} title="이 위치를 보낼까요?" message="지금 있는 곳의 위치가 지도 링크로 전달돼요.">
        <TextInput style={styles.labelInput} value={placeLabel} onChangeText={setPlaceLabel} placeholder="장소 이름 (예: 후평동 편의점 앞)" placeholderTextColor="#baa6c0" maxLength={200} />
        <SheetButton label="위치 보내기" tone="primary" onPress={sendLocation} />
        <SheetButton label="취소" onPress={() => setPendingCoords(null)} />
      </ActionSheet>

      <PermissionSheet
        visible={photoDenied}
        icon={<Camera size={26} color="#a48db7" strokeWidth={1.7} />}
        title="사진 접근이 꺼져 있어요"
        message={'사진을 다시 선택하거나\n기기 설정에서 사진 접근을 허용해 주세요.'}
        primaryLabel="사진 다시 선택"
        onPrimary={sendPhoto}
        linkLabel="대화로 돌아가기"
        onLink={() => setPhotoDenied(false)}
        onClose={() => setPhotoDenied(false)}
      />
      <PermissionSheet
        visible={locationDenied}
        icon={<MapPin size={26} color="#a48db7" strokeWidth={1.7} />}
        title="위치 접근이 꺼져 있어요"
        message={'내 위치를 보내려면 설정에서 위치 접근을 허용해 주세요.'}
        primaryLabel="대화로 돌아가기"
        onPrimary={() => setLocationDenied(false)}
        onClose={() => setLocationDenied(false)}
      />
    </KeyboardAvoidingView>
  );
}

function buildRows(messages: InquiryMessage[], pending: PendingMessage[], room: InquiryRoom): Row[] {
  const readSeq = lastReadMineSequence(messages, room.counterpartReadSequence);
  const rows: Row[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    if (!previous || !isSameDay(previous.createdAt, message.createdAt)) {
      rows.push({ kind: 'day', key: `day-${message.sequence}`, iso: message.createdAt });
    }
    const showSender = !message.mine && (!previous || previous.mine || !isSameDay(previous.createdAt, message.createdAt));
    rows.push({ kind: 'message', key: `m-${message.sequence}`, message, showSender, read: message.mine && message.sequence === readSeq });
  });
  pending.forEach(p => rows.push({ kind: 'pending', key: `p-${p.clientMessageId}`, pending: p }));
  return rows;
}

function hash(value: string): number {
  let h = 0;
  for (const ch of value) {
    h = (h * 31 + ch.charCodeAt(0)) % 997;
  }
  return h;
}

// Figma "Card / Related community post" (382×84).
function PostCard({ room }: { room: InquiryRoom }) {
  const category = room.post.category ? POST_CATEGORY_LABEL[room.post.category] : '게시글';
  return (
    <View style={styles.postCard}>
      <MediaImage mediaId={room.post.available ? room.post.thumbnailMediaId : null} width={62} height={62} radius={10} />
      <View style={styles.postCopy}>
        <Text style={styles.postCategory}>{category}</Text>
        <Text style={styles.postTitle} numberOfLines={1}>
          {room.post.available ? room.post.title : '볼 수 없는 게시글이에요'}
        </Text>
        <Text style={styles.postMeta} numberOfLines={1}>
          {postStatusLabel(room.post.category, room.post.status, room.post.available)} · {room.counterpart.nickname}
        </Text>
      </View>
      <ChevronRight size={14} color="#c4b6cc" strokeWidth={2} />
    </View>
  );
}

function CounterpartRow({ room }: { room: InquiryRoom }) {
  return (
    <View style={styles.counterpart}>
      <View style={[styles.avatarLarge, { backgroundColor: AVATAR_COLORS[hash(room.counterpart.id ?? room.id) % AVATAR_COLORS.length] }]}>
        <User size={20} color="#baa581" strokeWidth={1.8} />
      </View>
      <View style={styles.counterpartCopy}>
        <Text style={styles.counterpartName}>{room.counterpart.nickname}</Text>
        <Text style={styles.counterpartSub}>이 글을 작성한 이웃</Text>
      </View>
      <View style={styles.contextChip}>
        <Text style={styles.contextChipText}>게시글 문의</Text>
      </View>
    </View>
  );
}

function MessageBubble({ message, nickname, avatarColor, showSender, read }: { message: InquiryMessage; nickname: string; avatarColor: string; showSender: boolean; read: boolean }) {
  const time = <Text style={styles.time}>{formatClock(message.createdAt)}</Text>;
  const content = <MessageContent message={message} />;

  if (message.mine) {
    return (
      <View style={styles.mineRow}>
        <View style={styles.mineMeta}>
          {read && <Text style={styles.readMark}>읽음</Text>}
          {time}
        </View>
        <View style={[styles.bubble, styles.bubbleMine]}>{content}</View>
      </View>
    );
  }
  return (
    <View style={styles.theirsRow}>
      {showSender ? (
        <View style={[styles.avatarSmall, { backgroundColor: avatarColor }]}>
          <User size={15} color="#bda784" strokeWidth={1.8} />
        </View>
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <View style={styles.theirsBody}>
        {showSender && <Text style={styles.senderName}>{nickname}</Text>}
        <View style={styles.theirsLine}>
          <View style={[styles.bubble, styles.bubbleTheirs]}>{content}</View>
          {time}
        </View>
      </View>
    </View>
  );
}

function MessageContent({ message }: { message: InquiryMessage }) {
  const mine = message.mine;
  const textStyle = [styles.bubbleText, mine ? styles.textMine : styles.textTheirs];

  if (message.kind === 'LOCATION' && message.location) {
    const { label, latitude, longitude } = message.location;
    const open = () => openInMaps({ label, latitude, longitude }).catch(() => undefined);
    return (
      <Pressable onPress={open} style={styles.locationCard}>
        <View style={styles.locationRow}>
          <View style={styles.locationIcon}>
            <MapPin size={20} color="#b4a0c4" strokeWidth={1.7} />
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>공유한 위치</Text>
            <Text style={styles.locationLabel} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
        <View style={styles.locationAction}>
          <Text style={styles.locationActionText}>지도에서 보기</Text>
          <ChevronRight size={12} color="#a184b0" strokeWidth={2} />
        </View>
        {!!message.text && <Text style={[textStyle, styles.locationNote]}>{message.text}</Text>}
      </Pressable>
    );
  }
  if (message.kind === 'IMAGE') {
    return (
      <View>
        <MediaImage mediaId={message.kind === 'IMAGE' ? message.mediaId : null} width={200} height={150} radius={10} />
        {!!message.text && <Text style={[textStyle, styles.imageNote]}>{message.text}</Text>}
      </View>
    );
  }
  return <Text style={textStyle}>{message.text}</Text>;
}

function PendingBubble({ pending, onRetry }: { pending: PendingMessage; onRetry: () => void }) {
  return (
    <View style={styles.mineRow}>
      <View style={styles.mineMeta}>
        {pending.failed ? (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Text style={styles.failedText}>전송 실패 · 다시 시도</Text>
          </Pressable>
        ) : (
          <Text style={styles.time}>보내는 중…</Text>
        )}
      </View>
      <View style={[styles.bubble, styles.bubbleMine, pending.failed && styles.bubbleFailed]}>
        <Text style={[styles.bubbleText, styles.textMine]}>{pending.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  attachError: { fontFamily: fonts.body, fontSize: 11.5, color: '#c0526b', textAlign: 'center', marginBottom: 6 },
  labelInput: { height: 48, paddingHorizontal: 16, backgroundColor: '#fffefa', borderWidth: 0.9, borderColor: '#e0d6e6', borderRadius: 13, fontFamily: fonts.body, fontSize: 13, color: '#6b6878' },
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 12 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f7fcfc', borderWidth: 0.8, borderColor: '#cce2e7', alignItems: 'center', justifyContent: 'center' },
  title: { marginLeft: 17, fontFamily: fonts.pixel, fontSize: 21, lineHeight: 29, color: '#5e7383' },
  centerGap: { marginTop: 40 },
  errorWrap: { paddingHorizontal: 24, paddingTop: 24 },
  listContent: { paddingHorizontal: 24, paddingBottom: 16 },
  postCard: { height: 84, flexDirection: 'row', alignItems: 'center', gap: 13, paddingLeft: 11, paddingRight: 14, backgroundColor: '#fffef9', borderRadius: 15, shadowColor: '#4a4659', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  postCopy: { flex: 1, gap: 4 },
  postCategory: { fontFamily: fonts.pixel, fontSize: 9.5, lineHeight: 13, color: '#be8d9c' },
  postTitle: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: '#82728c' },
  postMeta: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#b0a1ae' },
  counterpart: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 15, marginBottom: 6 },
  avatarLarge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  counterpartCopy: { flex: 1 },
  counterpartName: { fontFamily: fonts.pixel, fontSize: 16, lineHeight: 22, color: '#8e7b99' },
  counterpartSub: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#ad9eb3' },
  contextChip: { height: 24, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#f0e9f5', justifyContent: 'center' },
  contextChipText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#a18aae' },
  older: { alignSelf: 'center', paddingVertical: 8 },
  olderText: { fontFamily: fonts.body, fontSize: 11, color: '#a99cb2' },
  dayHeader: { alignSelf: 'center', fontFamily: fonts.pixel, fontSize: 10, lineHeight: 14, color: '#b4a5b8', marginTop: 22, marginBottom: 14 },
  mineRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  mineMeta: { alignItems: 'flex-end', gap: 2, paddingBottom: 2 },
  theirsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  theirsBody: { flexShrink: 1, gap: 6 },
  theirsLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatarSmall: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarSpacer: { width: 30 },
  senderName: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#a48aaf', marginTop: 1 },
  bubble: { maxWidth: 270, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, borderWidth: 1 },
  bubbleMine: { backgroundColor: '#eaddf2', borderColor: '#d5bcdf' },
  bubbleTheirs: { backgroundColor: '#fffefa', borderColor: '#e0d9d1', flexShrink: 1 },
  bubbleFailed: { opacity: 0.6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  textMine: { color: '#9c7ea7' },
  textTheirs: { color: '#8c8493' },
  time: { fontFamily: fonts.body, fontSize: 8.5, lineHeight: 12, color: '#baa9bf' },
  readMark: { fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: '#b7a2c0' },
  failedText: { fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: '#c0526b' },
  locationCard: { width: 236, gap: 14 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIcon: { width: 43, height: 41, borderRadius: 9, backgroundColor: '#f8f3fa', alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1, gap: 3 },
  locationTitle: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#9d7ead' },
  locationLabel: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#b09bbb' },
  locationAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  locationActionText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#a184b0' },
  locationNote: { marginTop: -4 },
  imageNote: { marginTop: 8 },
  systemNote: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#baaabd', textAlign: 'center', marginTop: 26, marginBottom: 6 },
  composer: { marginHorizontal: 24, minHeight: 51, maxHeight: 120, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fffefa', borderWidth: 1, borderColor: '#dccfe3', borderRadius: 15 },
  input: { flex: 1, padding: 0, fontFamily: fonts.body, fontSize: 12, color: '#6b6878', maxHeight: 96 },
  readOnly: { marginHorizontal: 24, minHeight: 51, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: '#f6f3f4', borderRadius: 15 },
  readOnlyText: { fontFamily: fonts.body, fontSize: 11.5, color: '#a49aa6', textAlign: 'center' },
});
