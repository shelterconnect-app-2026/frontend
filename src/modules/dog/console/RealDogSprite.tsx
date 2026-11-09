import { Atlas, Canvas, FilterMode, Skia } from '@shopify/react-native-skia';
import type { GardenDogArt } from '../garden/GardenScene';

/** The dog's idle frame (front-facing) at `size` px. */
export function RealDogSprite({ art, size }: { art: GardenDogArt | null; size: number }) {
  const frame = art?.clip.frames[0];
  if (!art || !frame) return null;
  const scale = size / Math.max(frame.width, frame.height);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Atlas image={art.image}
        sprites={[Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height)]}
        transforms={[Skia.RSXform(scale, 0, (size - frame.width * scale) / 2, (size - frame.height * scale) / 2)]}
        sampling={{ filter: FilterMode.Nearest }} />
    </Canvas>
  );
}
