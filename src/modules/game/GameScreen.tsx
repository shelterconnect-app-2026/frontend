import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  matchFont,
  RoundedRect,
  Text as SkiaText,
  useImage,
} from '@shopify/react-native-skia';
import { groundImage, mapLayout, propImages, reedsSheet, grassSheet, waterFullMapFrames } from './core/assets/maps/sunnyMeadow';
import {
  PLAYER_FRAME_SIZE,
  PLAYER_SHEET_COLS,
  PLAYER_WALK_ROW,
  playerWalkSheet,
} from './core/assets/character/playerWalk';
import { DOG_IDENTITY_COUNT } from './core/assets/dog/dogWalkAtlas';
// Fallback art for dogs without an approved /assets manifest yet (the demo dogs).
import { localDogAssetManifest } from './core/assets/dog/real-v1/localManifest';
import { usePropImages } from './core/assets/usePropImages';
import { DogSprite } from './core/entities/DogSprite';
import { loadDogSheets, type DogSheets } from './core/assets/loadDogSheets';
import { SpriteFrame } from './core/entities/SpriteFrame';
import { createDogAgent, tickDog, type DogAgent, type DogState } from './core/systems/dogStateMachine';
import { movementFacing } from './core/systems/spritePlayback';
import type { DogSpriteDirection } from '../dog/types';
import {
  ballControl,
  ballDogPose,
  createBallPlayState,
  findThrowTarget,
  isBallPlayActive,
  startReceive,
  BASE_DOG_SIZE,
  startThrow,
  tickBallPlay,
  type BallPlayState,
} from './core/systems/ballPlay';
import { BallSprite } from './core/entities/BallSprite';
import { PLAYER_ACTION_CELL, PLAYER_ACTION_FRAMES, PLAYER_ACTION_MS, PLAYER_ACTION_ROW, playerActionsSheet } from './core/assets/character/playerActions';
import { stepMovement } from './core/systems/movement';
import { Joystick } from './input/Joystick';
import { useShelterDogs, type DogWithBehavior } from '../dog/hooks/useShelterDogs';
import { cacheDogPreviewArt } from '../dog/api/dogAssetPreviewCache';
import { displayDogName } from '../dog/displayDogName';
import type { RootStackParamList } from '../../app/navigation';

const DOG_DISPLAY_SIZE = 27;
// Where the dog sprite is drawn relative to the dog's ground point (map units, +x right / +y down).
// Tuned with tools/game-tuner (docs/game-tuner.md).
const DOG_SPRITE_OFFSET = { x: 0, y: 0 };
// The player-vs-dog collision box (below) needs to roughly match what's actually drawn,
// not `dogStateMachine.ts`'s DOG_RADIUS=8 — that one sizes the dog's own path-finding
// around static obstacles and was never tied to DOG_DISPLAY_SIZE. Tuned by eye on-device
// against the real sprite rather than derived: small (most of the display box is
// transparent padding) and centered well above dog.y (the ground/foot anchor, not the
// visual middle of the dog).
const DOG_COLLISION_RADIUS = DOG_DISPLAY_SIZE * 0.18;
const DOG_COLLISION_Y_OFFSET = DOG_DISPLAY_SIZE * 0.22;
// Pixel art, nearest-neighbor only — no blur from bilinear interpolation on upscale.
const NEAREST_SAMPLING = { filter: FilterMode.Nearest };

const PLAYER_RADIUS = 11.5;
const PLAYER_DISPLAY_SIZE = 54;
// How far the player sprite is drawn from the collision circle's center (map units, +x right / +y down) —
// the circle (PLAYER_RADIUS) is where the player really stands. Tuned with tools/game-tuner (docs/game-tuner.md).
const PLAYER_SPRITE_OFFSET = { x: 1, y: -17 };
const PLAYER_SPEED = 55; // px/s of map space
const RUN_MULTIPLIER = 1.8;
// How many map units are visible across the viewport's width — smaller = more zoomed in.
// Height follows the screen's aspect ratio so a tall phone just shows more vertically.
// Raised from 160 alongside the *_DISPLAY_SIZE bumps above so the view shows more of
// the map while characters still end up bigger on screen than before, not smaller.
const VIEWPORT_MAP_UNITS = 200;
const ANIM_FRAME_MS = 250;
const ANIM_FRAME_COUNT = 8;
const PLANT_DISPLAY_SIZE = 24;
// Walk cycle reads better faster than the 250ms environment clock, and bouncing
// back and forth through the columns instead of looping straight through reads
// more like footsteps than the flat forward loop did.
const PLAYER_ANIM_FRAME_MS = 90;
const PLAYER_WALK_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
// How close the player needs to be to a dog before "talk" shows up, in map units.
const TALK_RANGE = 40;
// One prototype "pixel" of the ball, in map units (the prototype's dog is ~30px, ours 44 units).
const BALL_PIXEL = 1.5;
// The player's hand while holding / receiving the ball, relative to the drawn sprite's center
// (collision circle center + PLAYER_SPRITE_OFFSET).
// (14, -2) was measured for the 64-unit player sprite — scaled with PLAYER_DISPLAY_SIZE.
const HAND_OFFSET = { x: 14 * (PLAYER_DISPLAY_SIZE / 64), y: -2 * (PLAYER_DISPLAY_SIZE / 64) };
// The ball sits at the dog's mouth — its offsets were measured for a 44-unit dog.
const DOG_SCALE = DOG_DISPLAY_SIZE / BASE_DOG_SIZE;

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

const DEFAULT_DOG_FACING: DogSpriteDirection = 'DOWN';

// A small "what's this dog doing" label floated over each dog — ball-play gets its own
// wording (the phase already reads as more specific than the borrowed IDLE/SNIFF pose).
const DOG_STATE_LABELS: Record<DogState, string> = {
  IDLE: '쉬는 중',
  WALK: '산책 중',
  RUN: '신나게 뛰는 중',
  SNIFF: '냄새 맡는 중',
  TAIL_WAG: '꼬리 흔드는 중',
  BACK_OFF: '뒷걸음질 치는 중',
  SIT: '앉아있음',
  LIE_DOWN: '누워있음',
};

// Prototype wording (natural-dogs.js dogActivity) for the dog's label while the ball game runs.
const BALL_PLAY_LABELS: Record<BallPlayState['phase'], string> = {
  REST: '',
  FETCH: '공 쫓아가기',
  PICK: '공 줍는 중',
  RETURN: '공 가져오기',
  OFFER: '공 받아줘!',
  RECEIVING: '공놀이',
  READY: '던져줘!',
  WINDUP: '공놀이',
  FLIGHT: '공 쫓아가기',
};

function dogStatusLabel(dog: DogAgent, ball: BallPlayState | undefined, ballActive: boolean): string {
  if (ballActive && ball) {
    return BALL_PLAY_LABELS[ball.phase];
  }
  return DOG_STATE_LABELS[dog.state];
}

// ponytail: JS-thread requestAnimationFrame loop, not a Reanimated UI-thread worklet —
// simplest thing that works for one moving entity. Move to useFrameCallback if frame
// drops show up once more entities are added.
export function GameScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Game'>>();
  const ground = useImage(groundImage);
  const grass = useImage(grassSheet);
  const reeds = useImage(reedsSheet);
  const playerSheet = useImage(playerWalkSheet);
  const props = usePropImages(propImages);
  // Fixed-size array from a module constant — same reasoning as usePropImages.
  const waterFrames = [
    useImage(waterFullMapFrames[0]),
    useImage(waterFullMapFrames[1]),
    useImage(waterFullMapFrames[2]),
    useImage(waterFullMapFrames[3]),
    useImage(waterFullMapFrames[4]),
    useImage(waterFullMapFrames[5]),
    useImage(waterFullMapFrames[6]),
    useImage(waterFullMapFrames[7]),
  ];

  const shelterDogs = useShelterDogs(params.shelterId);
  // Font for each dog's status label, drawn inside the same Canvas/paint pass as the dog
  // sprites themselves (in the dogs.forEach loop below) — an RN View sibling positioned
  // via transform still visibly lagged the Skia-drawn dog it was supposed to track, since
  // the two update on separate native pipelines/clocks.
  // A specific family (not "System") because Skia's font matching doesn't get UIKit's
  // automatic Korean-glyph fallback the way a plain RN <Text> would.
  // 'Apple SD Gothic Neo' is the family name Skia's font matcher needs (CoreText
  // family+style lookup) — 'AppleSDGothicNeo-Bold' is a PostScript instance name, not a
  // family, so it silently fell back to a Hangul-less default font and drew nothing.
  const dogLabelFont = useMemo(() => matchFont({ fontFamily: 'Apple SD Gothic Neo', fontWeight: 'bold', fontSize: 10 }), []);

  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const scale = viewportWidth / VIEWPORT_MAP_UNITS;
  const visibleMapUnitsY = viewportHeight / scale;

  const [player, setPlayer] = useState(mapLayout.spawn);
  const [dogs, setDogs] = useState<DogAgent[]>([]);
  const [dogMeta, setDogMeta] = useState<DogWithBehavior[]>([]);
  const [dogSheets, setDogSheets] = useState<DogSheets[]>([]);
  const [dogsSpawned, setDogsSpawned] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [playerAnimStep, setPlayerAnimStep] = useState(0);
  const isMoving = useRef(false);
  const facingLeft = useRef(false);
  const direction = useRef({ dx: 0, dy: 0 });
  const playerPosRef = useRef(mapLayout.spawn);
  const dogFacingRef = useRef<DogSpriteDirection[]>([]);
  const ballStatesRef = useRef<BallPlayState[]>([]);
  const lastDirectionRef = useRef({ dx: 0, dy: 1 }); // toward the viewer by default — where to aim a throw
  // Mirrors `dogs` state so the player's own movement this same tick can collide against
  // where dogs were as of last tick — a frame stale, imperceptible, and avoids feeding
  // React state straight back into the same tick's obstacle list.
  const dogsRef = useRef<DogAgent[]>([]);

  // Spawn one dog per slot once the shelter's dogs + behavior settings arrive AND every
  // dog's sheets are loaded — the loading screen covers the map until then, so dogs never
  // appear as placeholder art first and swap later.
  useEffect(() => {
    if (shelterDogs.status !== 'ready') {
      return;
    }
    let cancelled = false;
    Promise.all(shelterDogs.dogs.map(dog => loadDogSheets(dog.manifest ?? localDogAssetManifest))).then(sheets => {
      if (cancelled) {
        return;
      }
      shelterDogs.dogs.forEach((dog, index) => {
        cacheDogPreviewArt(dog.id, dog.manifest ?? localDogAssetManifest, sheets[index] ?? {});
      });
      setDogSheets(sheets);
      setDogsSpawned(true);
      setDogMeta(shelterDogs.dogs);
      setDogs(
        shelterDogs.dogs.map((_, i) => {
          const slot = mapLayout.slots[i % mapLayout.slots.length];
          return createDogAgent(slot.x, slot.y);
        }),
      );
      ballStatesRef.current = shelterDogs.dogs.map((_, i) => {
        const slot = mapLayout.slots[i % mapLayout.slots.length];
        return createBallPlayState(slot.x, slot.y);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [shelterDogs]);

  useEffect(() => {
    let raf: number;
    let last = Date.now();
    let animAccumulator = 0;
    let playerAnimAccumulator = 0;

    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const { dx, dy } = direction.current;
      // The throw / receive gesture roots the player for its short duration (prototype advancePlayer).
      const gesturing = ballStatesRef.current.some(ball => ball.playerAction !== null);
      isMoving.current = !gesturing && (dx !== 0 || dy !== 0);
      if (dx !== 0) {
        facingLeft.current = dx < 0;
      }
      if (isMoving.current) {
        lastDirectionRef.current = { dx, dy };
      }
      if (isMoving.current) {
        const speed = Math.hypot(dx, dy) > 0.8 ? PLAYER_SPEED * RUN_MULTIPLIER : PLAYER_SPEED;
        // Dogs block the player's own path (one tick stale — imperceptible), same as any
        // other map obstacle. Dogs themselves still walk through the player/each other;
        // only this direction was asked for.
        // (dog.x, dog.y) is the dog's ground/foot point (DogSprite anchors the real
        // manifest art there, near the bottom of the sprite), not its visual center —
        // shift the box up by DOG_COLLISION_Y_OFFSET so it actually sits over the dog's
        // body instead of straddling (or hanging below) its feet.
        const dogObstacles = dogsRef.current
          .map(dog => ({
            centerX: dog.x,
            centerY: dog.y - DOG_COLLISION_Y_OFFSET,
          }))
          // stepMovement only ever PREVENTS new overlap, it never pushes an already-
          // overlapping actor back out — since dogs (unlike the player) aren't blocked by
          // this box, one can wander straight into the player's own spot. Left in as an
          // obstacle, that overlap would then block every direction at once and wedge the
          // player in place. Drop any dog the player is already touching so they can still
          // step away; every dog they aren't yet touching still blocks normally.
          .filter(dog => Math.hypot(playerPosRef.current.x - dog.centerX, playerPosRef.current.y - dog.centerY) > PLAYER_RADIUS + DOG_COLLISION_RADIUS)
          .map(dog => ({
            x: dog.centerX - DOG_COLLISION_RADIUS,
            y: dog.centerY - DOG_COLLISION_RADIUS,
            w: DOG_COLLISION_RADIUS * 2,
            h: DOG_COLLISION_RADIUS * 2,
          }));
        const moved = stepMovement({
          x: playerPosRef.current.x,
          y: playerPosRef.current.y,
          dx,
          dy,
          speed,
          dt,
          radius: PLAYER_RADIUS,
          bounds: mapLayout.bounds,
          obstacles: [...mapLayout.obstacles, ...dogObstacles],
        });
        playerPosRef.current = moved;
        setPlayer(moved);
      }

      setDogs(prevDogs => {
        const nextDogs = prevDogs.map((agent, i) => {
          if (!dogMeta[i]) {
            return agent;
          }
          const settings = dogMeta[i].behavior.settings;
          const ball = ballStatesRef.current[i] ?? createBallPlayState(agent.x, agent.y);
          // The ball game and the wandering FSM never drive the same dog in the same tick: while a
          // game is running (any phase but REST) tickDog just doesn't run, and it resumes where it
          // left off afterwards. REST only watches for the player coming close.
          const hand = {
            x: playerPosRef.current.x + PLAYER_SPRITE_OFFSET.x + (facingLeft.current ? -HAND_OFFSET.x : HAND_OFFSET.x),
            y: playerPosRef.current.y + PLAYER_SPRITE_OFFSET.y + HAND_OFFSET.y,
          };
          const result = tickBallPlay(
            ball,
            { x: agent.x, y: agent.y },
            dogFacingRef.current[i] ?? DEFAULT_DOG_FACING,
            settings,
            playerPosRef.current,
            hand,
            dt,
            mapLayout.bounds,
            mapLayout.obstacles,
            DOG_SCALE,
          );
          ballStatesRef.current[i] = result.state;
          if (isBallPlayActive(result.state)) {
            return { ...agent, x: result.dogPos.x, y: result.dogPos.y };
          }
          // Each dog's own /assets manifest (bundled real-v1 art if it has none). The behavior
          // values are the backend's, as served — no local weight overrides — so each dog moves
          // by its own settings and PERSON_GREETING recipe (docs/trait-selected-sprites.md).
          return tickDog(
            agent,
            settings,
            dt,
            playerPosRef.current,
            mapLayout.bounds,
            mapLayout.obstacles,
            Math.random,
            dogMeta[i].manifest ?? localDogAssetManifest,
            dogMeta[i].behavior.interactions?.PERSON_GREETING ?? null,
          );
        });
        // Actual displacement, not a target point — a dog blocked by an obstacle isn't
        // really moving, so it shouldn't animate as if it is (this also naturally covers
        // ball-play: result.dogPos already reflects wherever tickBallPlay really put it,
        // no separate ball.phase/target-based case needed).
        dogFacingRef.current = nextDogs.map((agent, i) => {
          const previous = dogFacingRef.current[i] ?? DEFAULT_DOG_FACING;
          const phase = ballStatesRef.current[i]?.phase;
          // A dog waiting with / for the ball turns toward the player (prototype faceBallPlayer).
          if (phase === 'OFFER' || phase === 'RECEIVING' || phase === 'READY' || phase === 'WINDUP') {
            return movementFacing(playerPosRef.current.x - agent.x, playerPosRef.current.y - agent.y, previous);
          }
          const backwards = agent.state === 'BACK_OFF' && !isBallPlayActive(ballStatesRef.current[i] ?? createBallPlayState());
          return movementFacing(agent.x - prevDogs[i].x, agent.y - prevDogs[i].y, previous, backwards);
        });
        dogsRef.current = nextDogs;
        return nextDogs;
      });

      // Water/grass/reeds animate on the 250ms environment clock.
      animAccumulator += dt * 1000;
      if (animAccumulator >= ANIM_FRAME_MS) {
        animAccumulator %= ANIM_FRAME_MS;
        setAnimFrame(f => (f + 1) % ANIM_FRAME_COUNT);
      }

      // Player walk cycle runs faster, and only while actually moving.
      if (isMoving.current) {
        playerAnimAccumulator += dt * 1000;
        if (playerAnimAccumulator >= PLAYER_ANIM_FRAME_MS) {
          playerAnimAccumulator %= PLAYER_ANIM_FRAME_MS;
          setPlayerAnimStep(s => (s + 1) % PLAYER_WALK_SEQUENCE.length);
        }
      } else {
        playerAnimAccumulator = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dogMeta]);

  // Camera follows the player, clamped so its view never shows past the map edge.
  const cameraLeft = clamp(
    player.x - VIEWPORT_MAP_UNITS / 2,
    0,
    mapLayout.width - VIEWPORT_MAP_UNITS,
  );
  const cameraTop = clamp(
    player.y - visibleMapUnitsY / 2,
    0,
    mapLayout.height - visibleMapUnitsY,
  );
  const toScreenX = (mapX: number) => (mapX - cameraLeft) * scale;
  const toScreenY = (mapY: number) => (mapY - cameraTop) * scale;

  const playerFrame = isMoving.current ? PLAYER_WALK_SEQUENCE[playerAnimStep] : 0;

  // Painter's algorithm: props, dogs and the player all plant on the same ground
  // plane, so they have to be sorted into one list by map-Y (mapLayout.objects'
  // precomputed `depth` is each prop's ground-contact point, comparable to the
  // player/dogs' own y) rather than drawn in separate fixed-order blocks — otherwise
  // an entity above a tall prop still paints on top of it.
  const sceneEntities: { depth: number; node: ReactElement }[] = [];

  for (const object of mapLayout.objects) {
    const image = props[object.asset];
    if (!image) {
      continue;
    }
    sceneEntities.push({
      depth: object.depth,
      node: (
        <SkiaImage
          key={object.id}
          image={image}
          x={toScreenX(object.x)}
          y={toScreenY(object.y)}
          width={object.w * scale}
          height={object.h * scale}
          fit="fill"
          sampling={NEAREST_SAMPLING}
        />
      ),
    });
  }

  // Talk target: the nearest dog within range.
  let talkTargetIndex: number | null = null;
  let talkTargetDist = TALK_RANGE;
  // The dog currently in a ball game (at most one at a time) drives the single ball button.
  let ballDogIndex: number | null = null;

  dogs.forEach((dog, i) => {
    const ball = ballStatesRef.current[i];
    const ballActive = ball ? isBallPlayActive(ball) : false;
    const facing = dogFacingRef.current[i] ?? DEFAULT_DOG_FACING;
    sceneEntities.push({
      depth: dog.y,
      node: (
        <DogSprite
          key={dogMeta[i]?.id ?? i}
          dog={dog}
          manifest={dogMeta[i]?.manifest ?? localDogAssetManifest}
          sheets={dogSheets[i] ?? {}}
          renderStateOverride={ball && dogMeta[i] ? ballDogPose(ball, dogMeta[i].behavior.settings) ?? undefined : undefined}
          direction={facing}
          envAnimFrame={animFrame}
          groundX={toScreenX(dog.x + DOG_SPRITE_OFFSET.x)}
          groundY={toScreenY(dog.y + DOG_SPRITE_OFFSET.y)}
          size={DOG_DISPLAY_SIZE * scale}
        />
      ),
    });

    const labelText = dogStatusLabel(dog, ball, ballActive);
    if (labelText) {
      // Same depth, pushed right after the dog: Array.prototype.sort is stable, so this
      // still draws just after (on top of) that dog once sorted.
      const centerX = toScreenX(dog.x);
      const topY = toScreenY(dog.y) + 4; // dog.y is the ground/foot point, not the center
      const textWidth = dogLabelFont.measureText(labelText).width;
      const pillWidth = textWidth + 16;
      const pillHeight = 18;
      sceneEntities.push({
        depth: dog.y,
        node: (
          <Group key={`label-${dogMeta[i]?.id ?? i}`}>
            <RoundedRect
              x={centerX - pillWidth / 2}
              y={topY}
              width={pillWidth}
              height={pillHeight}
              r={pillHeight / 2}
              color="rgba(0,0,0,0.6)"
            />
            <SkiaText x={centerX - textWidth / 2} y={topY + 13} text={labelText} font={dogLabelFont} color="white" />
          </Group>
        ),
      });
    }

    if (ball && dogMeta[i]?.behavior.settings.ballPlay.chaseEnabled) {
      sceneEntities.push({
        depth: ball.shadowY ?? ball.ballY,
        node: (
          <BallSprite
            key={`ball-${dogMeta[i].id}`}
            x={toScreenX(ball.ballX)}
            y={toScreenY(ball.ballY)}
            shadowY={ball.shadowY === null ? null : toScreenY(ball.shadowY)}
            unit={BALL_PIXEL * scale}
          />
        ),
      });
      if (ballActive && ballDogIndex === null) {
        ballDogIndex = i;
      }
    }

    const dist = Math.hypot(dog.x - player.x, dog.y - player.y);
    if (dist < talkTargetDist) {
      talkTargetDist = dist;
      talkTargetIndex = i;
    }
  });

  function openChat() {
    if (talkTargetIndex === null) {
      return;
    }
    const dog = dogMeta[talkTargetIndex];
    if (!dog) {
      return;
    }
    navigation.navigate('Chat', {
      dogId: dog.id,
      dogName: displayDogName(dog.name),
      identityIndex: talkTargetIndex % DOG_IDENTITY_COUNT,
      shelterName: params.shelterName,
    });
  }

  // The ball button: label / enabled state come from the ball game's phase (prototype ballInteraction).
  const ballDog = ballDogIndex !== null ? dogs[ballDogIndex] : null;
  const ballDogState = ballDogIndex !== null ? ballStatesRef.current[ballDogIndex] : null;
  const throwSpot =
    ballDog && ballDogState?.phase === 'READY'
      ? findThrowTarget(player, { x: ballDog.x, y: ballDog.y }, mapLayout.bounds, mapLayout.obstacles)
      : null;
  const ballButton =
    ballDog && ballDogState && ballDogIndex !== null
      ? ballControl(ballDogState, { x: ballDog.x, y: ballDog.y }, dogMeta[ballDogIndex]?.name ?? '강아지', player, throwSpot !== null)
      : null;

  function handleBallButton() {
    if (ballDogIndex === null || !ballDog || !ballButton?.enabled) {
      return;
    }
    const state = ballStatesRef.current[ballDogIndex];
    const hand = {
      x: playerPosRef.current.x + PLAYER_SPRITE_OFFSET.x + (facingLeft.current ? -HAND_OFFSET.x : HAND_OFFSET.x),
      y: playerPosRef.current.y + PLAYER_SPRITE_OFFSET.y + HAND_OFFSET.y,
    };
    if (ballButton.action === 'receive') {
      ballStatesRef.current[ballDogIndex] = startReceive(state, { x: ballDog.x, y: ballDog.y }, dogFacingRef.current[ballDogIndex] ?? DEFAULT_DOG_FACING, DOG_SCALE);
      // The dog hands the ball over from its mouth; face it while taking it.
      facingLeft.current = ballDog.x < playerPosRef.current.x;
    } else if (ballButton.action === 'throw') {
      facingLeft.current = throwSpot ? throwSpot.landing.x < playerPosRef.current.x : facingLeft.current;
      ballStatesRef.current[ballDogIndex] = startThrow(state, hand, throwSpot);
    }
  }

  // Throw / receive gesture: the prototype's push / pull frames, feet kept where the walk frame's are.
  const gesture = ballStatesRef.current.find(ball => ball.playerAction !== null) ?? null;
  const gestureSheet = useImage(playerActionsSheet);
  if (gesture?.playerAction && gestureSheet) {
    const size = PLAYER_DISPLAY_SIZE * scale * (PLAYER_ACTION_CELL / PLAYER_FRAME_SIZE);
    const frame = Math.min(PLAYER_ACTION_FRAMES - 1, Math.floor((gesture.playerActionMs / PLAYER_ACTION_MS[gesture.playerAction]) * PLAYER_ACTION_FRAMES));
    sceneEntities.push({
      depth: player.y,
      node: (
        <SpriteFrame
          key="player"
          sheet={gestureSheet}
          frameSize={PLAYER_ACTION_CELL}
          col={frame}
          row={PLAYER_ACTION_ROW[gesture.playerAction]}
          x={toScreenX(player.x + PLAYER_SPRITE_OFFSET.x) - size / 2}
          y={toScreenY(player.y + PLAYER_SPRITE_OFFSET.y) + (PLAYER_DISPLAY_SIZE * scale) / 2 - size}
          size={size}
          flipX={facingLeft.current}
        />
      ),
    });
  } else if (playerSheet) {
    sceneEntities.push({
      depth: player.y,
      node: (
        <SpriteFrame
          key="player"
          sheet={playerSheet}
          frameSize={PLAYER_FRAME_SIZE}
          col={playerFrame % PLAYER_SHEET_COLS}
          row={PLAYER_WALK_ROW}
          x={toScreenX(player.x + PLAYER_SPRITE_OFFSET.x) - (PLAYER_DISPLAY_SIZE * scale) / 2}
          y={toScreenY(player.y + PLAYER_SPRITE_OFFSET.y) - (PLAYER_DISPLAY_SIZE * scale) / 2}
          size={PLAYER_DISPLAY_SIZE * scale}
          flipX={facingLeft.current}
        />
      ),
    });
  }

  sceneEntities.sort((a, b) => a.depth - b.depth);

  return (
    <View style={styles.container}>
      <View style={{ width: viewportWidth, height: viewportHeight }}>
        <Canvas style={{ width: viewportWidth, height: viewportHeight }}>
          {ground && (
            <SkiaImage
              image={ground}
              x={toScreenX(0)}
              y={toScreenY(0)}
              width={mapLayout.width * scale}
              height={mapLayout.height * scale}
              fit="fill"
              sampling={NEAREST_SAMPLING}
            />
          )}
          {waterFrames[animFrame] && (
            <SkiaImage
              image={waterFrames[animFrame]!}
              x={toScreenX(0)}
              y={toScreenY(0)}
              width={mapLayout.width * scale}
              height={mapLayout.height * scale}
              fit="fill"
              sampling={NEAREST_SAMPLING}
            />
          )}
          {mapLayout.environment.plants.map((plant, index) => {
            const sheet = plant.clip === 'reeds' ? reeds : grass;
            const clipInfo = plant.clip === 'reeds'
              ? mapLayout.environment.clips.reeds
              : mapLayout.environment.clips.grass;
            if (!sheet || !clipInfo) {
              return null;
            }
            const frame = (animFrame + plant.phase) % ANIM_FRAME_COUNT;
            return (
              <SpriteFrame
                key={index}
                sheet={sheet}
                frameSize={clipInfo.frameWidth}
                col={frame}
                row={0}
                x={toScreenX(plant.x - clipInfo.anchorX)}
                y={toScreenY(plant.y - clipInfo.anchorY)}
                size={PLANT_DISPLAY_SIZE * scale}
              />
            );
          })}
          {sceneEntities.map(entity => entity.node)}
        </Canvas>
        <View style={styles.joystick}>
          <Joystick onChange={(dx, dy) => { direction.current = { dx, dy }; }} />
        </View>
        <Pressable
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="보호소로 돌아가기"
        >
          <Text style={styles.backButtonText}>← 보호소</Text>
        </Pressable>
        {talkTargetIndex !== null && (
          <Pressable style={styles.talkButton} onPress={openChat}>
            <Text style={styles.talkButtonText}>말 걸기</Text>
          </Pressable>
        )}
        {ballButton?.visible && (
          <Pressable style={[styles.throwButton, !ballButton.enabled && styles.throwButtonDisabled]} onPress={handleBallButton} disabled={!ballButton.enabled}>
            <Text style={styles.throwButtonText}>{ballButton.label}</Text>
          </Pressable>
        )}
        {shelterDogs.status !== 'error' && !dogsSpawned && (
          <View style={styles.loadingScreen}>
            <ActivityIndicator size="large" color="#b19bc2" />
            <Text style={styles.loadingTitle}>운동장에 들어가는 중…</Text>
            <Text style={styles.loadingText}>친구들을 불러오고 있어요</Text>
          </View>
        )}
        {shelterDogs.status === 'error' && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusText}>강아지를 못 불러왔어요: {shelterDogs.message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  joystick: {
    position: 'absolute',
    left: 16,
    bottom: 16,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(40, 53, 32, 0.72)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  talkButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 26,
  },
  // Stacked above talkButton — a dog can be both chat-approachable and
  // chase-enabled at once, so both buttons may show together.
  throwButton: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 26,
  },
  talkButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  throwButtonDisabled: {
    backgroundColor: 'rgba(60,60,60,0.45)',
  },
  throwButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingScreen: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f6f1fa',
  },
  loadingTitle: {
    color: '#4a3d55',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    color: '#8a7d96',
    fontSize: 14,
  },
  statusBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 10,
  },
  statusText: {
    color: '#fff',
    flexShrink: 1,
  },
});
