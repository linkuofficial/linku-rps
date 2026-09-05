import type { CoinFace, DrawMode, PlayerSlot, ReactionMode, ToolId, WheelOption } from './index.js';

/**
 * Outcome logic for the individual tools, kept free of transport and room plumbing so the
 * server and the browser-local session can share one implementation. Two copies of "what a
 * dice roll means" would be free to drift apart; one copy cannot.
 *
 * Every function that consumes randomness takes an injectable source, which also makes the
 * outcomes exercisable from tests without stubbing globals.
 */
export type RandomFn = () => number;

const defaultRandom: RandomFn = Math.random;

export const TOOL_IDS: ToolId[] = ['rps', 'coin', 'dice', 'wheel', 'draw', 'reaction'];

export function isToolId(value: unknown): value is ToolId {
  return TOOL_IDS.includes(value as ToolId);
}

/** Match lengths a caller may ask for; anything else falls back to BEST_OF_DEFAULT. */
export const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;
export const BEST_OF_DEFAULT = 3;

export function normalizeBestOf(value: unknown): number {
  return BEST_OF_OPTIONS.includes(value as (typeof BEST_OF_OPTIONS)[number])
    ? (value as number)
    : BEST_OF_DEFAULT;
}

/** rps is the only tool that needs a second person; the rest are meaningful alone. */
export function supportsSoloPlay(tool: ToolId): boolean {
  return tool !== 'rps';
}

export function oppositeSlot(slot: PlayerSlot): PlayerSlot {
  return slot === 'a' ? 'b' : 'a';
}

/** Fisher-Yates. Returns a new array; the input is left alone. */
export function shuffled<T>(items: T[], random: RandomFn = defaultRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Uniform index into a collection of `length` items. */
export function pickIndex(length: number, random: RandomFn = defaultRandom): number {
  return Math.floor(random() * length);
}

// ===== Coin =====

export function flipCoin(random: RandomFn = defaultRandom): CoinFace {
  return random() < 0.5 ? 'heads' : 'tails';
}

// ===== Dice =====

export const DICE_MIN_COUNT = 1;
export const DICE_MAX_COUNT = 20;
export const DICE_MIN_SIDES = 2;
export const DICE_MAX_SIDES = 1000;

export const DICE_DEFAULT_COUNT = 1;
export const DICE_DEFAULT_SIDES = 6;

export function isValidDiceCount(count: number): boolean {
  return count >= DICE_MIN_COUNT && count <= DICE_MAX_COUNT;
}

export function isValidDiceSides(sides: number): boolean {
  return sides >= DICE_MIN_SIDES && sides <= DICE_MAX_SIDES;
}

export function rollDice(count: number, sides: number, random: RandomFn = defaultRandom): number[] {
  return Array.from({ length: count }, () => Math.floor(random() * sides) + 1);
}

export function diceTotal(values: number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

// ===== Wheel =====

export const WHEEL_MAX_OPTIONS = 24;
export const WHEEL_MAX_LABEL_LENGTH = 40;
export const WHEEL_MAX_IMAGE_URL_LENGTH = 512;
export const WHEEL_MIN_OPTIONS = 2;
export const WHEEL_FALLBACK_COLOR = '#64748b';

export function sanitizeWheelOptions(options: WheelOption[]): WheelOption[] {
  return options
    .slice(0, WHEEL_MAX_OPTIONS)
    .map((opt, i) => ({
      id: String(opt.id || `opt_${i + 1}`),
      label: String(opt.label || '')
        .trim()
        .slice(0, WHEEL_MAX_LABEL_LENGTH),
      color: /^#[0-9a-fA-F]{6}$/.test(String(opt.color || ''))
        ? String(opt.color)
        : WHEEL_FALLBACK_COLOR,
      imageUrl:
        /^https?:\/\//.test(String(opt.imageUrl || '')) &&
        String(opt.imageUrl || '').length <= WHEEL_MAX_IMAGE_URL_LENGTH
          ? String(opt.imageUrl)
          : undefined,
    }))
    .filter((opt) => opt.label.length > 0);
}

// ===== Draw =====

export const DRAW_MAX_NAMES = 200;
export const DRAW_MAX_NAME_LENGTH = 40;

export function sanitizeNames(names: string[]): string[] {
  const normalized = names
    .slice(0, DRAW_MAX_NAMES)
    .map((name) =>
      String(name || '')
        .trim()
        .slice(0, DRAW_MAX_NAME_LENGTH),
    )
    .filter((name) => name.length > 0);

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const name of normalized) {
    if (seen.has(name)) continue;
    seen.add(name);
    deduped.push(name);
  }
  return deduped;
}

/** Tracks which names are still in the hat across successive no-repeat picks. */
export interface DrawSession {
  sourceKey: string;
  remaining: string[];
}

export interface DrawRunInput {
  names: string[];
  mode: DrawMode;
  noRepeat: boolean;
  /** The caller's current session, or null when there is none yet. */
  session: DrawSession | null;
}

export interface DrawRunOutput {
  orderedNames: string[];
  pickedName: string | null;
  remainingNames: string[];
  /** The session to retain for the next run; null clears it. */
  session: DrawSession | null;
}

export function drawSourceKey(names: string[]): string {
  return names.join('|');
}

export function runDraw(input: DrawRunInput, random: RandomFn = defaultRandom): DrawRunOutput {
  const { names, mode, noRepeat } = input;

  let orderedNames = shuffled(names, random);
  let pickedName: string | null = null;
  let remainingNames: string[] = [];
  let session = input.session;

  if (mode !== 'pick') {
    return { orderedNames, pickedName: null, remainingNames: [], session: null };
  }

  if (!noRepeat) {
    pickedName = orderedNames[0] ?? null;
    remainingNames = orderedNames.slice(1);
    return { orderedNames, pickedName, remainingNames, session };
  }

  // No-repeat: keep drawing out of one hat until it empties, then refill it.
  const sourceKey = drawSourceKey(names);
  if (!session || session.sourceKey !== sourceKey || session.remaining.length === 0) {
    session = { sourceKey, remaining: [...names] };
  }

  const pool = [...session.remaining];
  const index = pickIndex(pool.length, random);
  pickedName = pool[index] ?? null;
  if (pickedName) pool.splice(index, 1);

  remainingNames = [...pool];
  orderedNames = shuffled(remainingNames, random);
  session = { sourceKey, remaining: pool };

  return { orderedNames, pickedName, remainingNames, session };
}

// ===== Reaction =====

export const F1_LIGHT_STEP_MS = 1000;
export const F1_LIGHT_COUNT = 5;
export const F1_FULL_LIGHT_HOLD_MIN_MS = 200;
export const F1_FULL_LIGHT_HOLD_MAX_MS = 2000;
export const TARGET_COUNTDOWN_MIN_MS = 1200;
export const TARGET_COUNTDOWN_SPAN_MS = 2600;
/** How long a target-mode round waits for a press before resolving on its own. */
export const TARGET_RESOLVE_TIMEOUT_MS = 7000;

export function normalizeReactionMode(value: unknown): ReactionMode {
  return value === 'target' ? 'target' : 'f1';
}

export function pickReactionTargetCentis(random: RandomFn = defaultRandom): number {
  return 80 + Math.floor(random() * 420);
}

/** Delay between "both ready" and the green light. */
export function reactionCountdownDelayMs(
  mode: ReactionMode,
  random: RandomFn = defaultRandom,
): number {
  if (mode === 'f1') {
    return (
      F1_LIGHT_COUNT * F1_LIGHT_STEP_MS +
      F1_FULL_LIGHT_HOLD_MIN_MS +
      Math.floor(random() * (F1_FULL_LIGHT_HOLD_MAX_MS - F1_FULL_LIGHT_HOLD_MIN_MS + 1))
    );
  }
  return TARGET_COUNTDOWN_MIN_MS + Math.floor(random() * TARGET_COUNTDOWN_SPAN_MS);
}

export type ReactionPresses = Partial<Record<PlayerSlot, number>>;

export interface TargetOutcomeInput {
  greenAt: number | null;
  targetCentis: number | null;
  presses: ReactionPresses;
  hasOpponent: boolean;
}

export interface TargetOutcome {
  winner: PlayerSlot | 'draw';
  deltaCentis: { a: number | null; b: number | null };
}

/** Target mode: closest to the target interval wins, so this compares |elapsed - target|. */
export function resolveTargetOutcome(input: TargetOutcomeInput): TargetOutcome {
  const { greenAt, targetCentis, presses, hasOpponent } = input;

  if (!greenAt || targetCentis === null) {
    return { winner: 'draw', deltaCentis: { a: null, b: null } };
  }

  const toDelta = (slot: PlayerSlot): number | null => {
    const pressedAt = presses[slot];
    if (!pressedAt) return null;
    const elapsedCentis = Math.round((pressedAt - greenAt) / 10);
    return Math.abs(elapsedCentis - targetCentis);
  };

  const deltaCentis = { a: toDelta('a'), b: toDelta('b') };

  if (!hasOpponent) {
    return { winner: deltaCentis.a === null ? 'draw' : 'a', deltaCentis };
  }
  if (deltaCentis.a === null && deltaCentis.b === null) {
    return { winner: 'draw', deltaCentis };
  }
  if (deltaCentis.a === null) return { winner: 'b', deltaCentis };
  if (deltaCentis.b === null) return { winner: 'a', deltaCentis };
  if (deltaCentis.a === deltaCentis.b) return { winner: 'draw', deltaCentis };

  return { winner: deltaCentis.a < deltaCentis.b ? 'a' : 'b', deltaCentis };
}
