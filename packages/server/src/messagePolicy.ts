import type { ClientMessage, InvalidGameStateReason } from '@rps/shared';

export type MessageRateBucket = 'system' | 'chat' | 'reaction';

export const MESSAGE_RATE_LIMIT_PER_SECOND: Record<MessageRateBucket, number> = {
    system: 30,
    chat: 6,
    reaction: 12,
};

export function getMessageRateBucket(type: ClientMessage['type']): MessageRateBucket {
    if (type === 'chat' || type === 'emoji') return 'chat';
    if (type === 'reaction_ready' || type === 'reaction_press') return 'reaction';
    return 'system';
}

export function getMessageRateLimitPerSecond(bucket: MessageRateBucket): number {
    return MESSAGE_RATE_LIMIT_PER_SECOND[bucket];
}

const INVALID_GAME_STATE_MESSAGES: Record<InvalidGameStateReason, string> = {
    rate_limit_exceeded: 'Rate limit exceeded',
    room_not_ready: 'Room is not ready for play',
    game_already_finished: 'Game already finished',
    choice_tool_mismatch: 'Choice is only allowed in rps tool',
    choice_invalid_value: 'Invalid choice value',
    coin_tool_mismatch: 'Coin flip is only allowed in coin tool',
    dice_tool_mismatch: 'Dice roll is only allowed in dice tool',
    dice_count_out_of_range: 'Dice count must be between 1 and 20',
    dice_sides_out_of_range: 'Dice sides must be between 2 and 1000',
    wheel_tool_mismatch: 'Wheel spin is only allowed in wheel tool',
    wheel_requires_two_options: 'Wheel requires at least 2 valid options',
    draw_tool_mismatch: 'Draw run is only allowed in draw tool',
    draw_requires_name: 'Draw requires at least 1 valid name',
    reaction_ready_tool_mismatch: 'Reaction ready is only allowed in reaction tool',
    reaction_ready_locked: 'Cannot change readiness during active reaction round',
    reaction_press_tool_mismatch: 'Reaction press is only allowed during reaction rounds',
    reaction_round_ended: 'Reaction round already ended',
    reaction_not_green: 'Reaction press is only allowed when light is green',
    reaction_already_pressed: 'Reaction already pressed for this round',
    rematch_request_invalid_state: 'Rematch is only available after a finished match',
    rematch_response_invalid_state: 'Rematch response is only available after a finished match',
    chat_room_not_ready: 'Room is not ready for chat',
    chat_empty: 'Chat message cannot be empty',
    chat_rate_limited: 'Chat rate limit exceeded',
    emoji_room_not_ready: 'Room is not ready for emoji',
    emoji_invalid_payload: 'Emoji payload is invalid',
    emoji_rate_limited: 'Emoji rate limit exceeded',
};

export function getInvalidGameStateMessage(reason: InvalidGameStateReason): string {
    return INVALID_GAME_STATE_MESSAGES[reason];
}