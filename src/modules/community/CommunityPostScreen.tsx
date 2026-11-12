import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, Clock, Maximize2, MapPin, MessageSquare, PawPrint, Share2, Users, X } from 'lucide-react-native';
import { fonts } from '../../shared/lib/fonts';
import { formatRelativeTime } from '../../shared/lib/relativeTime';
import { ConnectionErrorView } from '../../shared/ui/ConnectionErrorView';
import { useCommunityPost } from './hooks/useCommunityPost';
import { MediaImage } from './components/MediaImage';
import { describeApproxTime, shortRegion } from './postText';
import { PostBottomActions, PostMenu } from './components/PostActions';
import { PostChip } from './components/PostChip';
import { ScreenFrame } from './components/ScreenFrame';
import type { CommunityPost } from './types';
import type { RootStackParamList } from '../../app/navigation';

const PHOTO_WIDTH = 382;
const PHOTO_HEIGHT = 226;

// Figma "06 찾기 상세" / "07 발견 상세" (pencil ROGaD / SVGiW). The action buttons at the bottom
// (목격 제보하기, 작성자에게 문의) and the 더보기 menu are F-21.
export function CommunityPostScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CommunityPost'>>();
  const { state, reload } = useCommunityPost(params.postId);

  return (
    <ScreenFrame title="동네 소식" right={state.status === 'ready' ? <PostMenu post={state.post} onChanged={reload} /> : undefined}>
      {state.status === 'loading' && <ActivityIndicator style={styles.loading} />}
      {state.status === 'error' && (
        <ConnectionErrorView
          message={state.code === 'RESOURCE_NOT_FOUND' ? '볼 수 없는 게시글이에요.' : '게시글을 불러오지 못했어요.'}
          onRetry={reload}
          onBack={() => navigation.goBack()}
        />
      )}
      {state.status === 'ready' && <PostBody post={state.post} navigation={navigation} />}
    </ScreenFrame>
  );
}

function PostBody({ post, navigation }: { post: CommunityPost; navigation: NativeStackNavigationProp<RootStackParamList> }) {
  const { content } = post;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const where = content.location;
  const isNews = post.category === 'NEIGHBOR_NEWS';
  const placeLabel = post.category === 'LOST' ? '마지막 장소' : post.category === 'FOUND' ? '발견한 장소' : '장소';
  const timeLabel = post.category === 'LOST' ? '마지막 목격' : post.category === 'FOUND' ? '발견한 시각' : '시각';

  return (
    <View>
      <View style={styles.topRow}>
        <PostChip category={post.category} large />
        <Pressable
          style={styles.share}
          onPress={() => Share.share({ message: `${content.title}\n${content.text}` })}
          hitSlop={8}
        >
          <Share2 size={16} color="#a59bb0" strokeWidth={1.8} />
          <Text style={styles.shareText}>공유</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{content.title}</Text>

      <View style={styles.author}>
        <View style={styles.authorAvatar}>
          <PawPrint size={13} color="#a89fb4" strokeWidth={1.8} />
        </View>
        <View style={styles.authorCopy}>
          <Text style={styles.authorName}>{post.authorName}</Text>
          {!!content.regionLabel && <Text style={styles.authorRegion}>{shortRegion(content.regionLabel)}</Text>}
        </View>
        <Text style={styles.time}>{formatRelativeTime(post.publishedAt ?? post.createdAt)}</Text>
      </View>

      {content.mediaIds.length > 0 && (
        <View style={styles.photoFrame}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / PHOTO_WIDTH))}
          >
            {content.mediaIds.map(id => (
              <MediaImage key={id} mediaId={id} width={PHOTO_WIDTH} height={PHOTO_HEIGHT} radius={18} />
            ))}
          </ScrollView>
          <Pressable style={styles.zoom} onPress={() => setZoom(true)} hitSlop={8}>
            <Maximize2 size={13} color="#a39aaa" strokeWidth={1.8} />
          </Pressable>
          <View style={styles.photoCount}>
            <Text style={styles.photoCountText}>
              {photoIndex + 1}/{content.mediaIds.length}
            </Text>
          </View>
        </View>
      )}

      {where && (
        <View style={styles.facts}>
          <View style={styles.factRow}>
            <MapPin size={14} color="#b9a9c2" strokeWidth={1.8} />
            <Text style={styles.factLabel}>{placeLabel}</Text>
            <Text style={styles.factValue} numberOfLines={1}>
              {where.label}
            </Text>
            <Pressable style={styles.factLink} onPress={() => navigation.navigate('CommunityLocations', { postId: post.id })} hitSlop={8}>
              <Text style={styles.factLinkText}>위치 보기</Text>
              <ChevronRight size={13} color="#a896b5" strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.factRow}>
            <Clock size={13} color="#b9a9c2" strokeWidth={1.8} />
            <Text style={styles.factLabel}>{timeLabel}</Text>
            <Text style={styles.factValue}>{describeApproxTime(where.occurredAt)}</Text>
          </View>
        </View>
      )}

      {content.features.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>이런 특징이 있어요</Text>
          <View style={styles.features}>
            {content.features.map(feature => (
              <View key={feature} style={styles.feature}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.body}>{content.text}</Text>

      <Pressable style={styles.counts} onPress={() => navigation.navigate('CommunityComments', { postId: post.id })}>
        {!isNews && (
          <View style={styles.count}>
            <Users size={14} color="#9b8aa7" strokeWidth={1.8} />
            <Text style={styles.countText}>목격 제보 {post.sightingCount}</Text>
          </View>
        )}
        <View style={styles.count}>
          <MessageSquare size={13} color="#9b8aa7" strokeWidth={1.8} />
          <Text style={styles.countText}>댓글 {post.commentCount}</Text>
        </View>
        <View style={styles.seeAll}>
          <Text style={styles.seeAllText}>모두 보기</Text>
          <ChevronRight size={14} color="#aa99b5" strokeWidth={2} />
        </View>
      </Pressable>

      <PostBottomActions post={post} />

      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(false)}>
          <MediaImage mediaId={content.mediaIds[photoIndex]} width={PHOTO_WIDTH} height={PHOTO_WIDTH * 1.1} radius={14} />
          <X size={22} color="#ffffff" strokeWidth={2} style={styles.zoomClose} />
        </Pressable>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  loading: { marginTop: 40 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  share: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  shareText: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a59bb0' },
  title: { fontFamily: fonts.pixel, fontSize: 18.5, lineHeight: 26, color: '#696578', marginTop: 12 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  authorAvatar: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#e6e2ec', alignItems: 'center', justifyContent: 'center' },
  authorCopy: { flex: 1 },
  authorName: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#8e8496' },
  authorRegion: { fontFamily: fonts.body, fontSize: 9, lineHeight: 13, color: '#b1a6b0' },
  time: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#a89eaa' },
  photoFrame: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT, marginTop: 20, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e1d9cf' },
  zoom: { position: 'absolute', top: 12, right: 12, width: 25, height: 25, borderRadius: 8, backgroundColor: '#fffef4', alignItems: 'center', justifyContent: 'center' },
  photoCount: { position: 'absolute', right: 12, bottom: 11, minWidth: 28, height: 24, paddingHorizontal: 6, borderRadius: 8, backgroundColor: '#fffef4', alignItems: 'center', justifyContent: 'center' },
  photoCountText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#9b8aa7' },
  facts: { marginTop: 19, paddingHorizontal: 17, paddingVertical: 14, gap: 16, backgroundColor: '#fffef8', borderWidth: 1, borderColor: '#e3dad0', borderRadius: 15 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factLabel: { width: 72, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: '#a69aa9' },
  factValue: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: '#858090' },
  factLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factLinkText: { fontFamily: fonts.pixel, fontSize: 9.5, lineHeight: 13, color: '#a896b5' },
  sectionTitle: { fontFamily: fonts.pixel, fontSize: 14, lineHeight: 20, color: '#7b7187', marginTop: 16, marginLeft: 1 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  feature: { height: 26, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f0ebf4', justifyContent: 'center' },
  featureText: { fontFamily: fonts.pixel, fontSize: 10.5, lineHeight: 14, color: '#a08dac' },
  body: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 20, color: '#928795', marginTop: 16, marginLeft: 1 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 22, paddingLeft: 3 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countText: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 15, color: '#9b8aa7' },
  seeAll: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  seeAllText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#aa99b5' },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(30,32,38,0.9)', alignItems: 'center', justifyContent: 'center' },
  zoomClose: { position: 'absolute', top: 60, right: 24 },
});
