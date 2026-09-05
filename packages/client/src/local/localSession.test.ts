import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage, WheelOption } from '@rps/shared';
import {
    F1_LIGHT_COUNT,
    F1_LIGHT_STEP_MS,
    F1_FULL_LIGHT_HOLD_MAX_MS,
    TARGET_RESOLVE_TIMEOUT_MS,
} from '@rps/shared';
import { LocalSession } from './localSession';

/** Longest an f1 countdown can run, so tests can advance past it whatever was drawn. */
const MAX_F1_COUNTDOWN_MS = F1_LIGHT_COUNT * F1_LIGHT_STEP_MS + F1_FULL_LIGHT_HOLD_MAX_MS;

function harness() {
    const emitted: ServerMessage[] = [];
    const session = new LocalSession((msg) => emitted.push(msg));
    return {
        session,
        emitted,
        /** All emitted messages of one type, in order. */
        ofType<T extends ServerMessage['type']>(type: T) {
            return emitted.filter((m) => m.type === type) as Extract<ServerMessage, { type: T }>[];
        },
        last() {
            return emitted[emitted.length - 1];
        },
        clear() {
            emitted.length = 0;
        },
    };
}

function started(tool: 'coin' | 'dice' | 'wheel' | 'draw' | 'reaction', bestOf = 1) {
    const h = harness();
    expect(h.session.send({ type: 'create_room', tool, bestOf })).toBe(true);
    h.clear();
    return h;
}

const wheelOptions: WheelOption[] = [
    { id: '1', label: 'one', color: '#111111' },
    { id: '2', label: 'two', color: '#222222' },
];

describe('LocalSession lifecycle', () => {
    it('starts a solo game without inventing a room code', () => {
        const h = harness();
        expect(h.session.send({ type: 'create_room', tool: 'coin', bestOf: 1 })).toBe(true);

        // No room_created: a local game has no code to share and nothing to reconnect to.
        expect(h.ofType('room_created')).toHaveLength(0);
        expect(h.emitted).toEqual([{ type: 'game_start', you: 'a', bestOf: 1, tool: 'coin' }]);
        expect(h.session.active).toBe(true);
        expect(h.session.tool).toBe('coin');
    });

    it('refuses rps, which cannot be played alone', () => {
        const h = harness();
        expect(h.session.send({ type: 'create_room', tool: 'rps', bestOf: 3 })).toBe(false);
        expect(h.emitted).toHaveLength(0);
        expect(h.session.active).toBe(false);
    });

    it('refuses an unknown tool', () => {
        const h = harness();
        expect(
            h.session.send({
                type: 'create_room',
                tool: 'nonsense' as 'coin',
                bestOf: 1,
            }),
        ).toBe(false);
        expect(h.session.active).toBe(false);
    });

    it('normalises an out-of-range bestOf', () => {
        const h = harness();
        h.session.send({ type: 'create_room', tool: 'coin', bestOf: 99 });
        expect(h.emitted[0]).toMatchObject({ type: 'game_start', bestOf: 3 });
    });

    it('rejects gameplay before a game has been started', () => {
        const h = harness();
        expect(h.session.send({ type: 'coin_flip' })).toBe(false);
        expect(h.session.send({ type: 'dice_roll', count: 1, sides: 6 })).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });

    it('rejects a message meant for a different tool', () => {
        const h = started('coin');
        expect(h.session.send({ type: 'dice_roll', count: 1, sides: 6 })).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });

    it('refuses messages that need a real server', () => {
        const h = started('coin');
        expect(h.session.send({ type: 'join_room', roomId: '12345' })).toBe(false);
        expect(h.session.send({ type: 'reconnect', roomId: '12345', reconnectToken: 't' })).toBe(
            false,
        );
        expect(h.session.send({ type: 'choice', choice: 'rock' })).toBe(false);
        expect(h.session.send({ type: 'rematch_request' })).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });

    it('stops serving once closed', () => {
        const h = started('coin');
        h.session.close();
        expect(h.session.active).toBe(false);
        expect(h.session.send({ type: 'coin_flip' })).toBe(false);
    });

    it('starting a second game resets the round counter', () => {
        const h = started('coin');
        h.session.send({ type: 'coin_flip' });
        h.session.send({ type: 'coin_flip' });
        h.clear();

        h.session.send({ type: 'create_room', tool: 'coin', bestOf: 1 });
        h.clear();
        h.session.send({ type: 'coin_flip' });
        expect(h.ofType('coin_result')[0]!.round).toBe(1);
    });
});

describe('LocalSession coin', () => {
    it('reports a flip and advances the round', () => {
        const h = started('coin');

        expect(h.session.send({ type: 'coin_flip' })).toBe(true);
        expect(h.session.send({ type: 'coin_flip' })).toBe(true);

        const results = h.ofType('coin_result');
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.round)).toEqual([1, 2]);
        for (const r of results) {
            expect(['heads', 'tails']).toContain(r.result);
            expect(r.by).toBe('a');
        }
    });
});

describe('LocalSession dice', () => {
    it('rolls the requested dice and totals them', () => {
        const h = started('dice');
        expect(h.session.send({ type: 'dice_roll', count: 3, sides: 6 })).toBe(true);

        const [result] = h.ofType('dice_result');
        expect(result!.values).toHaveLength(3);
        expect(result!.total).toBe(result!.values.reduce((a, b) => a + b, 0));
        expect(result!.count).toBe(3);
        expect(result!.sides).toBe(6);
    });

    it('never produces a duel result, because there is no opponent', () => {
        const h = started('dice');
        h.session.send({ type: 'dice_roll', count: 1, sides: 6 });
        h.session.send({ type: 'dice_roll', count: 1, sides: 6 });
        expect(h.ofType('dice_duel_result')).toHaveLength(0);
        expect(h.ofType('dice_result')).toHaveLength(2);
    });

    it('rejects counts and sides outside the shared limits', () => {
        const h = started('dice');
        expect(h.session.send({ type: 'dice_roll', count: 0, sides: 6 })).toBe(false);
        expect(h.session.send({ type: 'dice_roll', count: 21, sides: 6 })).toBe(false);
        expect(h.session.send({ type: 'dice_roll', count: 1, sides: 1 })).toBe(false);
        expect(h.session.send({ type: 'dice_roll', count: 1, sides: 1001 })).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });

    it('falls back to 1d6 when the request omits numbers', () => {
        const h = started('dice');
        h.session.send({
            type: 'dice_roll',
            count: undefined as unknown as number,
            sides: undefined as unknown as number,
        });
        expect(h.ofType('dice_result')[0]).toMatchObject({ count: 1, sides: 6 });
    });
});

describe('LocalSession wheel', () => {
    it('spins and selects an option that exists', () => {
        const h = started('wheel');
        expect(h.session.send({ type: 'wheel_spin', options: wheelOptions })).toBe(true);

        const [result] = h.ofType('wheel_result');
        expect(result!.options).toHaveLength(2);
        expect(result!.selectedIndex).toBeGreaterThanOrEqual(0);
        expect(result!.selectedIndex).toBeLessThan(result!.options.length);
    });

    it('refuses a wheel that has fewer than two usable options', () => {
        const h = started('wheel');
        expect(h.session.send({ type: 'wheel_spin', options: [wheelOptions[0]!] })).toBe(false);
        expect(
            h.session.send({
                type: 'wheel_spin',
                options: [wheelOptions[0]!, { id: '2', label: '   ', color: '#222222' }],
            }),
        ).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });

    it('sanitises options before returning them', () => {
        const h = started('wheel');
        h.session.send({
            type: 'wheel_spin',
            options: [
                { id: '1', label: '  keep  ', color: 'not-a-colour' },
                { id: '2', label: 'two', color: '#222222', imageUrl: 'javascript:alert(1)' },
            ],
        });
        const [result] = h.ofType('wheel_result');
        expect(result!.options[0]!.label).toBe('keep');
        expect(result!.options[0]!.color).toBe('#64748b');
        expect(result!.options[1]!.imageUrl).toBeUndefined();
    });
});

describe('LocalSession draw', () => {
    it('picks a name and reports the remainder', () => {
        const h = started('draw');
        expect(
            h.session.send({ type: 'draw_run', names: ['a', 'b', 'c'], mode: 'pick', noRepeat: false }),
        ).toBe(true);

        const [result] = h.ofType('draw_result');
        expect(result!.sourceNames).toEqual(['a', 'b', 'c']);
        expect(['a', 'b', 'c']).toContain(result!.pickedName);
        expect(result!.remainingNames).toHaveLength(2);
    });

    it('does not repeat a name while the hat lasts', () => {
        const h = started('draw');
        for (let i = 0; i < 3; i++) {
            h.session.send({ type: 'draw_run', names: ['a', 'b', 'c'], mode: 'pick', noRepeat: true });
        }
        const picked = h.ofType('draw_result').map((r) => r.pickedName);
        expect([...picked].sort()).toEqual(['a', 'b', 'c']);
    });

    it('shuffle mode returns an ordering and picks nobody', () => {
        const h = started('draw');
        h.session.send({ type: 'draw_run', names: ['a', 'b'], mode: 'shuffle', noRepeat: false });
        const [result] = h.ofType('draw_result');
        expect(result!.pickedName).toBeNull();
        expect([...result!.orderedNames].sort()).toEqual(['a', 'b']);
    });

    it('refuses a list with no usable names', () => {
        const h = started('draw');
        expect(h.session.send({ type: 'draw_run', names: [], mode: 'pick', noRepeat: false })).toBe(
            false,
        );
        expect(
            h.session.send({ type: 'draw_run', names: ['  ', ''], mode: 'pick', noRepeat: false }),
        ).toBe(false);
        expect(h.emitted).toHaveLength(0);
    });
});

describe('LocalSession reaction', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('runs an f1 round from ready to green to a win', () => {
        const h = started('reaction');

        expect(h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' })).toBe(true);
        const states = h.ofType('reaction_state');
        expect(states.map((s) => s.phase)).toEqual(['idle', 'countdown']);
        expect(states[1]!.readyBy).toEqual(['a']);
        expect(states[1]!.countdownMs).toBeGreaterThan(0);

        vi.advanceTimersByTime(MAX_F1_COUNTDOWN_MS);
        expect(h.ofType('reaction_state').at(-1)!.phase).toBe('green');

        vi.advanceTimersByTime(200);
        expect(h.session.send({ type: 'reaction_press' })).toBe(true);

        const [result] = h.ofType('reaction_result');
        expect(result!.winner).toBe('a');
        expect(result!.falseStartBy).toBeNull();
        expect(result!.reactionMs.a).toBeGreaterThanOrEqual(0);
        expect(result!.reactionMs.b).toBeNull();
    });

    it('treats a press during the countdown as a false start', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' });
        h.clear();

        expect(h.session.send({ type: 'reaction_press' })).toBe(true);
        const [result] = h.ofType('reaction_result');
        expect(result!.winner).toBe('draw');
        expect(result!.falseStartBy).toBe('a');
    });

    it('ignores a second press in the same round', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' });
        vi.advanceTimersByTime(MAX_F1_COUNTDOWN_MS);
        h.session.send({ type: 'reaction_press' });
        h.clear();

        expect(h.session.send({ type: 'reaction_press' })).toBe(true);
        expect(h.ofType('reaction_result')).toHaveLength(0);
    });

    it('cannot be re-armed while a round is counting down', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' });
        h.clear();

        expect(h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' })).toBe(true);
        expect(h.emitted).toHaveLength(0);
    });

    it('un-readying before the countdown starts emits idle and no countdown', () => {
        const h = started('reaction');
        expect(h.session.send({ type: 'reaction_ready', ready: false, mode: 'f1' })).toBe(true);
        const states = h.ofType('reaction_state');
        expect(states.map((s) => s.phase)).toEqual(['idle']);
        expect(states[0]!.readyBy).toEqual([]);
    });

    it('scores a target round on how close the press was', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'target' });

        const countdown = h.ofType('reaction_state').at(-1)!;
        expect(countdown.targetCentis).not.toBeNull();
        vi.advanceTimersByTime(countdown.countdownMs!);
        expect(h.ofType('reaction_state').at(-1)!.phase).toBe('green');

        vi.advanceTimersByTime(countdown.targetCentis! * 10);
        h.session.send({ type: 'reaction_press' });

        const [result] = h.ofType('reaction_result');
        expect(result!.winner).toBe('a');
        expect(result!.deltaCentis.a).toBe(0);
    });

    it('resolves a target round on its own when nobody presses', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'target' });
        const countdown = h.ofType('reaction_state').at(-1)!;
        vi.advanceTimersByTime(countdown.countdownMs!);
        h.clear();

        vi.advanceTimersByTime(TARGET_RESOLVE_TIMEOUT_MS);
        const [result] = h.ofType('reaction_result');
        expect(result!.winner).toBe('draw');
        expect(result!.by).toBe('system');
    });

    it('advances the round and can be re-armed after a result', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' });
        vi.advanceTimersByTime(MAX_F1_COUNTDOWN_MS);
        h.session.send({ type: 'reaction_press' });
        expect(h.ofType('reaction_result')[0]!.round).toBe(1);
        h.clear();

        expect(h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' })).toBe(true);
        expect(h.ofType('reaction_state')[0]!.round).toBe(2);
    });

    it('closing cancels a pending countdown', () => {
        const h = started('reaction');
        h.session.send({ type: 'reaction_ready', ready: true, mode: 'f1' });
        h.clear();

        h.session.close();
        vi.advanceTimersByTime(MAX_F1_COUNTDOWN_MS + TARGET_RESOLVE_TIMEOUT_MS);
        expect(h.emitted).toHaveLength(0);
    });
});

describe('LocalSession chat and emoji', () => {
    it('echoes chat back the way a solo server room would', () => {
        const h = started('coin');
        expect(h.session.send({ type: 'chat', text: '  hello  ' })).toBe(true);
        expect(h.last()).toMatchObject({ type: 'chat_broadcast', from: 'a', text: 'hello' });
    });

    it('drops empty chat and caps long messages', () => {
        const h = started('coin');
        expect(h.session.send({ type: 'chat', text: '   ' })).toBe(false);

        h.session.send({ type: 'chat', text: 'x'.repeat(200) });
        const broadcast = h.ofType('chat_broadcast')[0]!;
        expect(broadcast.text).toHaveLength(100);
    });

    it('echoes a single emoji and rejects anything longer', () => {
        const h = started('coin');
        expect(h.session.send({ type: 'emoji', emoji: '🎲' })).toBe(true);
        expect(h.last()).toMatchObject({ type: 'emoji_broadcast', from: 'a', emoji: '🎲' });

        expect(h.session.send({ type: 'emoji', emoji: '🎲🎲' })).toBe(false);
        expect(h.session.send({ type: 'emoji', emoji: '' })).toBe(false);
    });
});
