import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Atlas, Canvas, FilterMode, Group, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { DogAssetClip } from '../types';

const layout = require('./assets/garden-layout.json') as {
  width: number;
  height: number;
  sprites: [number, number, number, number, number, number][];
};
const nearest = { filter: FilterMode.Nearest };
const LOADING_FRAMES = 120;
const LOADING_COLUMNS = 12;
const LOADING_FRAME_WIDTH = 240;
const LOADING_FRAME_HEIGHT = 188;
const LOADING_WIDTH = 720;
const LOADING_HEIGHT = 1280;
const PLAYER_FRAME_SIZE = 24;
const PLAYER_WALK_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];

export interface GardenDogArt { image: SkImage; clip: DogAssetClip }

/** Compose the approved garden from its original sprites, then place this dog's own atlas above it. */
export function GardenScene({ width, height, dog, travelDog, frameIndex, loading, arriving, arrivalProgress }: {
  width: number; height: number; dog: GardenDogArt | null; travelDog: GardenDogArt | null;
  frameIndex: number; loading: boolean; arriving: boolean; arrivalProgress: SharedValue<number>;
}) {
  const atlas = useImage(require('./assets/garden-atlas.png'));
  const playerAtlas = useImage(require('../../game/core/assets/character/player-walk.png'));
  const loadingBackground = useImage(require('./assets/loading-background.png'));
  const loadingBack = useImage(require('./assets/loading-garden-back.png'));
  const loadingFront = useImage(require('./assets/loading-garden-front.png'));
  const loadingPaws = useImage(require('./assets/loading-paws.png'));
  const [loadingFrame, setLoadingFrame] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setLoadingFrame(index => (index + 1) % LOADING_FRAMES), 50);
    return () => clearInterval(timer);
  }, [loading]);
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
  const size = Math.min(width * 0.15, 62);
  const scale = frame ? size / frame.width : 1;
  const dogHeight = frame ? frame.height * scale : size;
  const playerSize = Math.min(width * 0.21, 82);
  const playerStartY = height * 0.73 - playerSize / 2;
  const playerEndCenterY = height * 0.45 + dogHeight / 2 + playerSize / 2 + 3;
  const playerEndY = playerEndCenterY - playerSize / 2;
  const playerSprites = useDerivedValue(() => {
    const walkFrameIndex = arriving
      ? PLAYER_WALK_SEQUENCE[Math.min(PLAYER_WALK_SEQUENCE.length - 1,
        Math.floor(arrivalProgress.value * PLAYER_WALK_SEQUENCE.length))]
      : 0;
    return [Skia.XYWHRect(walkFrameIndex * PLAYER_FRAME_SIZE, 0, PLAYER_FRAME_SIZE, PLAYER_FRAME_SIZE)];
  }, [arriving]);
  const playerTransforms = useDerivedValue(() => {
    const progress = Math.max(0, Math.min(1, arrivalProgress.value));
    const easedProgress = progress * progress * (3 - 2 * progress);
    const playerX = width * (0.4 + 0.1 * easedProgress) - playerSize / 2;
    const playerY = playerStartY + (playerEndY - playerStartY) * easedProgress;
    return [Skia.RSXform(playerSize / PLAYER_FRAME_SIZE, 0, playerX, playerY)];
  }, [width, playerSize, playerStartY, playerEndY]);
  // The loading artwork has a fixed 720×1280 coordinate system. Fit the entire
  // composition on every phone instead of letting a native GIF crop its title.
  const loadingScale = Math.min(width / LOADING_WIDTH, height / LOADING_HEIGHT);
  const loadingX = (width - LOADING_WIDTH * loadingScale) / 2;
  const loadingY = (height - LOADING_HEIGHT * loadingScale) / 2;
  const loadingSprite = Skia.XYWHRect(
    loadingFrame % LOADING_COLUMNS * LOADING_FRAME_WIDTH,
    Math.floor(loadingFrame / LOADING_COLUMNS) * LOADING_FRAME_HEIGHT,
    LOADING_FRAME_WIDTH, LOADING_FRAME_HEIGHT,
  );
  const sceneX = loadingX;
  const sceneY = loadingY + 352 * loadingScale;
  const sceneScale = loadingScale * 3;
  const movingDog = travelDog ?? dog;
  const movingFrame = movingDog?.clip.frames[frameIndex % movingDog.clip.frames.length];
  const movingSize = movingFrame ? 33 * sceneScale / Math.max(movingFrame.width, movingFrame.height) : 1;
  const dogAnchorX = loadingFrame < 84 ? 66.2 + loadingFrame * 2.45 : -22 + (loadingFrame - 84) * 2.45;
  const pawState = Math.floor(loadingFrame / 10) % 3;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {loading ? <>
          {loadingBackground && <Atlas image={loadingBackground}
            sprites={[Skia.XYWHRect(0, 0, LOADING_WIDTH, LOADING_HEIGHT)]}
            transforms={[Skia.RSXform(loadingScale, 0, loadingX, loadingY)]} sampling={nearest} />}
          <Group clip={Skia.XYWHRect(sceneX, sceneY, LOADING_WIDTH * loadingScale, LOADING_FRAME_HEIGHT * sceneScale)}>
            {loadingBack && <Atlas image={loadingBack} sprites={[loadingSprite]}
              transforms={[Skia.RSXform(sceneScale, 0, sceneX, sceneY)]} sampling={nearest} />}
            {movingDog && movingFrame && <Atlas image={movingDog.image}
              sprites={[Skia.XYWHRect(movingFrame.x, movingFrame.y, movingFrame.width, movingFrame.height)]}
              transforms={[Skia.RSXform(movingSize, 0,
                sceneX + dogAnchorX * sceneScale - movingFrame.width * movingSize / 2,
                sceneY + 120 * sceneScale - movingFrame.height * movingSize * 0.875)]} sampling={nearest} />}
            {loadingFront && <Atlas image={loadingFront} sprites={[loadingSprite]}
              transforms={[Skia.RSXform(sceneScale, 0, sceneX, sceneY)]} sampling={nearest} />}
          </Group>
          {loadingPaws && <Atlas image={loadingPaws}
            sprites={[Skia.XYWHRect(pawState * 85, 0, 85, 18)]}
            transforms={[Skia.RSXform(loadingScale, 0, loadingX + 319 * loadingScale, loadingY + 1027 * loadingScale)]}
            sampling={nearest} />}
        </> : <>
          {atlas && <Atlas image={atlas} sprites={scenery.sprites} transforms={scenery.transforms} sampling={nearest} />}
          {dog && frame && <Atlas image={dog.image} sprites={[Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height)]}
            transforms={[Skia.RSXform(scale, 0, (width - frame.width * scale) / 2, height * 0.45 - frame.height * scale / 2)]}
            sampling={nearest} />}
          {dog && playerAtlas && <Atlas image={playerAtlas} sprites={playerSprites}
            transforms={playerTransforms} sampling={nearest} />}
        </>}
      </Canvas>
    </View>
  );
}
