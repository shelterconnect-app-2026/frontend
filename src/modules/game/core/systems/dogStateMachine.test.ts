import { createDogAgent, tickDog } from './dogStateMachine';
import type { DogAssetManifest, DogBehaviorSettings, PersonGreetingInteraction } from '../../../dog/types';

const bounds = { left: 0, top: 0, right: 200, bottom: 200 };
const noObstacles: { x: number; y: number; w: number; h: number }[] = [];

function makeManifest(overrides: Partial<DogAssetManifest> = {}): DogAssetManifest {
  return {
    id: 'manifest-1',
    availableActions: ['IDLE', 'SIT', 'BACK_OFF'],
    fallbackAction: 'IDLE',
    frameSize: { width: 64, height: 64 },
    anchorPixels: { x: 32, y: 60 },
    baseUrl: 'base.png',
    expiresAt: '2026-01-01T00:00:00Z',
    animations: {
      BACK_OFF: {
        spritesheetUrl: 'back_off.png',
        frameCount: 2,
        loop: true,
        holdLastFrame: false,
        returnToIdle: 'DIRECT',
        frames: [
          { x: 0, y: 0, width: 64, height: 64, durationMs: 70 },
          { x: 64, y: 0, width: 64, height: 64, durationMs: 70 },
        ],
        movement: { mode: 'BACKWARD', defaultSpeedTilesPerSecond: 0.6 },
      },
      IDLE: {
        spritesheetUrl: 'idle.png',
        frameCount: 2,
        loop: true,
        holdLastFrame: false,
        returnToIdle: 'DIRECT',
        frames: [
          { x: 0, y: 0, width: 64, height: 64, durationMs: 100 },
          { x: 64, y: 0, width: 64, height: 64, durationMs: 100 },
        ],
        movement: { mode: 'STATIONARY', defaultSpeedTilesPerSecond: 0 },
      },
      SIT: {
        spritesheetUrl: 'sit.png',
        frameCount: 3,
        loop: false,
        holdLastFrame: true,
        returnToIdle: 'REVERSE_FRAMES',
        frames: [
          { x: 0, y: 0, width: 64, height: 64, durationMs: 100 },
          { x: 64, y: 0, width: 64, height: 64, durationMs: 100 },
          { x: 128, y: 0, width: 64, height: 64, durationMs: 100 },
        ],
        movement: { mode: 'STATIONARY', defaultSpeedTilesPerSecond: 0 },
      },
    },
    ...overrides,
  };
}

function makeSettings(overrides: Partial<DogBehaviorSettings> = {}): DogBehaviorSettings {
  return {
    actions: {
      IDLE: { weight: 70, speedTilesPerSecond: 0, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      WALK: { weight: 30, speedTilesPerSecond: 0.8, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      RUN: { weight: 0, speedTilesPerSecond: 1.8, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      SNIFF: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      TAIL_WAG: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      BACK_OFF: { weight: 0, speedTilesPerSecond: 0.6, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      SIT: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
      LIE_DOWN: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 2000 },
    },
    approachDistanceTiles: 0,
    personalSpaceTiles: 0,
    reactionDelayMs: 500,
    ballPlay: { chaseEnabled: false, returnEnabled: false, reactionDelayMs: 500 },
    ...overrides,
  };
}

test('a dog with default (TAIL_WAG/BACK_OFF weight 0) settings ignores a nearby player', () => {
  const settings = makeSettings({ approachDistanceTiles: 4, personalSpaceTiles: 1.5 });
  let agent = createDogAgent(100, 100);
  for (let i = 0; i < 30; i++) {
    agent = tickDog(agent, settings, 0.1, { x: 101, y: 100 }, bounds, noObstacles);
  }
  expect(agent.state).not.toBe('TAIL_WAG');
  expect(agent.state).not.toBe('BACK_OFF');
});

test('backs off once inside personal space, after the reaction delay, when BACK_OFF has weight', () => {
  const settings = makeSettings({
    approachDistanceTiles: 4,
    personalSpaceTiles: 1.5,
    reactionDelayMs: 300,
    actions: {
      ...makeSettings().actions,
      BACK_OFF: { weight: 10, speedTilesPerSecond: 0.6, minDurationMs: 500, maxDurationMs: 1500, cooldownMs: 3000 },
    },
  });
  let agent = createDogAgent(100, 100);
  // player well inside personalSpaceTiles(1.5 * 24 = 36px)
  const closePlayer = { x: 110, y: 100 };
  for (let i = 0; i < 3; i++) {
    agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  }
  expect(agent.state).not.toBe('BACK_OFF'); // still within reactionDelayMs
  for (let i = 0; i < 10; i++) {
    agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  }
  expect(agent.state).toBe('BACK_OFF');
});

test('actually moves away from the player while backing off (target survives enterState)', () => {
  const settings = makeSettings({
    approachDistanceTiles: 4,
    personalSpaceTiles: 1.5,
    reactionDelayMs: 100,
    actions: {
      ...makeSettings().actions,
      BACK_OFF: { weight: 10, speedTilesPerSecond: 0.6, minDurationMs: 500, maxDurationMs: 1500, cooldownMs: 3000 },
    },
  });
  let agent = createDogAgent(100, 100);
  const closePlayer = { x: 110, y: 100 };
  for (let i = 0; i < 3; i++) {
    agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  }
  expect(agent.state).toBe('BACK_OFF');
  const before = { x: agent.x, y: agent.y };
  agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  expect(distanceMoved(before, agent)).toBeGreaterThan(0);
  // Moving away from the player, not toward.
  expect(agent.x).toBeLessThan(before.x);
});

test('does not re-enter BACK_OFF while its cooldown is still active', () => {
  const settings = makeSettings({
    approachDistanceTiles: 4,
    personalSpaceTiles: 1.5,
    reactionDelayMs: 100,
    actions: {
      ...makeSettings().actions,
      BACK_OFF: { weight: 10, speedTilesPerSecond: 0.6, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 999999 },
    },
  });
  let agent = createDogAgent(100, 100);
  const closePlayer = { x: 110, y: 100 };
  // Trigger BACK_OFF once, then let it finish (player steps just outside personalSpace).
  for (let i = 0; i < 3; i++) {
    agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  }
  expect(agent.state).toBe('BACK_OFF');
  const farEnoughPlayer = { x: 200, y: 100 };
  agent = tickDog(agent, settings, 0.1, farEnoughPlayer, bounds, noObstacles);
  expect(agent.state).not.toBe('BACK_OFF'); // exited, cooldown now set to 999999ms

  // Player closes back in immediately — should NOT re-trigger BACK_OFF despite
  // clearing reactionDelayMs again, because cooldownMs hasn't elapsed.
  for (let i = 0; i < 5; i++) {
    agent = tickDog(agent, settings, 0.1, closePlayer, bounds, noObstacles);
  }
  expect(agent.state).not.toBe('BACK_OFF');
});

test('an action on cooldown is not reselected until its cooldown expires', () => {
  const settings = makeSettings({
    actions: {
      ...makeSettings().actions,
      IDLE: { weight: 100, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 5000 },
      WALK: { weight: 0, speedTilesPerSecond: 0.8, minDurationMs: 2000, maxDurationMs: 5000, cooldownMs: 0 },
      SIT: { weight: 100, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 0 },
    },
  });
  let agent = createDogAgent(100, 100);
  const farPlayer = { x: -1000, y: -1000 };
  const alwaysFirst = () => 0; // deterministic: picks the first eligible entry
  // The agent's default initial state (IDLE, stateRemainingMs 0 from createDogAgent)
  // "expires" on the very first tick, putting IDLE on its 5s cooldown immediately —
  // so from here on, only SIT should ever be selectable.
  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, alwaysFirst);
  for (let i = 0; i < 10; i++) {
    agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, alwaysFirst);
    expect(agent.state).toBe('SIT');
  }
});

test('moves toward its WALK target using speedTilesPerSecond converted to map units', () => {
  const settings = makeSettings({
    actions: {
      ...makeSettings().actions,
      IDLE: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 0 },
      WALK: { weight: 100, speedTilesPerSecond: 1, minDurationMs: 5000, maxDurationMs: 5000, cooldownMs: 0 },
    },
  });
  let agent = createDogAgent(100, 100);
  const farPlayer = { x: -1000, y: -1000 };
  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles); // picks WALK immediately (IDLE weight 0)
  expect(agent.state).toBe('WALK');
  expect(agent.target).not.toBeNull();
  const before = { x: agent.x, y: agent.y };
  agent = tickDog(agent, settings, 0.5, farPlayer, bounds, noObstacles);
  expect(distanceMoved(before, agent)).toBeGreaterThan(0);
});

function distanceMoved(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('candidate selection excludes actions not in the asset manifest, even if weighted', () => {
  const manifest = makeManifest({ availableActions: ['IDLE'] }); // SIT has no real asset for this dog
  const settings = makeSettings({
    actions: {
      ...makeSettings().actions,
      IDLE: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 0 },
      SIT: { weight: 100, speedTilesPerSecond: 0, minDurationMs: 50, maxDurationMs: 50, cooldownMs: 0 },
    },
  });
  let agent = createDogAgent(100, 100);
  const farPlayer = { x: -1000, y: -1000 };
  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  expect(agent.state).toBe('IDLE'); // SIT is weighted but unreachable without a loaded clip
});

test('SIT plays forward, holds, then reverses back out before re-deciding', () => {
  const manifest = makeManifest();
  const settings = makeSettings({
    actions: {
      ...makeSettings().actions,
      IDLE: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 0 },
      SIT: { weight: 100, speedTilesPerSecond: 0, minDurationMs: 50, maxDurationMs: 50, cooldownMs: 0 },
    },
  });
  let agent = createDogAgent(100, 100);
  const farPlayer = { x: -1000, y: -1000 };

  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  expect(agent.state).toBe('SIT');
  expect(agent.subPhase).toBe('ENTER');

  // SIT's clip is 300ms (3 frames × 100ms) — walk through the rest of ENTER.
  for (let i = 0; i < 6; i++) {
    agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  }
  expect(agent.subPhase).toBe('HOLD');

  // HOLD duration is 50ms.
  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  expect(agent.subPhase).toBe('REVERSE');

  // Reverse takes the same 300ms to walk back to frame 0.
  for (let i = 0; i < 6; i++) {
    agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  }
  expect(agent.subPhase).toBe('ENTER'); // SIT is the only weighted candidate, so it re-enters
  expect(agent.cooldownUntilMs.SIT).toBeGreaterThan(0); // but the exit cooldown was actually paid
});

test('a reaction request mid-SIT reverses out first, then enters the reserved reaction', () => {
  const manifest = makeManifest();
  const settings = makeSettings({
    approachDistanceTiles: 4,
    personalSpaceTiles: 1.5,
    reactionDelayMs: 50,
    actions: {
      ...makeSettings().actions,
      IDLE: { weight: 0, speedTilesPerSecond: 0, minDurationMs: 100, maxDurationMs: 100, cooldownMs: 0 },
      SIT: { weight: 100, speedTilesPerSecond: 0, minDurationMs: 1000, maxDurationMs: 1000, cooldownMs: 0 },
      BACK_OFF: { weight: 10, speedTilesPerSecond: 0.6, minDurationMs: 500, maxDurationMs: 500, cooldownMs: 0 },
    },
  });
  let agent = createDogAgent(100, 100);
  const farPlayer = { x: -1000, y: -1000 };
  agent = tickDog(agent, settings, 0.05, farPlayer, bounds, noObstacles, Math.random, manifest);
  expect(agent.state).toBe('SIT');
  expect(agent.subPhase).toBe('ENTER');

  // Player closes in mid-ENTER — BACK_OFF is requested, but SIT keeps playing until the
  // reverse it triggers finishes; it doesn't cut away immediately.
  const closePlayer = { x: 110, y: 100 };
  for (let i = 0; i < 2; i++) {
    agent = tickDog(agent, settings, 0.05, closePlayer, bounds, noObstacles, Math.random, manifest);
  }
  expect(agent.state).toBe('SIT');
  expect(agent.subPhase).toBe('REVERSE');
  expect(agent.reservedNextState).toBe('BACK_OFF');

  for (let i = 0; i < 10; i++) {
    agent = tickDog(agent, settings, 0.05, closePlayer, bounds, noObstacles, Math.random, manifest);
  }
  expect(agent.state).toBe('BACK_OFF');
});

describe('PERSON_GREETING', () => {
  const greeting: PersonGreetingInteraction = {
    enabled: true,
    triggerDistanceTiles: 5,
    arrivalDistanceTiles: 1,
    reactionDelayMs: 200,
    wagDurationMs: 1000,
    sniffDurationMs: 600,
    maxDurationMs: 10000,
    cooldownMs: 5000,
  };
  const settings = makeSettings({ actions: { ...makeSettings().actions, WALK: { ...makeSettings().actions.WALK, speedTilesPerSecond: 2, weight: 0 }, IDLE: { ...makeSettings().actions.IDLE, weight: 100 }, TAIL_WAG: { ...makeSettings().actions.TAIL_WAG, weight: 20 } } });
  const player = { x: 150, y: 100 }; // 50px = ~2 tiles from the dog at (100,100)

  function run(agent: ReturnType<typeof createDogAgent>, ms: number, step = 50, who = player, cfg: PersonGreetingInteraction | null = greeting, s: DogBehaviorSettings = settings) {
    let current = agent;
    const seen: string[] = [];
    for (let t = 0; t < ms; t += step) {
      current = tickDog(current, s, step / 1000, who, bounds, noObstacles, () => 0.5, null, cfg);
      if (seen[seen.length - 1] !== current.state) seen.push(current.state);
    }
    return { current, seen };
  }

  test('walks to the player, wags, sniffs, then idles and rests', () => {
    const { current, seen } = run(createDogAgent(100, 100), 6000);
    expect(seen).toEqual(expect.arrayContaining(['WALK', 'TAIL_WAG', 'SNIFF']));
    expect(seen.indexOf('WALK')).toBeLessThan(seen.indexOf('TAIL_WAG'));
    expect(seen.indexOf('TAIL_WAG')).toBeLessThan(seen.indexOf('SNIFF'));
    expect(current.greeting).toBeNull();
    expect(current.greetingCooldownUntilMs).toBeGreaterThan(0);
  });

  test('the new no-tail-wag recipe walks to the player and sniffs without wagging', () => {
    const noWag = makeSettings({ actions: { ...settings.actions, TAIL_WAG: { ...settings.actions.TAIL_WAG, weight: 0 } } });
    const { seen } = run(createDogAgent(100, 100), 6000, 50, player, { ...greeting, wagDurationMs: 0 }, noWag);
    expect(seen).toContain('WALK');
    expect(seen).toContain('SNIFF');
    expect(seen).not.toContain('TAIL_WAG');
  });

  test('gives up when the player leaves the trigger distance', () => {
    let { current } = run(createDogAgent(100, 100), 400);
    expect(current.greeting).not.toBeNull();
    ({ current } = run(current, 200, 50, { x: 190, y: 190 }));
    expect(current.greeting).toBeNull();
    expect(current.state).toBe('IDLE');
  });

  test('a dog that also backs off never approaches first', () => {
    const cautious = makeSettings({ actions: { ...settings.actions, BACK_OFF: { ...settings.actions.BACK_OFF, weight: 20 } } });
    const { current, seen } = run(createDogAgent(100, 100), 3000, 50, player, greeting, cautious);
    expect(current.greeting).toBeNull();
    expect(seen).not.toContain('TAIL_WAG');
  });

  test('disabled interaction does nothing', () => {
    const { current } = run(createDogAgent(100, 100), 3000, 50, player, { ...greeting, enabled: false });
    expect(current.greeting).toBeNull();
    expect(current.state).not.toBe('TAIL_WAG');
  });

  test('stays put (no greeting) when the manifest has no WALK clip', () => {
    let current = createDogAgent(100, 100);
    for (let t = 0; t < 2000; t += 50) {
      current = tickDog(current, settings, 0.05, player, bounds, noObstacles, () => 0.5, makeManifest(), greeting);
    }
    expect(current.greeting).toBeNull();
  });
});
