// ===== Message Types =====

export type Choice = 'rock' | 'paper' | 'scissors';
export type CoinFace = 'heads' | 'tails';

export interface WheelOption {
  id: string;
  label: string;
  color: string;
  imageUrl?: string;
}

export type DrawMode = 'pick' | 'shuffle';

export type ToolId = 'rps' | 'coin' | 'dice' | 'wheel' | 'draw' | 'reaction';
export type ReactionPhase = 'idle' | 'countdown' | 'green' | 'result';
export type ReactionMode = 'f1' | 'target';

export type RoundResult = 'a_wins' | 'b_wins' | 'draw';

export type PlayerSlot = 'a' | 'b';

export type ErrorCode =
  | 'invalid_json'
  | 'invalid_message_type'
  | 'invalid_game_state'
  | 'not_authenticated'
  | 'room_not_found'
  | 'room_full'
  | 'room_no_longer_exists'
  | 'reconnect_auth_failed'
  | 'opponent_disconnected';

export type InvalidGameStateReason =
  | 'rate_limit_exceeded'
  | 'room_not_ready'
  | 'game_already_finished'
  | 'choice_tool_mismatch'
  | 'choice_invalid_value'
  | 'coin_tool_mismatch'
  | 'dice_tool_mismatch'
  | 'dice_count_out_of_range'
  | 'dice_sides_out_of_range'
  | 'wheel_tool_mismatch'
  | 'wheel_requires_two_options'
  | 'draw_tool_mismatch'
  | 'draw_requires_name'
  | 'reaction_ready_tool_mismatch'
  | 'reaction_ready_locked'
  | 'reaction_press_tool_mismatch'
  | 'reaction_round_ended'
  | 'reaction_not_green'
  | 'reaction_already_pressed'
  | 'rematch_request_invalid_state'
  | 'rematch_response_invalid_state'
  | 'chat_room_not_ready'
  | 'chat_empty'
  | 'chat_rate_limited'
  | 'emoji_room_not_ready'
  | 'emoji_invalid_payload'
  | 'emoji_rate_limited';

// ===== Client -> Server Messages =====

export interface CreateRoomMsg {
  type: 'create_room';
  bestOf: number;
  tool: ToolId;
}

export interface JoinRoomMsg {
  type: 'join_room';
  roomId: string;
}

export interface ChoiceMsg {
  type: 'choice';
  choice: Choice;
  cheat?: boolean;
}

export interface ChatMsg {
  type: 'chat';
  text: string;
}

export interface EmojiMsg {
  type: 'emoji';
  emoji: string;
}

export interface ReconnectMsg {
  type: 'reconnect';
  roomId: string;
  reconnectToken: string;
}

export interface RematchRequestMsg {
  type: 'rematch_request';
}

export interface RematchResponseMsg {
  type: 'rematch_response';
  accept: boolean;
}

export interface CoinFlipMsg {
  type: 'coin_flip';
}

export interface DiceRollMsg {
  type: 'dice_roll';
  count: number;
  sides: number;
}

export interface WheelSpinMsg {
  type: 'wheel_spin';
  options: WheelOption[];
}

export interface DrawRunMsg {
  type: 'draw_run';
  names: string[];
  mode: DrawMode;
  noRepeat?: boolean;
}

export interface ReactionReadyMsg {
  type: 'reaction_ready';
  ready: boolean;
  mode?: ReactionMode;
}

export interface ReactionPressMsg {
  type: 'reaction_press';
}

export type ClientMessage =
  | CreateRoomMsg
  | JoinRoomMsg
  | ChoiceMsg
  | ChatMsg
  | EmojiMsg
  | ReconnectMsg
  | RematchRequestMsg
  | RematchResponseMsg
  | CoinFlipMsg
  | DiceRollMsg
  | WheelSpinMsg
  | DrawRunMsg
  | ReactionReadyMsg
  | ReactionPressMsg;

// ===== Server -> Client Messages =====

export interface RoomCreatedMsg {
  type: 'room_created';
  roomId: string;
  bestOf: number;
  tool: ToolId;
  reconnectToken: string;
}

export interface JoinedMsg {
  type: 'joined';
  roomId: string;
  bestOf: number;
  tool: ToolId;
  reconnectToken: string;
}

export interface GameStartMsg {
  type: 'game_start';
  you: PlayerSlot;
  bestOf: number;
  tool: ToolId;
}

export interface ReconnectOkMsg {
  type: 'reconnect_ok';
  roomId: string;
  bestOf: number;
  tool: ToolId;
  you: PlayerSlot;
  phase: 'waiting' | 'playing' | 'finished';
  score: { a: number; b: number };
  round: number;
  winner: PlayerSlot | null;
  opponentReady: boolean;
  myChoiceSubmitted: boolean;
  reconnectToken: string;
}

export interface OpponentReadyMsg {
  type: 'opponent_ready';
}

export interface RoundResultMsg {
  type: 'round_result';
  choices: { a: Choice; b: Choice };
  result: RoundResult;
  score: { a: number; b: number };
  round: number;
}

export interface GameOverMsg {
  type: 'game_over';
  winner: PlayerSlot;
  finalScore: { a: number; b: number };
}

export interface ChatBroadcastMsg {
  type: 'chat_broadcast';
  from: PlayerSlot;
  text: string;
  timestamp: number;
}

export interface EmojiBroadcastMsg {
  type: 'emoji_broadcast';
  from: PlayerSlot;
  emoji: string;
}

export interface OpponentLeftMsg {
  type: 'opponent_left';
}

export interface RematchRequestedMsg {
  type: 'rematch_requested';
  from: PlayerSlot;
}

export interface RematchStatusMsg {
  type: 'rematch_status';
  requestedBy: PlayerSlot[];
}

export interface RematchStartedMsg {
  type: 'rematch_started';
  bestOf: number;
}

export interface CoinResultMsg {
  type: 'coin_result';
  result: CoinFace;
  by: PlayerSlot;
  round: number;
  timestamp: number;
}

export interface DiceResultMsg {
  type: 'dice_result';
  values: number[];
  total: number;
  count: number;
  sides: number;
  by: PlayerSlot;
  round: number;
  timestamp: number;
}

export interface DiceDuelResultMsg {
  type: 'dice_duel_result';
  a: { values: number[]; total: number; count: number; sides: number };
  b: { values: number[]; total: number; count: number; sides: number };
  winner: PlayerSlot | 'draw';
  round: number;
  timestamp: number;
}

export interface WheelResultMsg {
  type: 'wheel_result';
  options: WheelOption[];
  selectedIndex: number;
  by: PlayerSlot;
  round: number;
  timestamp: number;
}

export interface DrawResultMsg {
  type: 'draw_result';
  mode: DrawMode;
  noRepeat: boolean;
  sourceNames: string[];
  orderedNames: string[];
  pickedName: string | null;
  remainingNames: string[];
  by: PlayerSlot;
  round: number;
  timestamp: number;
}

export interface ReactionStateMsg {
  type: 'reaction_state';
  phase: ReactionPhase;
  mode: ReactionMode;
  targetCentis: number | null;
  readyBy: PlayerSlot[];
  pressedBy?: PlayerSlot[];
  countdownMs: number | null;
  greenAt: number | null;
  by: PlayerSlot | 'system';
  round: number;
  timestamp: number;
}

export interface ReactionResultMsg {
  type: 'reaction_result';
  mode: ReactionMode;
  targetCentis: number | null;
  deltaCentis: { a: number | null; b: number | null };
  winner: PlayerSlot | 'draw';
  falseStartBy: PlayerSlot | null;
  reactionMs: { a: number | null; b: number | null };
  by: PlayerSlot | 'system';
  round: number;
  timestamp: number;
}

export interface ErrorMsg {
  type: 'error';
  code: ErrorCode;
  message: string;
  reason?: InvalidGameStateReason;
}

export type ServerMessage =
  | RoomCreatedMsg
  | JoinedMsg
  | GameStartMsg
  | ReconnectOkMsg
  | OpponentReadyMsg
  | RoundResultMsg
  | GameOverMsg
  | ChatBroadcastMsg
  | EmojiBroadcastMsg
  | OpponentLeftMsg
  | RematchRequestedMsg
  | RematchStatusMsg
  | RematchStartedMsg
  | CoinResultMsg
  | DiceResultMsg
  | DiceDuelResultMsg
  | WheelResultMsg
  | DrawResultMsg
  | ReactionStateMsg
  | ReactionResultMsg
  | ErrorMsg;

// ===== Constants =====

export const VALID_CHOICES: Choice[] = ['rock', 'paper', 'scissors'];

export const BEATS: Record<Choice, Choice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export const QUICK_EMOJIS = ['👊', '🎉', '😤', '🤣', '👏', '💀'] as const;

export const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;