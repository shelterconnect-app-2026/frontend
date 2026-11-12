import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCommunityPreview } from '../../community/hooks/useCommunityPreview';
import { MediaImage } from '../../community/components/MediaImage';
import { fonts } from '../../../shared/lib/fonts';
import { formatRelativeTime } from '../../../shared/lib/relativeTime';
import { HomeSvg } from './HomeSvg';
import type { HomeTabScreenNavigationProp } from '../../../app/navigation';
import type { CommunityCategory } from '../../community/types';

const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  LOST: '찾고 있어요',
  FOUND: '발견했어요',
  NEIGHBOR_NEWS: '동네 소식',
};

// Figma "Community / home preview" (node 22:15867) — a single newest post, photo via
// a signed /community/media URL (community-api.md: signed URLs expire in 60s, so this
// is fetched fresh each mount rather than cached).
export function CommunityPreviewSection() {
  const navigation = useNavigation<HomeTabScreenNavigationProp>();
  const state = useCommunityPreview();
  const goToCommunityTab = () => navigation.navigate('커뮤니티');

  if (state.status === 'loading') {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <HomeSvg name="communitySection" width={19} height={19} style={styles.headingIcon} />
        <Text style={styles.headingText}>우리 동네 찾기·발견</Text>
        <Pressable style={styles.seeAll} onPress={goToCommunityTab}>
          <Text style={styles.seeAllText}>모두 보기</Text>
          <HomeSvg name="chevronSeeall" width={14} height={14} />
        </Pressable>
      </View>

      {state.status === 'ready' && state.regionLabel && (
        <View style={styles.regionRow}>
          <HomeSvg name="locationSection" width={8} height={12} />
          <Text style={styles.regionText}>{state.regionLabel} 주변 소식</Text>
        </View>
      )}

      {state.status === 'anon' && <Text style={styles.hintText}>로그인하면 동네 찾기·발견 소식을 볼 수 있어요</Text>}
      {state.status === 'error' && <Text style={styles.hintText}>소식을 못 불러왔어요</Text>}
      {state.status === 'ready' && !state.post && <Text style={styles.hintText}>아직 소식이 없어요</Text>}
      {state.status === 'ready' && state.post && (
        <Pressable style={styles.card} onPress={() => navigation.navigate('CommunityPost', { postId: state.post!.id })}>
          <PostThumbnail mediaId={state.post.content.mediaIds[0]} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{CATEGORY_LABEL[state.post.category]}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(state.post.publishedAt ?? state.post.createdAt)}</Text>
          <Text style={styles.title} numberOfLines={1}>
            {state.post.content.title}
          </Text>
          {state.post.content.features.length > 0 && (
            <Text style={styles.features} numberOfLines={1}>
              {state.post.content.features.join(' · ')}
            </Text>
          )}
          {state.post.content.location && (
            <View style={styles.locationRow}>
              <HomeSvg name="locationCard" width={7} height={10.5} />
              <Text style={styles.locationText} numberOfLines={1}>
                {state.post.content.location.label}
              </Text>
            </View>
          )}
          <HomeSvg name="chevronCard" width={17} height={17} style={styles.cardChevron} />
        </Pressable>
      )}
    </View>
  );
}

function PostThumbnail({ mediaId }: { mediaId: string | undefined }) {
  return (
    <View style={styles.thumbnail}>
      <MediaImage mediaId={mediaId} width={86} height={89} radius={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  heading: { flexDirection: 'row', alignItems: 'center', height: 24 },
  headingIcon: { marginLeft: 1, marginRight: 9 },
  headingText: { fontFamily: fonts.pixel, fontSize: 17, lineHeight: 24, color: '#777086' },
  seeAll: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#9b929d' },
  regionRow: { flexDirection: 'row', alignItems: 'center', height: 15, marginTop: 4, marginLeft: 3, gap: 7 },
  regionText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: '#a298a3' },
  hintText: { fontFamily: fonts.body, fontSize: 12, color: '#a1998e', marginTop: 8 },
  card: {
    height: 121,
    marginTop: 13,
    backgroundColor: '#fffef8',
    borderWidth: 1,
    borderColor: '#e2dacf',
    borderRadius: 17,
    shadowColor: '#495e70',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
  },
  thumbnail: { position: 'absolute', left: 15, top: 15, width: 86, height: 89, borderRadius: 12, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    left: 117,
    top: 15,
    height: 22,
    minWidth: 68,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf0e3',
    borderRadius: 8,
  },
  badgeText: { fontFamily: fonts.pixel, fontSize: 9.5, lineHeight: 13, color: '#91a17e' },
  timeText: { position: 'absolute', right: 51, top: 20, fontFamily: fonts.body, fontSize: 9.5, lineHeight: 13, color: '#aea5ae' },
  title: { position: 'absolute', left: 117, right: 18, top: 44, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#827a86' },
  features: { position: 'absolute', left: 117, right: 18, top: 67, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a39aa3' },
  locationRow: { position: 'absolute', left: 118, right: 40, top: 86, flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { flex: 1, fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#a39aa3' },
  cardChevron: { position: 'absolute', right: 15, top: 88 },
});
