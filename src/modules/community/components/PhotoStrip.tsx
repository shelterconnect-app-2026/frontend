import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, X } from 'lucide-react-native';
import { fonts } from '../../../shared/lib/fonts';
import { RemoteImage } from '../../../shared/ui/RemoteImage';
import type { ComposePhoto } from '../composeForm';
import { MediaImage } from './MediaImage';

// 사진 추가 칸 + 썸네일(대표 표시 · 삭제). Newly picked photos show their local uri; photos that
// came with an existing post load through the signed media URL. Skia-only loading (CLAUDE.md).
export function PhotoStrip({ photos, max, uploading, onAdd, onRemove }: { photos: ComposePhoto[]; max: number; uploading: boolean; onAdd: () => void; onRemove: (mediaId: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {photos.map((photo, index) => (
        <Thumb key={photo.mediaId} photo={photo} cover={index === 0 && max > 1} onRemove={() => onRemove(photo.mediaId)} />
      ))}
      {photos.length < max && (
        <Pressable style={styles.add} onPress={onAdd} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#b2a0be" /> : <Camera size={26} color="#b2a0be" strokeWidth={1.6} />}
          <Text style={styles.addText}>{uploading ? '올리는 중' : '사진 추가'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Thumb({ photo, cover, onRemove }: { photo: ComposePhoto; cover: boolean; onRemove: () => void }) {
  return (
    <View style={styles.thumb}>
      {photo.uri ? <RemoteImage url={photo.uri} width={82} height={82} radius={12} /> : <MediaImage mediaId={photo.mediaId} width={82} height={82} radius={12} />}
      {cover && (
        <View style={styles.coverBadge}>
          <Text style={styles.coverText}>대표</Text>
        </View>
      )}
      <Pressable style={styles.remove} onPress={onRemove} hitSlop={8}>
        <X size={11} color="#af9bb6" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingTop: 6, paddingRight: 6 },
  add: { width: 82, height: 82, borderRadius: 12, borderWidth: 1, borderColor: '#d8c9df', backgroundColor: '#f8f4f8', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addText: { fontFamily: fonts.body, fontSize: 10, color: '#af9bba' },
  thumb: { width: 82, height: 82 },
  coverBadge: { position: 'absolute', left: 7, bottom: 7, paddingHorizontal: 7, height: 17, borderRadius: 6, backgroundColor: 'rgba(255,254,244,0.92)', justifyContent: 'center' },
  coverText: { fontFamily: fonts.body, fontSize: 8.5, color: '#ae8c9d' },
  remove: { position: 'absolute', top: -5, right: -5, width: 21, height: 21, borderRadius: 10.5, backgroundColor: '#fffef8', borderWidth: 1, borderColor: '#dcceda', alignItems: 'center', justifyContent: 'center' },
});
