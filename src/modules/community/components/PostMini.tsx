import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fonts } from '../../../shared/lib/fonts';
import { MediaImage } from './MediaImage';
import { CATEGORY_LABEL, shortRegion } from '../postText';
import type { CommunityPost } from '../types';

// Figma "Card / Related community post" (382×84) — the post a comment thread / location list belongs to.
export function PostMini({ post, onPress }: { post: CommunityPost; onPress?: () => void }) {
  const meta = [post.content.regionLabel ? shortRegion(post.content.regionLabel) : null, post.authorName].filter(Boolean).join(' · ');
  return (
    <Pressable style={styles.card} onPress={onPress} disabled={!onPress}>
      <MediaImage mediaId={post.content.mediaIds[0]} width={62} height={62} radius={10} />
      <View style={styles.copy}>
        <Text style={styles.category}>{CATEGORY_LABEL[post.category]}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {post.content.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {onPress && <ChevronRight size={14} color="#c4b6cc" strokeWidth={2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { height: 84, flexDirection: 'row', alignItems: 'center', gap: 13, paddingLeft: 11, paddingRight: 14, backgroundColor: '#fffef9', borderRadius: 15, shadowColor: '#4a4659', shadowOpacity: 0.06, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  copy: { flex: 1, gap: 4 },
  category: { fontFamily: fonts.pixel, fontSize: 9.5, lineHeight: 13, color: '#be8d9c' },
  title: { fontFamily: fonts.pixel, fontSize: 13, lineHeight: 18, color: '#82728c' },
  meta: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#b0a1ae' },
});
