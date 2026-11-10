import { type Bounds, stepMovement } from './movement';
import { clipDurationMs, forwardFrame } from './spritePlayback';
import type { DogActionKey, DogAssetManifest, DogBehaviorSettings, PersonGreetingInteraction } from '../../../dog/types';

export type DogState = DogActionKey;

// ponytail: the backend's `speedTilesPerSecond`/`*Tiles` fields assume a "tile" unit
// the map assets don't define anywhere — picked 24 map-units/tile (matches the env
// animation frame size) as a working assumption. Confirm with backend/art before
// this ships past a demo.
// Exported: ballPlay.ts reuses these so chase/return speed stays consistent with
// normal wandering speed.
export const TILE_SIZE_MAP_UNITS = 24;

export const DOG_RADIUS = 8;
const TARGET_REACHED_DIST = 4;

/** Sub-machine for SIT/LIE_DOWN's forward→hold→reverse playback (docs/dog-action-playback-spec.md
 * §5 "SIT / LIE_DOWN"). `null` for every other state — those still just use `stateRemainingMs`
 * as a plain countdown the way this file always has. */
export type DogSubPhase = 'ENTER' | 'HOLD' | 'REVERSE' | null;

/** PERSON_GREETING in progress (docs/trait-selected-sprites.md): walk to the player → TAIL_WAG → SNIFF → IDLE. */
export interface GreetingState {
  phase: 'APPROACH' | 'WAG' | 'SNIFF';
  /** ms since the greeting started — compared with maxDurationMs. */
  elapsedMs: number;
  phaseRemainingMs: number;
}

export interface DogAgent {
  state: DogState;
  x: number;
  y: number;
  target: { x: number; y: number } | null;
  /** ms remaining in the current state (counts down; re-decide at 0). */
  stateRemainingMs: number;
  /** ms until each action becomes selectable again, keyed by action. */
  cooldownUntilMs: Partial<Record<DogState, number>>;
  /** total elapsed ms, used against cooldownUntilMs. */
  clockMs: number;
  /** ms left before a nearby-player reaction actually kicks in (reactionDelayMs). */
  reactionPendingMs: number | null;
  reactionTarget: 'TAIL_WAG' | 'BACK_OFF' | null;
  subPhase: DogSubPhase;
  /** ms elapsed in the current subPhase — ENTER: forward-playback position;
   * REVERSE: how far back it's walked from `reverseFromFrame`. Render-layer reads this
   * (with `spritePlayback.ts`'s forwardFrame/reverseFrame) to pick the sprite frame. */
  clipElapsedMs: number;
  /** Frame reverse-playback started from — the clip's last frame on a natural finish,
   * or wherever forward playback was interrupted mid-ENTER. */
  reverseFromFrame: number;
  /** What to enter once an in-progress reverse finishes. A second interrupt while already
   * reversing only changes this, it doesn't restart the reverse animation (spec §5-2). */
  reservedNextState: DogState | null;
  greeting: GreetingState | null;
  /** ms the player has lingered inside the greeting trigger distance (reactionDelayMs). */
  greetingPendingMs: number | null;
  greetingCooldownUntilMs: number;
}

export function createDogAgent(x: number, y: number): DogAgent {
  return {
    state: 'IDLE',
    x,
    y,
    target: null,
    stateRemainingMs: 0,
    cooldownUntilMs: {},
    clockMs: 0,
    reactionPendingMs: null,
    reactionTarget: null,
    subPhase: null,
    clipElapsedMs: 0,
    reverseFromFrame: 0,
    reservedNextState: null,
    greeting: null,
    greetingPendingMs: null,
    greetingCooldownUntilMs: 0,
  };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function randomTargetWithin(bounds: Bounds, rng: () => number): { x: number; y: number } {
  const margin = 20;
  return {
    x: bounds.left + margin + rng() * Math.max(0, bounds.right - bounds.left - margin * 2),
    y: bounds.top + margin + rng() * Math.max(0, bounds.bottom - bounds.top - margin * 2),
  };
}

/**
 * A behavior is selectable only if the shelter weighted it (docs/dog-behavior-api.md) AND,
 * when a real asset manifest is attached, it's actually in `availableActions` with a loaded
 * clip (docs/dog-action-playback-spec.md §4) — `manifest` should already have any
 * still-loading/failed actions stripped by the caller (game/core stays unaware of Skia).
 */
function isCandidateValid(
  state: DogState,
  settings: DogBehaviorSettings,
  clockMs: number,
  cooldownUntilMs: Partial<Record<DogState, number>>,
  manifest: DogAssetManifest | null,
): boolean {
  return (
    settings.actions[state].weight > 0 &&
    (cooldownUntilMs[state] ?? 0) <= clockMs &&
    (manifest === null || (manifest.availableActions.includes(state) && manifest.animations[state] != null))
  );
}

/**
 * Weighted pick among autonomous actions (not on cooldown, weight > 0). Excludes
 * TAIL_WAG/BACK_OFF — per docs/dog-behavior-api.md those are purely reactive
 * (entered only through the player-proximity + reactionDelayMs path below), never
 * autonomous wandering.
 */
function pickNextState(
  settings: DogBehaviorSettings,
  clockMs: number,
  cooldownUntilMs: Partial<Record<DogState, number>>,
  manifest: DogAssetManifest | null,
  rng: () => number,
): DogState {
  const entries = (Object.keys(settings.actions) as DogState[]).filter(
    state =>
      state !== 'TAIL_WAG' &&
      state !== 'BACK_OFF' &&
      isCandidateValid(state, settings, clockMs, cooldownUntilMs, manifest),
  );

  if (entries.length === 0) {
    return 'IDLE'; // everything on cooldown or zeroed out — hold still rather than force a state its shelter disabled
  }

  const total = entries.reduce((sum, state) => sum + settings.actions[state].weight, 0);
  let roll = rng() * total;
  for (const state of entries) {
    roll -= settings.actions[state].weight;
    if (roll <= 0) {
      return state;
    }
  }
  return entries[entries.length - 1];
}

function enterState(
  agent: DogAgent,
  state: DogState,
  settings: DogBehaviorSettings,
  manifest: DogAssetManifest | null,
  bounds: Bounds,
  rng: () => number,
): DogAgent {
  const action = settings.actions[state];
  // BACK_OFF's caller pre-computes a flee-from-player target on `agent` before calling
  // this — preserve it. Everything else either wanders to a fresh random point
  // (WALK/RUN) or plants in place (null).
  const target =
    state === 'WALK' || state === 'RUN'
      ? randomTargetWithin(bounds, rng)
      : state === 'BACK_OFF'
        ? agent.target
        : null;

  const clip = manifest?.animations[state] ?? null;
  if (clip && clip.returnToIdle === 'REVERSE_FRAMES') {
    // SIT/LIE_DOWN: play the clip forward once (duration = the clip's own length, not the
    // behavior settings' min/max — that range is the HOLD duration, drawn once it's reached).
    return {
      ...agent,
      state,
      target,
      stateRemainingMs: clipDurationMs(clip),
      subPhase: 'ENTER',
      clipElapsedMs: 0,
      reverseFromFrame: clip.frames.length - 1,
      reservedNextState: null,
    };
  }

  const duration = action.minDurationMs + rng() * Math.max(0, action.maxDurationMs - action.minDurationMs);
  return { ...agent, state, target, stateRemainingMs: duration, subPhase: null, clipElapsedMs: 0, reservedNextState: null };
}

/**
 * Asks to move the agent into `desiredState`. If it's mid a SIT/LIE_DOWN reverse-playback
 * sub-phase, don't cut straight to the new state — finish reversing out first (from
 * wherever it currently is) and remember what to enter once that completes
 * (docs/dog-action-playback-spec.md §5-2).
 */
function requestState(
  agent: DogAgent,
  desiredState: DogState,
  settings: DogBehaviorSettings,
  manifest: DogAssetManifest | null,
  bounds: Bounds,
  rng: () => number,
): DogAgent {
  if (agent.subPhase === null) {
    return enterState(agent, desiredState, settings, manifest, bounds, rng);
  }
  if (agent.subPhase === 'REVERSE') {
    return { ...agent, reservedNextState: desiredState };
  }
  // ENTER or HOLD — start reversing from wherever playback currently is.
  const clip = manifest?.animations[agent.state] ?? null;
  const fromFrame =
    agent.subPhase === 'ENTER' && clip ? forwardFrame(clip, agent.clipElapsedMs) : (clip?.frames.length ?? 1) - 1;
  return {
    ...agent,
    subPhase: 'REVERSE',
    reverseFromFrame: fromFrame,
    clipElapsedMs: 0,
    stateRemainingMs: clip ? clipDurationMs(clip, fromFrame) : 0,
    reservedNextState: desiredState,
  };
}

function canPlay(state: DogState, manifest: DogAssetManifest | null): boolean {
  return manifest === null || (manifest.availableActions.includes(state) && manifest.animations[state] != null);
}

function setGreetingState(agent: DogAgent, state: DogState): DogAgent {
  return { ...agent, state, target: null, subPhase: null, stateRemainingMs: 0, clipElapsedMs: 0, reservedNextState: null };
}

function endGreeting(agent: DogAgent, cfg: PersonGreetingInteraction, settings: DogBehaviorSettings, manifest: DogAssetManifest | null, bounds: Bounds, rng: () => number): DogAgent {
  const idle = enterState({ ...agent, greeting: null, greetingPendingMs: null }, 'IDLE', settings, manifest, bounds, rng);
  return { ...idle, greetingCooldownUntilMs: agent.clockMs + cfg.cooldownMs };
}

/**
 * PERSON_GREETING (docs/trait-selected-sprites.md): a friendly dog (enabled, and no BACK_OFF weight —
 * "BACK_OFF가 있는 조심스러운 설정에서는 먼저 접근하지 않는다") that the player lingers near within
 * triggerDistanceTiles walks over, stops at arrivalDistanceTiles, wags, sniffs, then idles. It aborts if the
 * player leaves the trigger distance or maxDurationMs passes, and rests for cooldownMs afterwards. Steps whose
 * clip the dog doesn't have are skipped (never invent a sheet). Returns null when the greeting isn't
 * involved this tick, so the normal wandering/reaction logic runs.
 */
function tickGreeting(
  agent: DogAgent,
  cfg: PersonGreetingInteraction,
  settings: DogBehaviorSettings,
  player: { x: number; y: number },
  dt: number,
  bounds: Bounds,
  obstacles: Parameters<typeof stepMovement>[0]['obstacles'],
  rng: () => number,
  manifest: DogAssetManifest | null,
): DogAgent | null {
  const dtMs = dt * 1000;
  const dist = distance(agent.x, agent.y, player.x, player.y);
  const triggerPx = cfg.triggerDistanceTiles * TILE_SIZE_MAP_UNITS;
  const arrivalPx = cfg.arrivalDistanceTiles * TILE_SIZE_MAP_UNITS;

  if (agent.greeting) {
    const elapsed = agent.greeting.elapsedMs + dtMs;
    if (dist > triggerPx || elapsed > cfg.maxDurationMs) {
      return endGreeting(agent, cfg, settings, manifest, bounds, rng);
    }
    let current: DogAgent = { ...agent, greeting: { ...agent.greeting, elapsedMs: elapsed } };
    const greeting = current.greeting as GreetingState;

    if (greeting.phase === 'APPROACH') {
      if (dist <= arrivalPx) {
        current = cfg.wagDurationMs > 0 && settings.actions.TAIL_WAG.weight > 0 && canPlay('TAIL_WAG', manifest)
          ? { ...setGreetingState(current, 'TAIL_WAG'), greeting: { ...greeting, phase: 'WAG', phaseRemainingMs: cfg.wagDurationMs } }
          : { ...setGreetingState(current, 'SNIFF'), greeting: { ...greeting, phase: 'SNIFF', phaseRemainingMs: cfg.sniffDurationMs } };
      } else {
        const moved = stepMovement({
          x: current.x,
          y: current.y,
          dx: player.x - current.x,
          dy: player.y - current.y,
          speed: settings.actions.WALK.speedTilesPerSecond * TILE_SIZE_MAP_UNITS,
          dt,
          radius: DOG_RADIUS,
          bounds,
          obstacles,
        });
        current = { ...current, state: 'WALK', target: { x: player.x, y: player.y }, x: moved.x, y: moved.y };
      }
      return current;
    }

    const remaining = greeting.phaseRemainingMs - dtMs;
    if (remaining > 0) {
      return { ...current, greeting: { ...greeting, phaseRemainingMs: remaining } };
    }
    if (greeting.phase === 'WAG' && canPlay('SNIFF', manifest)) {
      return { ...setGreetingState(current, 'SNIFF'), greeting: { ...greeting, phase: 'SNIFF', phaseRemainingMs: cfg.sniffDurationMs } };
    }
    return endGreeting(current, cfg, settings, manifest, bounds, rng);
  }

  // Not greeting yet — may the player's presence start one?
  const friendly = cfg.enabled && settings.actions.BACK_OFF.weight <= 0;
  const ready =
    friendly &&
    agent.subPhase === null &&
    agent.state !== 'TAIL_WAG' &&
    agent.state !== 'BACK_OFF' &&
    agent.greetingCooldownUntilMs <= agent.clockMs &&
    dist < triggerPx &&
    canPlay('WALK', manifest) &&
    settings.actions.WALK.speedTilesPerSecond > 0;
  if (!ready) {
    return agent.greetingPendingMs === null ? null : { ...agent, greetingPendingMs: null };
  }
  const pending = (agent.greetingPendingMs ?? cfg.reactionDelayMs) - dtMs;
  if (pending > 0) {
    return { ...agent, greetingPendingMs: pending };
  }
  const started: DogAgent = { ...agent, greetingPendingMs: null, greeting: { phase: 'APPROACH', elapsedMs: 0, phaseRemainingMs: 0 } };
  return { ...setGreetingState(started, 'WALK'), greeting: started.greeting };
}

/**
 * Advances one dog by dt seconds using the shelter-configured behavior settings
 * (docs/dog-behavior-api.md): weighted random action selection bounded by each
 * action's own min/max duration and post-use cooldown, plus a player-proximity
 * override (BACK_OFF inside personalSpace, TAIL_WAG inside approachDistance) that
 * only fires if the shelter gave that reaction a non-zero weight, after
 * reactionDelayMs of the player lingering there.
 *
 * `manifest` (optional) is the dog's real asset manifest (docs/dog-action-playback-spec.md)
 * — when given, candidate selection is narrowed to actions it actually has loaded clips
 * for, and SIT/LIE_DOWN go through the enter→hold→reverse sub-machine instead of a plain
 * duration countdown. `null` (the default) keeps this file's original placeholder-era
 * behavior unchanged.
 */
export function tickDog(
  agent: DogAgent,
  settings: DogBehaviorSettings,
  dt: number,
  player: { x: number; y: number },
  bounds: Bounds,
  obstacles: Parameters<typeof stepMovement>[0]['obstacles'],
  rng: () => number = Math.random,
  manifest: DogAssetManifest | null = null,
  greeting: PersonGreetingInteraction | null = null,
): DogAgent {
  const dtMs = dt * 1000;
  // Unconditional (like clockMs) rather than only while re-deciding: the render layer
  // needs real elapsed-in-clip time for every currently-looping action too (WALK, TAIL_WAG
  // while reactively active, etc), not just SIT/LIE_DOWN's own sub-machine below.
  // enterState()/requestState() reset this to 0 on every transition.
  let next: DogAgent = { ...agent, clockMs: agent.clockMs + dtMs, clipElapsedMs: agent.clipElapsedMs + dtMs };

  // --- PERSON_GREETING (B-42 interaction recipe) takes over the dog while it is greeting ---
  if (greeting) {
    const handled = tickGreeting(next, greeting, settings, player, dt, bounds, obstacles, rng, manifest);
    if (handled) {
      if (handled.greeting) {
        return handled;
      }
      next = handled;
    }
  }

  // --- Player-proximity reaction (only if the shelter enabled it with weight > 0) ---
  const dist = distance(next.x, next.y, player.x, player.y);
  const personalSpacePx = settings.personalSpaceTiles * TILE_SIZE_MAP_UNITS;
  const approachPx = settings.approachDistanceTiles * TILE_SIZE_MAP_UNITS;
  const desiredReaction: 'BACK_OFF' | 'TAIL_WAG' | null =
    dist < personalSpacePx && settings.actions.BACK_OFF.weight > 0
      ? 'BACK_OFF'
      : dist < approachPx && settings.actions.TAIL_WAG.weight > 0
        ? 'TAIL_WAG'
        : null;

  if (desiredReaction && next.state !== desiredReaction) {
    if (next.reactionTarget !== desiredReaction) {
      next = { ...next, reactionTarget: desiredReaction, reactionPendingMs: settings.reactionDelayMs };
    } else if (next.reactionPendingMs !== null) {
      const remaining = next.reactionPendingMs - dtMs;
      if (remaining <= 0) {
        // The reaction path never consulted cooldownUntilMs, so a dog could back off,
        // immediately re-enter cooldown, and re-trigger BACK_OFF on the very next
        // reactionDelayMs tick as long as the player stayed close — cooldown never
        // actually cooled anything down. Gate entry on it like the autonomous path does.
        const onCooldown = (next.cooldownUntilMs[desiredReaction] ?? 0) > next.clockMs;
        next = { ...next, reactionPendingMs: null, reactionTarget: null };
        if (!onCooldown) {
          next = requestState(
            desiredReaction === 'BACK_OFF'
              ? {
                  ...next,
                  target: {
                    x: next.x + (next.x - player.x),
                    y: next.y + (next.y - player.y),
                  },
                }
              : next,
            desiredReaction,
            settings,
            manifest,
            bounds,
            rng,
          );
        }
      } else {
        next = { ...next, reactionPendingMs: remaining };
      }
    }
  } else if (!desiredReaction) {
    next = { ...next, reactionPendingMs: null, reactionTarget: null };
    if (next.state === 'TAIL_WAG' || next.state === 'BACK_OFF') {
      next = { ...next, cooldownUntilMs: { ...next.cooldownUntilMs, [next.state]: next.clockMs + settings.actions[next.state].cooldownMs } };
      next = enterState(next, 'IDLE', settings, manifest, bounds, rng);
    }
  }

  // --- Autonomous state duration / re-decide (only outside an active reaction) ---
  if (next.state !== 'TAIL_WAG' && next.state !== 'BACK_OFF') {
    if (next.subPhase !== null) {
      // SIT/LIE_DOWN's enter → hold → reverse sub-machine (clipElapsedMs already
      // accumulated unconditionally above).
      next = { ...next, stateRemainingMs: next.stateRemainingMs - dtMs };
      if (next.stateRemainingMs <= 0) {
        if (next.subPhase === 'ENTER') {
          const action = settings.actions[next.state];
          const holdMs = action.minDurationMs + rng() * Math.max(0, action.maxDurationMs - action.minDurationMs);
          next = { ...next, subPhase: 'HOLD', stateRemainingMs: holdMs, clipElapsedMs: 0 };
        } else if (next.subPhase === 'HOLD') {
          const clip = manifest?.animations[next.state] ?? null;
          next = {
            ...next,
            subPhase: 'REVERSE',
            reverseFromFrame: (clip?.frames.length ?? 1) - 1,
            stateRemainingMs: clip ? clipDurationMs(clip) : 0,
            clipElapsedMs: 0,
          };
        } else {
          // REVERSE finished — pay the cooldown, then re-validate whatever was reserved
          // (a reaction that arrived mid-sit) before entering it, else pick freely.
          next = {
            ...next,
            cooldownUntilMs: { ...next.cooldownUntilMs, [next.state]: next.clockMs + settings.actions[next.state].cooldownMs },
          };
          const reserved = next.reservedNextState;
          next = { ...next, reservedNextState: null };
          const picked =
            reserved && isCandidateValid(reserved, settings, next.clockMs, next.cooldownUntilMs, manifest)
              ? reserved
              : pickNextState(settings, next.clockMs, next.cooldownUntilMs, manifest, rng);
          next = enterState(
            picked === 'BACK_OFF' ? { ...next, target: { x: next.x + (next.x - player.x), y: next.y + (next.y - player.y) } } : next,
            picked,
            settings,
            manifest,
            bounds,
            rng,
          );
        }
      }
    } else {
      const reachedTarget =
        (next.state === 'WALK' || next.state === 'RUN') &&
        next.target &&
        distance(next.x, next.y, next.target.x, next.target.y) < TARGET_REACHED_DIST;

      next = { ...next, stateRemainingMs: next.stateRemainingMs - dtMs };
      if (reachedTarget || next.stateRemainingMs <= 0) {
        next = {
          ...next,
          cooldownUntilMs: { ...next.cooldownUntilMs, [next.state]: next.clockMs + settings.actions[next.state].cooldownMs },
        };
        const picked = pickNextState(settings, next.clockMs, next.cooldownUntilMs, manifest, rng);
        next = enterState(next, picked, settings, manifest, bounds, rng);
      }
    }
  }

  // --- Movement ---
  const speed = settings.actions[next.state].speedTilesPerSecond * TILE_SIZE_MAP_UNITS;
  if (speed > 0 && next.target) {
    const moved = stepMovement({
      x: next.x,
      y: next.y,
      dx: next.target.x - next.x,
      dy: next.target.y - next.y,
      speed,
      dt,
      radius: DOG_RADIUS,
      bounds,
      obstacles,
    });
    next = { ...next, x: moved.x, y: moved.y };
  }

  return next;
}
