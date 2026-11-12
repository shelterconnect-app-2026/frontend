import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, Send, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../../shared/lib/fonts';
import { generateClientMessageId } from '../../shared/lib/clientId';
import { writeErrorMessage } from '../../shared/lib/communityErrors';
import { ActionSheet, SheetButton } from '../../shared/ui/ActionSheet';
import { formatClock, formatRoomTime } from '../../shared/lib/chatTime';
import { formatRelativeTime } from '../../shared/lib/relativeTime';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { useCommunityComments, useCommunityPost } from './hooks/useCommunityPost';
import { MediaImage } from './components/MediaImage';
import { createCommunityComment, deleteCommunityComment } from './api/posts';
import { buildCommentBody } from './composeForm';
import { groupComments, type CommentThread } from './postText';
import { PostMini } from './components/PostMini';
import { ScreenFrame } from './components/ScreenFrame';
import type { CommentKind, CommunityComment, CommunityPost } from './types';
import type { RootStackParamList } from '../../app/navigation';

// Figma "09 댓글·제보" (pencil mUDX1). The design's "도움이 됐어요" reaction has no backend API.
export function CommunityCommentsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CommunityComments'>>();
  const { state: postState, reload: reloadPost } = useCommunityPost(params.postId);
  const [kind, setKind] = useState<CommentKind | null>(null);
  const { state, reload, loadMore } = useCommunityComments(params.postId, kind);

  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityComment | null>(null);

  const post = postState.status === 'ready' ? postState.post : null;

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      // Replies go one level deep: answering a reply attaches to its parent.
      await createCommunityComment(params.postId, buildCommentBody(text, generateClientMessageId(), replyTo ? replyTo.parentId ?? replyTo.id : undefined));
      setText('');
      setReplyTo(null);
      reload();
      reloadPost();
    } catch (err) {
      setError(writeErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await deleteCommunityComment(params.postId, target.id);
      reload();
      reloadPost();
    } catch (err) {
      setError(writeErrorMessage(err));
    }
  };
  const threads = useMemo(() => (state.status === 'ready' ? groupComments(state.comments) : []), [state]);

  return (
    <ScreenFrame
      title="댓글·제보"
      footer={
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          {replyTo && (
            <View style={styles.replying}>
              <Text style={styles.replyingText} numberOfLines={1}>
                {replyTo.authorName ?? '이웃'}님에게 답글
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <X size={14} color="#a99cb2" strokeWidth={2} />
              </Pressable>
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.composerRow}>
            {post && post.category !== 'NEIGHBOR_NEWS' && post.status === 'ACTIVE' && (
              <Pressable style={styles.sightingButton} onPress={() => navigation.navigate('SightingCompose', { postId: params.postId })}>
                <Text style={styles.sightingButtonText}>제보</Text>
              </Pressable>
            )}
            <TextInput style={styles.composerInput} value={text} onChangeText={setText} placeholder="따뜻한 한마디를 남겨 주세요" placeholderTextColor="#b0a2b7" maxLength={1000} multiline />
            <Pressable style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]} onPress={send} disabled={!text.trim() || sending}>
              {sending ? <ActivityIndicator color="#89709b" /> : <Send size={16} color="#89709b" strokeWidth={1.9} />}
            </Pressable>
          </View>
        </View>
      }
    >
      {post && <PostMini post={post} onPress={() => navigation.goBack()} />}

      <Text style={styles.heading}>함께 모은 이야기</Text>
      <View style={styles.filters}>
        <FilterPill label={`전체 ${post ? post.commentCount + post.sightingCount : ''}`.trim()} active={kind === null} onPress={() => setKind(null)} />
        {post && post.category !== 'NEIGHBOR_NEWS' && (
          <FilterPill label={`목격 제보 ${post.sightingCount}`} active={kind === 'SIGHTING'} onPress={() => setKind('SIGHTING')} />
        )}
        <FilterPill label={`댓글 ${post ? post.commentCount : ''}`.trim()} active={kind === 'COMMENT'} onPress={() => setKind('COMMENT')} />
      </View>
      <Text style={styles.sort}>등록순</Text>

      {state.status === 'loading' && <ActivityIndicator style={styles.gap} />}
      {state.status === 'error' && <ConnectionErrorView message="댓글을 불러오지 못했어요." onRetry={reload} />}
      {state.status === 'ready' && threads.length === 0 && <Text style={styles.empty}>아직 남겨진 이야기가 없어요.</Text>}

      {threads.map(thread => (
        <ThreadCard
          key={thread.comment.id}
          thread={thread}
          post={post}
          onShowLocation={() => navigation.navigate('CommunityLocations', { postId: params.postId })}
          onReply={setReplyTo}
          onDelete={setDeleteTarget}
        />
      ))}

      {state.status === 'ready' && state.nextCursor && (
        <Pressable style={styles.more} onPress={loadMore}>
          <Text style={styles.moreText}>{state.loadingMore ? '불러오는 중…' : '더 보기'}</Text>
        </Pressable>
      )}

      <ActionSheet visible={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="댓글을 삭제할까요?" message="삭제한 댓글은 되돌릴 수 없어요.">
        <SheetButton label="삭제하기" tone="danger" onPress={confirmDelete} />
        <SheetButton label="취소" onPress={() => setDeleteTarget(null)} />
      </ActionSheet>
    </ScreenFrame>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface RowActions {
  onShowLocation: () => void;
  onReply: (comment: CommunityComment) => void;
  onDelete: (comment: CommunityComment) => void;
}

function ThreadCard({ thread, post, ...actions }: { thread: CommentThread; post: CommunityPost | null } & RowActions) {
  const { comment, replies } = thread;
  return (
    <View style={styles.card}>
      <CommentRow comment={comment} post={post} {...actions} canReply />
      {replies.map(reply => (
        <View key={reply.id} style={styles.reply}>
          <CommentRow comment={reply} post={post} {...actions} />
        </View>
      ))}
    </View>
  );
}

function CommentRow({ comment, post, onShowLocation, onReply, onDelete, canReply }: { comment: CommunityComment; post: CommunityPost | null; canReply?: boolean } & RowActions) {
  if (comment.deleted || !comment.content) {
    return <Text style={styles.deleted}>삭제된 댓글이에요.</Text>;
  }
  const isAuthor = post !== null && comment.authorId === post.authorId;
  const location = comment.content.location;
  return (
    <View>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{comment.authorName ?? '이웃'}</Text>
            {isAuthor && (
              <View style={styles.authorBadge}>
                <Text style={styles.authorBadgeText}>글쓴이</Text>
              </View>
            )}
          </View>
          <Text style={styles.time}>{formatRelativeTime(comment.createdAt)}</Text>
        </View>
        {comment.kind === 'SIGHTING' && (
          <View style={styles.sightingBadge}>
            <Text style={styles.sightingBadgeText}>목격 제보</Text>
          </View>
        )}
      </View>
      <Text style={styles.text}>{comment.content.text}</Text>
      <View style={styles.rowActions}>
        {canReply && (
          <Pressable onPress={() => onReply(comment)} hitSlop={8}>
            <Text style={styles.rowActionText}>답글 달기</Text>
          </Pressable>
        )}
        {comment.mine && (
          <Pressable onPress={() => onDelete(comment)} hitSlop={8}>
            <Text style={styles.rowActionText}>삭제</Text>
          </Pressable>
        )}
      </View>
      {!!comment.content?.mediaIds[0] && <MediaImage mediaId={comment.content.mediaIds[0]} width={120} height={90} radius={10} />}
      {location && (
        <Pressable style={styles.location} onPress={onShowLocation}>
          <MapPin size={14} color="#b4a0c4" strokeWidth={1.8} />
          <View style={styles.locationCopy}>
            <Text style={styles.locationLabel} numberOfLines={1}>
              {location.label}
            </Text>
            <Text style={styles.locationTime}>
              {formatRoomTime(location.occurredAt, new Date(), false) === '오늘' ? '오늘' : formatRoomTime(location.occurredAt)} {formatClock(location.occurredAt)}
            </Text>
          </View>
          <Text style={styles.locationLink}>위치 보기</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.pixel, fontSize: 16, lineHeight: 22, color: '#84728f', marginTop: 24, marginLeft: 1 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 15 },
  pill: { height: 33, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: '#fffefb', borderWidth: 1, borderColor: '#e0d5e4', borderRadius: 12 },
  pillActive: { backgroundColor: '#e9dcf2', borderColor: '#c6b0d8' },
  pillText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#ae9db9' },
  pillTextActive: { color: '#9679aa' },
  sort: { alignSelf: 'flex-end', fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#a997b4', marginTop: 14, marginBottom: 14 },
  gap: { marginTop: 24 },
  empty: { fontFamily: fonts.body, fontSize: 12, color: '#a1998e', textAlign: 'center', marginTop: 24 },
  card: { marginBottom: 14, padding: 16, gap: 14, backgroundColor: '#fffef9', borderWidth: 1, borderColor: '#e2d8cf', borderRadius: 17, shadowColor: '#4a4659', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 3 } },
  reply: { marginLeft: 26, paddingTop: 14, borderTopWidth: 0.8, borderTopColor: '#efe8ee' },
  head: { flexDirection: 'row', alignItems: 'center' },
  headCopy: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.pixel, fontSize: 12, lineHeight: 17, color: '#8d7b9b' },
  authorBadge: { height: 24, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#f0e9f5', justifyContent: 'center' },
  authorBadgeText: { fontFamily: fonts.pixel, fontSize: 8, lineHeight: 12, color: '#a28bab' },
  time: { fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: '#b5a6b5' },
  sightingBadge: { height: 24, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#eaf0e3', justifyContent: 'center' },
  sightingBadgeText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#8d9e7b' },
  text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 24, color: '#8d8093', marginTop: 12 },
  deleted: { fontFamily: fonts.body, fontSize: 11.5, color: '#b5a6b5' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingHorizontal: 14, height: 47, backgroundColor: '#f5f1f8', borderWidth: 1, borderColor: '#ebe2f0', borderRadius: 11 },
  locationCopy: { flex: 1, gap: 2 },
  locationLabel: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#a08aaa' },
  locationTime: { fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: '#b5a6bb' },
  locationLink: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#a58faf' },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  rowActionText: { fontFamily: fonts.pixel, fontSize: 9.5, color: '#a99cb2' },
  composer: { paddingHorizontal: 24, paddingTop: 10, backgroundColor: '#fcf9f0', borderTopWidth: 0.8, borderTopColor: '#e6dce2', gap: 8 },
  replying: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  replyingText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: '#9679aa' },
  error: { fontFamily: fonts.body, fontSize: 11.5, color: '#c0526b' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sightingButton: { height: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#eaf0e3', borderRadius: 13 },
  sightingButtonText: { fontFamily: fonts.pixel, fontSize: 11.5, color: '#8d9e7b' },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 96, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, backgroundColor: '#fffefa', borderWidth: 0.9, borderColor: '#e0d6e6', borderRadius: 13, fontFamily: fonts.body, fontSize: 12.5, color: '#6b6878' },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5d9f0', borderRadius: 13 },
  sendDisabled: { opacity: 0.5 },
  more: { alignSelf: 'center', paddingVertical: 12 },
  moreText: { fontFamily: fonts.body, fontSize: 12, color: '#a99cb2' },
});
