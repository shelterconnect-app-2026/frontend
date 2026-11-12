import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { RotateCcw } from 'lucide-react-native';

interface RemoteImageProps {
  url: string | null;
  width: number;
  height: number;
  radius: number;
  /** Shown until (or instead of) the image. */
  placeholder?: string;
  /** Called when the download/decode fails (e.g. an expired signed URL). */
  onError?: () => void;
  /** When set, a failed tile shows a reload button instead of a blank background. */
  onRetry?: () => void;
}

// Skia-only image loading (CLAUDE.md) with a rounded, cover-fit tile.
export function RemoteImage({ url, width, height, radius, placeholder = '#eee8da', onError, onRetry }: RemoteImageProps) {
  const image = useImage(url ?? undefined, onError);
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: placeholder }}>
      {image && (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover" />
        </Canvas>
      )}
      {!image && onRetry && (
        <Pressable style={styles.retry} onPress={onRetry} hitSlop={6} accessibilityLabel="사진 다시 불러오기">
          <RotateCcw size={Math.min(20, width / 3)} color="#a39aaa" strokeWidth={1.8} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  retry: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
