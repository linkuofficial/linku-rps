import type { ClientMessage } from '@rps/shared';

/**
 * Every supported client message type, declared as a Record keyed by
 * `ClientMessage['type']`. Keying it this way makes the compiler force this table
 * to stay in sync with the shared union: adding a new message type without
 * listing it here is a type error, and listing an unknown one is too.
 */
const SUPPORTED_CLIENT_MESSAGE_TYPES: Record<ClientMessage['type'], true> = {
    create_room: true,
    join_room: true,
    reconnect: true,
    choice: true,
    chat: true,
    emoji: true,
    rematch_request: true,
    rematch_response: true,
    coin_flip: true,
    dice_roll: true,
    wheel_spin: true,
    draw_run: true,
    reaction_ready: true,
    reaction_press: true,
};

/** True only for a string that names a message the server actually handles. */
export function isSupportedClientMessageType(type: unknown): type is ClientMessage['type'] {
    return (
        typeof type === 'string' &&
        Object.prototype.hasOwnProperty.call(SUPPORTED_CLIENT_MESSAGE_TYPES, type)
    );
}

export type ClientPayloadValidation = { ok: true; message: ClientMessage } | { ok: false };

/**
 * Structural guard for a freshly `JSON.parse`d WebSocket payload.
 *
 * A syntactically valid JSON document can still be `null`, an array, a bare
 * scalar (string/number/boolean), or an object whose `type` is missing or
 * unknown. Those shapes are unsafe for downstream code to read `.type` off
 * of, and any failure here needs to stay contained rather than propagate.
 * Validate the envelope here — non-null plain object with a supported
 * string `type` — before the rate bucket or handler switch ever touches it.
 *
 * Field-level shape (e.g. `join_room` with no `roomId`) is intentionally NOT
 * checked here; those are contained by the per-message try/catch in the handler.
 */
export function validateClientPayload(raw: unknown): ClientPayloadValidation {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false };
    }
    const type = (raw as { type?: unknown }).type;
    if (!isSupportedClientMessageType(type)) {
        return { ok: false };
    }
    return { ok: true, message: raw as ClientMessage };
}
