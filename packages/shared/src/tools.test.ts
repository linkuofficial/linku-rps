import { describe, it, expect } from 'vitest';
import {
  DICE_MAX_COUNT,
  DICE_MAX_SIDES,
  diceTotal,
  flipCoin,
  isValidDiceCount,
  isValidDiceSides,
  oppositeSlot,
  pickIndex,
  reactionCountdownDelayMs,
  resolveTargetOutcome,
  rollDice,
  runDraw,
  sanitizeNames,
  sanitizeWheelOptions,
  shuffled,
  supportsSoloPlay,
  normalizeReactionMode,
  pickReactionTargetCentis,
  F1_LIGHT_COUNT,
  F1_LIGHT_STEP_MS,
  F1_FULL_LIGHT_HOLD_MIN_MS,
  F1_FULL_LIGHT_HOLD_MAX_MS,
  TARGET_COUNTDOWN_MIN_MS,
  TARGET_COUNTDOWN_SPAN_MS,
} from './tools';
import type { WheelOption } from './index';

/** Replays a fixed sequence of "random" values so outcomes are assertable. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('supportsSoloPlay', () => {
  it('covers every tool except rps', () => {
    expect(supportsSoloPlay('rps')).toBe(false);
    for (const tool of ['coin', 'dice', 'wheel', 'draw', 'reaction'] as const) {
      expect(supportsSoloPlay(tool)).toBe(true);
    }
  });
});

describe('oppositeSlot', () => {
  it('swaps the two slots', () => {
    expect(oppositeSlot('a')).toBe('b');
    expect(oppositeSlot('b')).toBe('a');
  });
});

describe('flipCoin', () => {
  it('splits on 0.5, with the boundary landing on tails', () => {
    expect(flipCoin(seq([0]))).toBe('heads');
    expect(flipCoin(seq([0.499999]))).toBe('heads');
    expect(flipCoin(seq([0.5]))).toBe('tails');
    expect(flipCoin(seq([0.999999]))).toBe('tails');
  });
});

describe('dice', () => {
  it('maps randomness onto the 1..sides range', () => {
    expect(rollDice(3, 6, seq([0, 0.5, 0.999999]))).toEqual([1, 4, 6]);
  });

  it('never returns a value outside the range', () => {
    const values = rollDice(DICE_MAX_COUNT, 20, Math.random);
    expect(values).toHaveLength(DICE_MAX_COUNT);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });

  it('totals the roll', () => {
    expect(diceTotal([1, 2, 3])).toBe(6);
    expect(diceTotal([])).toBe(0);
  });

  it('bounds counts and sides at the documented limits', () => {
    expect(isValidDiceCount(0)).toBe(false);
    expect(isValidDiceCount(1)).toBe(true);
    expect(isValidDiceCount(DICE_MAX_COUNT)).toBe(true);
    expect(isValidDiceCount(DICE_MAX_COUNT + 1)).toBe(false);

    expect(isValidDiceSides(1)).toBe(false);
    expect(isValidDiceSides(2)).toBe(true);
    expect(isValidDiceSides(DICE_MAX_SIDES)).toBe(true);
    expect(isValidDiceSides(DICE_MAX_SIDES + 1)).toBe(false);
  });
});

describe('shuffled / pickIndex', () => {
  it('returns a new array and leaves the input untouched', () => {
    const input = [1, 2, 3];
    const out = shuffled(input, seq([0]));
    expect(input).toEqual([1, 2, 3]);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual([1, 2, 3]);
  });

  it('stays in range at both ends', () => {
    expect(pickIndex(4, seq([0]))).toBe(0);
    expect(pickIndex(4, seq([0.999999]))).toBe(3);
  });
});

describe('sanitizeWheelOptions', () => {
  const opt = (over: Partial<WheelOption>): WheelOption => ({
    id: 'x',
    label: 'label',
    color: '#112233',
    ...over,
  });

  it('drops blank labels and trims/caps the rest', () => {
    const out = sanitizeWheelOptions([
      opt({ label: '   ' }),
      opt({ label: `  ${'y'.repeat(60)}  ` }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toHaveLength(40);
  });

  it('replaces a malformed colour with the fallback', () => {
    const out = sanitizeWheelOptions([opt({ color: 'javascript:alert(1)' })]);
    expect(out[0]!.color).toBe('#64748b');
  });

  it('keeps only http(s) image urls', () => {
    expect(sanitizeWheelOptions([opt({ imageUrl: 'https://a.test/i.png' })])[0]!.imageUrl).toBe(
      'https://a.test/i.png',
    );
    expect(
      sanitizeWheelOptions([opt({ imageUrl: 'javascript:alert(1)' })])[0]!.imageUrl,
    ).toBeUndefined();
    expect(
      sanitizeWheelOptions([opt({ imageUrl: `https://a.test/${'p'.repeat(600)}` })])[0]!.imageUrl,
    ).toBeUndefined();
  });

  it('caps the number of options', () => {
    const many = Array.from({ length: 40 }, (_, i) => opt({ label: `n${i}` }));
    expect(sanitizeWheelOptions(many)).toHaveLength(24);
  });

  it('backfills a missing id', () => {
    expect(sanitizeWheelOptions([opt({ id: '' })])[0]!.id).toBe('opt_1');
  });
});

describe('sanitizeNames', () => {
  it('trims, drops blanks and de-duplicates while preserving order', () => {
    expect(sanitizeNames([' a ', 'b', 'a', '', '   ', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('caps list length and name length', () => {
    expect(sanitizeNames(Array.from({ length: 300 }, (_, i) => `n${i}`))).toHaveLength(200);
    expect(sanitizeNames(['z'.repeat(80)])[0]).toHaveLength(40);
  });
});

describe('runDraw', () => {
  it('shuffle mode picks nobody and clears any session', () => {
    const out = runDraw(
      {
        names: ['a', 'b', 'c'],
        mode: 'shuffle',
        noRepeat: true,
        session: { sourceKey: 'a|b|c', remaining: ['a'] },
      },
      seq([0]),
    );
    expect(out.pickedName).toBeNull();
    expect(out.session).toBeNull();
    expect([...out.orderedNames].sort()).toEqual(['a', 'b', 'c']);
  });

  it('repeatable pick takes the head of a fresh shuffle', () => {
    const out = runDraw(
      { names: ['a', 'b', 'c'], mode: 'pick', noRepeat: false, session: null },
      seq([0]),
    );
    expect(out.pickedName).toBe(out.orderedNames[0]);
    expect(out.remainingNames).toEqual(out.orderedNames.slice(1));
  });

  it('no-repeat drains the hat without repeating a name', () => {
    const names = ['a', 'b', 'c'];
    const picked: string[] = [];
    let session = null as null | { sourceKey: string; remaining: string[] };

    for (let i = 0; i < 3; i++) {
      const out = runDraw({ names, mode: 'pick', noRepeat: true, session }, Math.random);
      expect(out.pickedName).not.toBeNull();
      picked.push(out.pickedName!);
      session = out.session;
    }

    expect([...picked].sort()).toEqual(['a', 'b', 'c']);
    expect(session!.remaining).toEqual([]);
  });

  it('refills the hat once it empties', () => {
    const names = ['a', 'b'];
    const session = { sourceKey: 'a|b', remaining: [] as string[] };
    const out = runDraw({ names, mode: 'pick', noRepeat: true, session }, seq([0]));
    expect(out.pickedName).not.toBeNull();
    expect(out.session!.remaining).toHaveLength(1);
  });

  it('starts a new hat when the name list changes', () => {
    const session = { sourceKey: 'a|b', remaining: ['a', 'b'] };
    const out = runDraw(
      { names: ['x', 'y'], mode: 'pick', noRepeat: true, session },
      seq([0]),
    );
    expect(out.session!.sourceKey).toBe('x|y');
    expect(['x', 'y']).toContain(out.pickedName);
  });

  it('does not mutate the session it was handed', () => {
    const session = { sourceKey: 'a|b', remaining: ['a', 'b'] };
    runDraw({ names: ['a', 'b'], mode: 'pick', noRepeat: true, session }, seq([0]));
    expect(session.remaining).toEqual(['a', 'b']);
  });

  it('handles an empty name list without throwing', () => {
    const out = runDraw({ names: [], mode: 'pick', noRepeat: true, session: null }, seq([0]));
    expect(out.pickedName).toBeNull();
    expect(out.remainingNames).toEqual([]);
  });
});

describe('reaction timing', () => {
  it('normalises the mode, defaulting anything unknown to f1', () => {
    expect(normalizeReactionMode('target')).toBe('target');
    expect(normalizeReactionMode('f1')).toBe('f1');
    expect(normalizeReactionMode(undefined)).toBe('f1');
    expect(normalizeReactionMode('nonsense')).toBe('f1');
  });

  it('keeps the target interval inside its published window', () => {
    expect(pickReactionTargetCentis(seq([0]))).toBe(80);
    expect(pickReactionTargetCentis(seq([0.999999]))).toBe(499);
  });

  it('holds the f1 countdown past the full light sequence', () => {
    const floor = F1_LIGHT_COUNT * F1_LIGHT_STEP_MS + F1_FULL_LIGHT_HOLD_MIN_MS;
    expect(reactionCountdownDelayMs('f1', seq([0]))).toBe(floor);
    expect(reactionCountdownDelayMs('f1', seq([0.999999]))).toBe(
      F1_LIGHT_COUNT * F1_LIGHT_STEP_MS + F1_FULL_LIGHT_HOLD_MAX_MS,
    );
  });

  it('keeps the target countdown inside its window', () => {
    expect(reactionCountdownDelayMs('target', seq([0]))).toBe(TARGET_COUNTDOWN_MIN_MS);
    expect(reactionCountdownDelayMs('target', seq([0.999999]))).toBe(
      TARGET_COUNTDOWN_MIN_MS + TARGET_COUNTDOWN_SPAN_MS - 1,
    );
  });
});

describe('resolveTargetOutcome', () => {
  const greenAt = 1_000_000;

  it('awards a solo press regardless of accuracy', () => {
    const out = resolveTargetOutcome({
      greenAt,
      targetCentis: 100,
      presses: { a: greenAt + 1500 },
      hasOpponent: false,
    });
    expect(out.winner).toBe('a');
    expect(out.deltaCentis.a).toBe(50);
  });

  it('draws when the solo player never pressed', () => {
    const out = resolveTargetOutcome({
      greenAt,
      targetCentis: 100,
      presses: {},
      hasOpponent: false,
    });
    expect(out.winner).toBe('draw');
  });

  it('gives the round to whoever landed closer to the target', () => {
    const out = resolveTargetOutcome({
      greenAt,
      targetCentis: 100,
      presses: { a: greenAt + 1100, b: greenAt + 900 },
      hasOpponent: true,
    });
    expect(out.deltaCentis).toEqual({ a: 10, b: 10 });
    expect(out.winner).toBe('draw');
  });

  it('prefers the closer of two presses', () => {
    const out = resolveTargetOutcome({
      greenAt,
      targetCentis: 100,
      presses: { a: greenAt + 1050, b: greenAt + 1300 },
      hasOpponent: true,
    });
    expect(out.winner).toBe('a');
  });

  it('awards the round to the only player who pressed', () => {
    expect(
      resolveTargetOutcome({
        greenAt,
        targetCentis: 100,
        presses: { b: greenAt + 1000 },
        hasOpponent: true,
      }).winner,
    ).toBe('b');
    expect(
      resolveTargetOutcome({
        greenAt,
        targetCentis: 100,
        presses: { a: greenAt + 1000 },
        hasOpponent: true,
      }).winner,
    ).toBe('a');
  });

  it('draws when neither player pressed', () => {
    expect(
      resolveTargetOutcome({ greenAt, targetCentis: 100, presses: {}, hasOpponent: true }).winner,
    ).toBe('draw');
  });

  it('draws when the round never went green', () => {
    const out = resolveTargetOutcome({
      greenAt: null,
      targetCentis: 100,
      presses: { a: greenAt + 1000 },
      hasOpponent: true,
    });
    expect(out).toEqual({ winner: 'draw', deltaCentis: { a: null, b: null } });
  });

  it('draws when no target was drawn for the round', () => {
    const out = resolveTargetOutcome({
      greenAt,
      targetCentis: null,
      presses: { a: greenAt + 1000 },
      hasOpponent: true,
    });
    expect(out).toEqual({ winner: 'draw', deltaCentis: { a: null, b: null } });
  });
});
