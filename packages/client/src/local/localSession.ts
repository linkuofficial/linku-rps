import type {
    ClientMessage,
    PlayerSlot,
    ReactionMode,
    ReactionPhase,
    ServerMessage,
    ToolId,
} from '@rps/shared';
import {
    DICE_DEFAULT_COUNT,
    DICE_DEFAULT_SIDES,
    TARGET_RESOLVE_TIMEOUT_MS,
    WHEEL_MIN_OPTIONS,
    type DrawSession,
    diceTotal,
    flipCoin,
    isToolId,
    isValidDiceCount,
    isValidDiceSides,
    normalizeBestOf,
    normalizeReactionMode,
    pickIndex,
    pickReactionTargetCentis,
    reactionCountdownDelayMs,
    resolveTargetOutcome,
    rollDice,
    runDraw,
    sanitizeNames,
    sanitizeWheelOptions,
    supportsSoloPlay,
} from '@rps/shared';

/**
 * A single-player game played entirely in the browser.
 *
 * The backend is a free-tier service that can disappear, and when it does every tool —
 * including rolling one die by yourself — used to stop working. This runs the solo half of
 * the same protocol locally: it accepts the ClientMessages the UI already sends and emits
 * the ServerMessages the UI already understands, so nothing above the transport changes.
 *
 * Outcome logic is not reimplemented here; it comes from `@rps/shared` so the offline and
 * online paths cannot drift. What lives here is only the room bookkeeping the server would
 * otherwise do: round counter, score, draw hat, reaction timers.
 */

/** The offline player always occupies slot A; there is no slot B. */
const ME: PlayerSlot = 'a';

const CHAT_MAX_LENGTH = 100;

interface LocalReactionSession {
    phase: ReactionPhase;
    mode: ReactionMode;
    targetCentis: number | null;
    ready: boolean;
    greenAt: number | null;
    countdownMs: number | null;
    pressedAt: number | null;
    timer: ReturnType<typeof setTimeout> | null;
}

interface LocalRoom {
    tool: ToolId;
    bestOf: number;
    round: number;
    score: number;
    drawSession: DrawSession | null;
    reaction: LocalReactionSession | null;
}

export type LocalEmit = (msg: ServerMessage) => void;

export class LocalSession {
    private room: LocalRoom | null = null;

    constructor(private readonly emit: LocalEmit) {}

    /** True once a local game has been started and not yet closed. */
    get active(): boolean {
        return this.room !== null;
    }

    get tool(): ToolId | null {
        return this.room?.tool ?? null;
    }

    /**
     * Handle one client message. Returns false for anything this session cannot serve —
     * the caller then treats it exactly like a failed socket send.
     */
    send(msg: ClientMessage): boolean {
        switch (msg.type) {
            case 'create_room':
                return this.createRoom(msg.tool, msg.bestOf);
            case 'coin_flip':
                return this.coinFlip();
            case 'dice_roll':
                return this.diceRoll(msg.count, msg.sides);
            case 'wheel_spin':
                return this.wheelSpin(msg.options);
            case 'draw_run':
                return this.drawRun(msg.names, msg.mode, msg.noRepeat);
            case 'reaction_ready':
                return this.reactionReady(msg.ready, msg.mode);
            case 'reaction_press':
                return this.reactionPress();
            case 'chat':
                return this.chat(msg.text);
            case 'emoji':
                return this.emoji(msg.emoji);
            default:
                // join/reconnect/choice/rematch all need a real room on a real server.
                return false;
        }
    }

    /** Drop the game and cancel any pending reaction timer. */
    close(): void {
        this.clearReactionTimer();
        this.room = null;
    }

    // ===== Lifecycle =====

    private createRoom(tool: ToolId, bestOf: number): boolean {
        if (!isToolId(tool) || !supportsSoloPlay(tool)) return false;

        this.clearReactionTimer();
        this.room = {
            tool,
            bestOf: normalizeBestOf(bestOf),
            round: 1,
            score: 0,
            drawSession: null,
            reaction: null,
        };

        // No `room_created`: there is no room code to join and nothing to reconnect to, and
        // leaving roomId unset is what keeps the invite panel and the ?room= URL away.
        this.emit({ type: 'game_start', you: ME, bestOf: this.room.bestOf, tool });
        return true;
    }

    /** Returns the room only when it is present and running the expected tool. */
    private roomFor(tool: ToolId): LocalRoom | null {
        if (!this.room || this.room.tool !== tool) return null;
        return this.room;
    }

    // ===== Tools =====

    private coinFlip(): boolean {
        const room = this.roomFor('coin');
        if (!room) return false;

        this.emit({
            type: 'coin_result',
            result: flipCoin(),
            by: ME,
            round: room.round,
            timestamp: Date.now(),
        });
        room.round++;
        return true;
    }

    private diceRoll(rawCount: number, rawSides: number): boolean {
        const room = this.roomFor('dice');
        if (!room) return false;

        const count = Number.isInteger(rawCount) ? rawCount : DICE_DEFAULT_COUNT;
        const sides = Number.isInteger(rawSides) ? rawSides : DICE_DEFAULT_SIDES;
        if (!isValidDiceCount(count) || !isValidDiceSides(sides)) return false;

        const values = rollDice(count, sides);
        this.emit({
            type: 'dice_result',
            values,
            total: diceTotal(values),
            count,
            sides,
            by: ME,
            round: room.round,
            timestamp: Date.now(),
        });
        room.round++;
        return true;
    }

    private wheelSpin(rawOptions: Parameters<typeof sanitizeWheelOptions>[0]): boolean {
        const room = this.roomFor('wheel');
        if (!room) return false;

        const options = sanitizeWheelOptions(rawOptions);
        if (options.length < WHEEL_MIN_OPTIONS) return false;

        this.emit({
            type: 'wheel_result',
            options,
            selectedIndex: pickIndex(options.length),
            by: ME,
            round: room.round,
            timestamp: Date.now(),
        });
        room.round++;
        return true;
    }

    private drawRun(rawNames: string[], rawMode: unknown, rawNoRepeat: unknown): boolean {
        const room = this.roomFor('draw');
        if (!room) return false;

        const names = sanitizeNames(rawNames);
        if (names.length < 1) return false;

        const mode = rawMode === 'shuffle' ? 'shuffle' : 'pick';
        const noRepeat = rawNoRepeat === true;
        const drawn = runDraw({ names, mode, noRepeat, session: room.drawSession });
        room.drawSession = drawn.session;

        this.emit({
            type: 'draw_result',
            mode,
            noRepeat,
            sourceNames: names,
            orderedNames: drawn.orderedNames,
            pickedName: drawn.pickedName,
            remainingNames: drawn.remainingNames,
            by: ME,
            round: room.round,
            timestamp: Date.now(),
        });
        room.round++;
        return true;
    }

    // ===== Reaction =====

    private ensureReaction(room: LocalRoom): LocalReactionSession {
        if (!room.reaction) {
            room.reaction = {
                phase: 'idle',
                mode: 'f1',
                targetCentis: null,
                ready: false,
                greenAt: null,
                countdownMs: null,
                pressedAt: null,
                timer: null,
            };
        }
        return room.reaction;
    }

    private clearReactionTimer(): void {
        const reaction = this.room?.reaction;
        if (!reaction?.timer) return;
        clearTimeout(reaction.timer);
        reaction.timer = null;
    }

    private emitReactionState(room: LocalRoom, by: PlayerSlot | 'system'): void {
        const reaction = room.reaction;
        if (!reaction) return;

        this.emit({
            type: 'reaction_state',
            phase: reaction.phase,
            mode: reaction.mode,
            targetCentis: reaction.targetCentis,
            readyBy: reaction.ready ? [ME] : [],
            pressedBy: reaction.phase === 'green' && reaction.pressedAt ? [ME] : [],
            countdownMs: reaction.countdownMs,
            greenAt: reaction.greenAt,
            by,
            round: room.round,
            timestamp: Date.now(),
        });
    }

    private reactionReady(rawReady: unknown, rawMode: unknown): boolean {
        const room = this.roomFor('reaction');
        if (!room) return false;

        const reaction = this.ensureReaction(room);
        // A round already counting down or live cannot be re-armed.
        if (reaction.phase === 'countdown' || reaction.phase === 'green') return true;

        reaction.mode = rawMode ? normalizeReactionMode(rawMode) : reaction.mode;
        reaction.ready = rawReady === true;
        reaction.phase = 'idle';
        reaction.pressedAt = null;
        reaction.greenAt = null;
        reaction.countdownMs = null;
        reaction.targetCentis = null;

        this.emitReactionState(room, ME);
        if (!reaction.ready) return true;

        const delay = reactionCountdownDelayMs(reaction.mode);
        reaction.phase = 'countdown';
        reaction.targetCentis = reaction.mode === 'target' ? pickReactionTargetCentis() : null;
        reaction.countdownMs = delay;
        reaction.greenAt = Date.now() + delay;
        this.emitReactionState(room, 'system');

        this.clearReactionTimer();
        reaction.timer = setTimeout(() => this.goGreen(room), delay);
        return true;
    }

    private goGreen(room: LocalRoom): void {
        const reaction = room.reaction;
        if (this.room !== room || !reaction || reaction.phase !== 'countdown') return;

        reaction.phase = 'green';
        reaction.countdownMs = 0;
        reaction.timer = null;
        this.emitReactionState(room, 'system');

        if (reaction.mode !== 'target') return;
        // Target mode ends on its own if the player never presses.
        reaction.timer = setTimeout(() => {
            if (this.room !== room || reaction.phase !== 'green') return;
            const resolved = resolveTargetOutcome({
                greenAt: reaction.greenAt,
                targetCentis: reaction.targetCentis,
                presses: reaction.pressedAt ? { a: reaction.pressedAt } : {},
                hasOpponent: false,
            });
            this.finalizeReaction(room, 'system', resolved.winner, null);
        }, TARGET_RESOLVE_TIMEOUT_MS);
    }

    private reactionPress(): boolean {
        const room = this.roomFor('reaction');
        if (!room?.reaction) return false;

        const reaction = room.reaction;
        if (reaction.phase === 'result') return true;

        if (reaction.phase === 'countdown') {
            reaction.pressedAt = Date.now();
            this.finalizeReaction(room, ME, 'draw', ME);
            return true;
        }

        if (reaction.phase !== 'green' || reaction.pressedAt) return true;

        reaction.pressedAt = Date.now();

        if (reaction.mode === 'target') {
            const resolved = resolveTargetOutcome({
                greenAt: reaction.greenAt,
                targetCentis: reaction.targetCentis,
                presses: { a: reaction.pressedAt },
                hasOpponent: false,
            });
            this.finalizeReaction(room, ME, resolved.winner, null);
            return true;
        }

        this.finalizeReaction(room, ME, ME, null);
        return true;
    }

    private finalizeReaction(
        room: LocalRoom,
        by: PlayerSlot | 'system',
        winner: PlayerSlot | 'draw',
        falseStartBy: PlayerSlot | null,
    ): void {
        const reaction = room.reaction;
        if (!reaction) return;

        const { greenAt, pressedAt } = reaction;
        const elapsedMs = greenAt && pressedAt ? Math.max(0, pressedAt - greenAt) : null;
        const deltaA =
            reaction.mode === 'target' && elapsedMs !== null && reaction.targetCentis !== null
                ? Math.abs(Math.round(elapsedMs / 10) - reaction.targetCentis)
                : null;

        if (winner === ME) room.score += 1;

        const targetCentis = reaction.targetCentis;
        reaction.phase = 'result';
        reaction.ready = false;
        reaction.countdownMs = null;
        reaction.greenAt = null;
        this.clearReactionTimer();

        this.emit({
            type: 'reaction_result',
            mode: reaction.mode,
            targetCentis,
            deltaCentis: { a: deltaA, b: null },
            winner,
            falseStartBy,
            reactionMs: { a: elapsedMs, b: null },
            by,
            round: room.round,
            timestamp: Date.now(),
        });

        reaction.targetCentis = null;
        room.round += 1;
    }

    // ===== Chat / emoji =====
    // Solo rooms echo these back the way the server's broadcast does, so the UI behaves the
    // same whether the game is running locally or on the backend.

    private chat(rawText: string): boolean {
        if (!this.room) return false;

        const text = String(rawText || '')
            .trim()
            .slice(0, CHAT_MAX_LENGTH);
        if (!text) return false;

        this.emit({ type: 'chat_broadcast', from: ME, text, timestamp: Date.now() });
        return true;
    }

    private emoji(rawEmoji: string): boolean {
        if (!this.room) return false;

        const emoji = String(rawEmoji || '');
        const graphemes =
            typeof Intl !== 'undefined' && 'Segmenter' in Intl
                ? [...new Intl.Segmenter().segment(emoji)].length
                : [...emoji].length;
        if (!emoji || graphemes > 1) return false;

        this.emit({ type: 'emoji_broadcast', from: ME, emoji });
        return true;
    }
}
