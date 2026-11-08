import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Canvas, Image as SkiaImage, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { SpriteFrame } from '../../game/core/entities/SpriteFrame';
import { useCurrentShelter } from '../../dog/hooks/useCurrentShelter';
import { fetchDogAssets, fetchShelterDetail, fetchShelterDogs } from '../../dog/api/shelters';
import { homeImages } from '../assets/images';
import { fonts } from '../../../shared/lib/fonts';
import { HomeSvg } from './HomeSvg';
import type { HomeTabScreenNavigationProp } from '../../../app/navigation';
import type { DogAssetClip, DogAssetManifest, ShelterDetail } from '../../dog/types';

const MAP_PREVIEW_HEIGHT = 162;

interface PreviewDog {
  id: string;
  manifest: DogAssetManifest;
  clip: DogAssetClip;
  image: SkImage;
}

// Figma "Card / Shelter entrance" (node 1:97): "맵은 PNG 미리보기이며, 실제 앱에서는 기존
// 맵 씬으로 연결합니다" — keep the exported map preview, but draw the selected shelter's
// own approved dog sprites over it instead of the two illustration-only sample dogs.
export function ShelterEntranceCard() {
  const navigation = useNavigation<HomeTabScreenNavigationProp>();
  const { state } = useCurrentShelter();
  const [shelter, setShelter] = useState<ShelterDetail | null>(null);
  const [previewDogs, setPreviewDogs] = useState<PreviewDog[]>([]);
  const [mapWidth, setMapWidth] = useState(0);
  const mapImage = useImage(homeImages.mapPreview);
  const shelterId = state.status === 'ready' ? state.shelterId : null;

  useEffect(() => {
    if (!shelterId) {
      setShelter(null);
      return;
    }
    let cancelled = false;
    fetchShelterDetail(shelterId).then(
      ({ data }) => !cancelled && setShelter(data),
      () => !cancelled && setShelter(null),
    );
    return () => {
      cancelled = true;
    };
  }, [shelterId]);

  useEffect(() => {
    if (!shelterId) {
      setPreviewDogs([]);
      return;
    }
    let cancelled = false;
    setPreviewDogs([]);

    (async () => {
      try {
        const { data: dogs } = await fetchShelterDogs(shelterId, { limit: 2 });
        const sprites = await Promise.all(dogs.slice(0, 2).map(async dog => {
          try {
            const { data: manifest } = await fetchDogAssets(dog.id);
            const clip = manifest.mapDirections?.DOWN?.IDLE
              ?? manifest.animations.IDLE
              ?? manifest.animations[manifest.fallbackAction];
            if (!clip?.frames.length) return null;
            const data = await Skia.Data.fromURI(clip.spritesheetUrl);
            const image = Skia.Image.MakeImageFromEncoded(data);
            return image ? { id: dog.id, manifest, clip, image } : null;
          } catch {
            // No unrelated placeholder: only dogs with this shelter's own sprite are shown.
            return null;
          }
        }));
        if (!cancelled) setPreviewDogs(sprites.filter((dog): dog is PreviewDog => dog !== null));
      } catch {
        if (!cancelled) setPreviewDogs([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shelterId]);

  const goToShelterTab = () => navigation.navigate('보호소');

  if (state.status === 'loading') {
    return <View style={[styles.card, styles.empty]} />;
  }

  if (!shelterId || !shelter) {
    return (
      <View style={[styles.card, styles.empty]}>
        <PaperDecoration />
        <HomeSvg name="houseCard" width={28} height={28} />
        <Text style={styles.emptyText}>아직 선택한 보호소가 없어요</Text>
        <PrimaryButton label="보호소 선택하기" onPress={goToShelterTab} style={styles.emptyButton} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <PaperDecoration />
      <HomeSvg name="houseCard" width={18} height={18} style={styles.houseIcon} />
      <Text style={styles.shelterName}>{shelter.name}</Text>
      <Text style={styles.subtitle}>친구 {shelter.dogCount}마리가 기다리고 있어요</Text>
      <Pressable style={styles.changeButton} onPress={goToShelterTab}>
        <Text style={styles.changeButtonText}>보호소 변경</Text>
        <HomeSvg name="chevronChange" width={12} height={12} />
      </Pressable>

      <View style={styles.mapPreview} onLayout={e => setMapWidth(e.nativeEvent.layout.width)}>
        {mapWidth > 0 && (
          <Canvas style={StyleSheet.absoluteFill}>
            {mapImage && <SkiaImage image={mapImage} x={0} y={0} width={mapWidth} height={MAP_PREVIEW_HEIGHT} fit="cover" />}
            {previewDogs.map((dog, index) => {
              const frame = dog.clip.frames[0];
              const frameWidth = dog.manifest.frameSize.width;
              const frameHeight = dog.manifest.frameSize.height;
              const size = Math.min(40, mapWidth * 0.145);
              const scale = size / frameWidth;
              const groundX = mapWidth * (previewDogs.length === 1 ? 0.55 : index === 0 ? 0.43 : 0.69);
              const groundY = MAP_PREVIEW_HEIGHT - 2;
              return (
                <SpriteFrame
                  key={dog.id}
                  sheet={dog.image}
                  frameSize={frameWidth}
                  col={frame.x / frameWidth}
                  row={frame.y / frameHeight}
                  x={groundX - dog.manifest.anchorPixels.x * scale}
                  y={groundY - dog.manifest.anchorPixels.y * scale}
                  size={size}
                />
              );
            })}
          </Canvas>
        )}
        <View style={styles.mapLabel}>
          <Text style={styles.mapLabelText}>햇살 운동장</Text>
        </View>
        {previewDogs.length > 0 && <View style={styles.speechBubble}>
          <Text style={styles.speechBubbleText}>안녕, 친구!</Text>
        </View>}
      </View>

      <PrimaryButton
        label="보호소 둘러보기"
        onPress={() => navigation.navigate('Game', { shelterId: shelter.id, shelterName: shelter.name })}
        style={styles.enterButton}
      />
    </View>
  );
}

// 종이 안쪽 테두리 + 마스킹 테이프 2장 (Figma "종이 안쪽 테두리", "테이프 / 왼쪽·오른쪽").
function PaperDecoration() {
  return (
    <>
      <View style={styles.paperInner} pointerEvents="none" />
      <View style={[styles.tape, styles.tapeLeft]} pointerEvents="none" />
      <View style={[styles.tape, styles.tapeRight]} pointerEvents="none" />
    </>
  );
}

function PrimaryButton({ label, onPress, style }: { label: string; onPress: () => void; style: object }) {
  return (
    <Pressable style={[styles.primaryButton, style]} onPress={onPress}>
      <HomeSvg name="pawButton" width={16} height={16} />
      <Text style={styles.primaryButtonText}>{label}</Text>
      <HomeSvg name="chevronButton" width={16} height={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 301,
    backgroundColor: '#fffdf4',
    borderWidth: 1.2,
    borderColor: '#c8d9da',
    borderRadius: 22,
    shadowColor: '#495e70',
    shadowOpacity: 0.09,
    shadowRadius: 3.5,
    shadowOffset: { width: 0, height: 5 },
  },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: '#8e9b8c' },
  emptyButton: { alignSelf: 'stretch', marginHorizontal: 16 },
  paperInner: {
    position: 'absolute',
    top: 2.6,
    left: 2.6,
    right: 2.6,
    bottom: 2.6,
    borderWidth: 0.8,
    borderColor: '#eee8d7',
    borderRadius: 18,
  },
  tape: { position: 'absolute', top: -6.2, height: 13, backgroundColor: '#bfdde6', opacity: 0.7, borderRadius: 2 },
  tapeLeft: { left: 21.8, width: 47 },
  tapeRight: { right: 24.8, width: 44 },
  houseIcon: { position: 'absolute', left: 15.8, top: 18.8 },
  shelterName: { position: 'absolute', left: 44.8, top: 10.8, fontFamily: fonts.pixel, fontSize: 18, lineHeight: 25, color: '#5d6b68' },
  subtitle: { position: 'absolute', left: 16.8, top: 37.8, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: '#8e9b8c' },
  changeButton: {
    position: 'absolute',
    right: 16.8,
    top: 18.8,
    width: 90,
    height: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#f5f1e8',
    borderWidth: 0.7,
    borderColor: '#e1d9c8',
    borderRadius: 12,
  },
  changeButtonText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: '#958771' },
  mapPreview: {
    position: 'absolute',
    left: 16.8,
    right: 16.8,
    top: 63.8,
    height: MAP_PREVIEW_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a9c1a3',
    overflow: 'hidden',
    backgroundColor: '#e3ecdf',
  },
  mapLabel: {
    position: 'absolute',
    left: 11,
    top: 10,
    width: 77,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf1',
    borderRadius: 10,
  },
  mapLabelText: { fontFamily: fonts.pixel, fontSize: 10, lineHeight: 14, color: '#75855d' },
  speechBubble: {
    position: 'absolute',
    left: '47%',
    top: 89,
    width: 65,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffef1',
    borderWidth: 1,
    borderColor: '#bbc89f',
    borderRadius: 6,
  },
  speechBubbleText: { fontFamily: fonts.pixel, fontSize: 9, lineHeight: 13, color: '#79926a' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    height: 44,
    backgroundColor: '#e5d9f0',
    borderWidth: 1,
    borderColor: '#b9a6ca',
    borderRadius: 11,
    shadowColor: '#495e70',
    shadowOpacity: 0.28,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
  },
  enterButton: { position: 'absolute', left: 16.8, right: 16.8, top: 238.8 },
  primaryButtonText: { fontFamily: fonts.pixel, fontSize: 14, lineHeight: 20, color: '#746086' },
});
