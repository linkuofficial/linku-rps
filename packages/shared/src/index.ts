// ===== Message Types =====

export type Choice = 'rock' | 'paper' | 'scissors';

export type RoundResult = 'a_wins' | 'b_wins' | 'draw';

export type PlayerSlot = 'a' | 'b';

// ===== Client -> Server Messages =====

export interface CreateRoomMsg {
  type: 'create_room';
  bestOf: number;
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

export type ClientMessage =
  | CreateRoomMsg
  | JoinRoomMsg
  | ChoiceMsg
  | ChatMsg
  | EmojiMsg;

// ===== Server -> Client Messages =====

export interface RoomCreatedMsg {
  type: 'room_created';
  roomId: string;
  bestOf: number;
}

export interface JoinedMsg {
  type: 'joined';
  roomId: string;
  bestOf: number;
}

export interface GameStartMsg {
  type: 'game_start';
  you: PlayerSlot;
  bestOf: number;
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

export interface ErrorMsg {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | RoomCreatedMsg
  | JoinedMsg
  | GameStartMsg
  | OpponentReadyMsg
  | RoundResultMsg
  | GameOverMsg
  | ChatBroadcastMsg
  | EmojiBroadcastMsg
  | OpponentLeftMsg
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