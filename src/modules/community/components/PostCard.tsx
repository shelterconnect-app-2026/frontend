import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MapPin, MessageSquare, Users } from 'lucide-react-native';
import { fonts } from '../../../shared/lib/fonts';
import { formatRelativeTime } from '../../../shared/lib/relativeTime';
import { MediaImage } from './MediaImage';
import { describeOccurredAt, shortRegion } from '../postText';
import type { CommunityPost } from '../types';
import { PostChip } from './PostChip';

// Figma "Card / Community lost|found" (382×168).
export function PostCard({ post, onPress }: { post: CommunityPost; onPress: () => void }) {
  const { content } = post;
  const when = content.location ? describeOccurredAt(content.location.occurredAt) : null;
  const where = content.regionLabel ? shortRegion(content.regionLabel) : null;
  const place = [where, when].filter(Boolean).join(' · ');
  const showSightings = post.category !== 'NEIGHBOR_NEWS';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.photo}>
        <MediaImage mediaId={post.content.mediaIds[0]} width={106} height={111} radius={12} />
      </View>
      <View style={styles.chip}>
        <PostChip category={post.category} />
      </View>
      <Text style={styles.time}>{formatRelativeTime(post.publishedAt ?? post.createdAt)}</Text>
      <Text style={styles.title} numberOfLines={2}>
        {content.title}
      </Text>
      {content.features.length > 0 && (
        <Text style={styles.features} numberOfLines={1}>
          {content.features.join(' · ')}
        </Text>
      )}
      {!!place && (
        <View style={styles.place}>
          <MapPin size={11} color="#b8aab9" strokeWidth={1.8} />
          <Text style={styles.placeText} numberOfLines={1}>
            {place}
          </Text>
        </View>
      )}
      <View style={styles.counts}>
        {showSightings && (
          <View style={styles.count}>
            <Users size={12} color="#b4a6bf" strokeWidth={1.8} />
            <Text style={styles.countText}>목격 제보 {post.sightingCount}</Text>
          </View>
        )}
        <View style={styles.count}>
          <MessageSquare size={11} color="#b4a6bf" strokeWidth={1.8} />
          <Text style={styles.countText}>댓글 {post.commentCount}</Text>
        </View>
        <ChevronRight size={14} color="#c4b6cc" strokeWidth={2} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    marginBottom: 14,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 18,
    shadowColor: '#4a4659',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  photo: { position: 'absolute', left: 16, top: 16 },
  chip: { position: 'absolute', left: 138, top: 16 },
  time: { position: 'absolute', right: 16, top: 21, fontFamily: fonts.body, fontSize: 9.5, lineHeight: 13, color: '#aea5ae' },
  title: { position: 'absolute', left: 138, right: 18, top: 46, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: '#78727f' },
  features: { position: 'absolute', left: 139, right: 18, top: 90, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a198a2' },
  place: { position: 'absolute', left: 140, right: 18, top: 110, flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeText: { flex: 1, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#a39aa3' },
  counts: { position: 'absolute', left: 18, right: 16, top: 143, flexDirection: 'row', alignItems: 'center', gap: 14 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  countText: { fontFamily: fonts.body, fontSize: 9.5, lineHeight: 13, color: '#a89bae' },
  chevron: { marginLeft: 'auto' },
});
