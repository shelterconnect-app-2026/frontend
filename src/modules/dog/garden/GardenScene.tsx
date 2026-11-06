import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Atlas, Canvas, FilterMode, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import type { DogAssetClip } from '../types';

const layout = require('./assets/garden-layout.json') as {
  width: number;
  height: number;
  sprites: [number, number, number, number, number, number][];
};
const nearest = { filter: FilterMode.Nearest };

export interface GardenDogArt { image: SkImage; clip: DogAssetClip }

/** Compose the approved garden from its original sprites, then place this dog's own atlas above it. */
export function GardenScene({ width, height, dog, frameIndex, loading }: {
  width: number; height: number; dog: GardenDogArt | null; frameIndex: number; loading: boolean;
}) {
  const atlas = useImage(require('./assets/garden-atlas.png'));
  const scenery = useMemo(() => {
    const scale = Math.max(width / layout.width, height / layout.height);
    const offsetX = (width - layout.width * scale) / 2;
    const offsetY = (height - layout.height * scale) / 2;
    return {
      sprites: layout.sprites.map(([x, y, w, h]) => Skia.XYWHRect(x, y, w, h)),
      transforms: layout.sprites.map(([, , , , x, y]) => Skia.RSXform(scale, 0, offsetX + x * scale, offsetY + y * scale)),
    };
  }, [width, height]);
  const frame = dog?.clip.frames[frameIndex % dog.clip.frames.length];
  const size = Math.min(width * 0.19, 80);
  const scale = frame ? size / frame.width : 1;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {loading && <Image source={require('./assets/garden-loading.gif')} resizeMode="cover" style={StyleSheet.absoluteFill} />}
      <Canvas style={StyleSheet.absoluteFill}>
        {!loading && atlas && <Atlas image={atlas} sprites={scenery.sprites} transforms={scenery.transforms} sampling={nearest} />}
        {dog && frame && <Atlas image={dog.image} sprites={[Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height)]}
          transforms={[Skia.RSXform(scale, 0, (width - frame.width * scale) / 2, height * (loading ? 0.56 : 0.45) - frame.height * scale / 2)]}
          sampling={nearest} />}
      </Canvas>
    </View>
  );
}
