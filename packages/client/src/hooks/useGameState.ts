import { useReducer, useCallback } from 'react';
import type { Choice, PlayerSlot, ServerMessage } from '@rps/shared';

export type GamePhase = 'lobby' | 'waiting' | 'playing' | 'finished';

export interface ChatEntry {
  from: PlayerSlot;
  text: string;
  timestamp: number;
}

export interface EmojiFloat {
  id: number;
  emoji: string;
  from: PlayerSlot;
}

export interface GameState {
  phase: GamePhase;
  roomId: string | null;
  mySlot: PlayerSlot | null;
  bestOf: number;
  round: number;
  score: { a: number; b: number };
  myChoice: Choice | null;
  opponentReady: boolean;
  lastResult: { choices: { a: Choice; b: Choice }; result: 'a_wins' | 'b_wins' | 'draw' } | null;
  winner: PlayerSlot | null;
  chat: ChatEntry[];
  emojis: EmojiFloat[];
  error: string | null;
}

type Action =
  | { type: 'ROOM_CREATED'; roomId: string; bestOf: number }
  | { type: 'JOINED'; roomId: string; bestOf: number }
  | { type: 'GAME_START'; you: PlayerSlot; bestOf: number }
  | { type: 'OPPONENT_READY' }
  | { type: 'CHOICE_MADE'; choice: Choice }
  | { type: 'ROUND_RESULT'; choices: { a: Choice; b: Choice }; result: 'a_wins' | 'b_wins' | 'draw'; score: { a: number; b: number }; round: number }
  | { type: 'GAME_OVER'; winner: PlayerSlot }
  | { type: 'CHAT'; entry: ChatEntry }
  | { type: 'EMOJI'; float: EmojiFloat }
  | { type: 'REMOVE_EMOJI'; id: number }
  | { type: 'OPPONENT_LEFT' }
  | { type: 'ERROR'; message: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'NEXT_ROUND' };

const initialState: GameState = {
  phase: 'lobby', roomId: null, mySlot: null, bestOf: 3, round: 1,
  score: { a: 0, b: 0 }, myChoice: null, opponentReady: false,
  lastResult: null, winner: null, chat: [], emojis: [], error: null,
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'ROOM_CREATED':
      return { ...state, phase: 'waiting', roomId: action.roomId, bestOf: action.bestOf, error: null };
    case 'JOINED':
      return { ...state, roomId: action.roomId, bestOf: action.bestOf, error: null };
    case 'GAME_START':
      return { ...state, phase: 'playing', mySlot: action.you, bestOf: action.bestOf };
    case 'OPPONENT_READY':
      return { ...state, opponentReady: true };
    case 'CHOICE_MADE':
      return { ...state, myChoice: action.choice, opponentReady: false };
    case 'ROUND_RESULT':
      return { ...state, lastResult: { choices: action.choices, result: action.result }, score: action.score, round: action.round + 1, myChoice: null, opponentReady: false };
    case 'GAME_OVER':
      return { ...state, phase: 'finished', winner: action.winner };
    case 'CHAT':
      return { ...state, chat: [...state.chat.slice(-49), action.entry] };
    case 'EMOJI':
      return { ...state, emojis: [...state.emojis, action.float] };
    case 'REMOVE_EMOJI':
      return { ...state, emojis: state.emojis.filter((e) => e.id !== action.id) };
    case 'OPPONENT_LEFT':
      return { ...state, error: '對手離開了', phase: 'lobby' };
    case 'ERROR':
      return { ...state, error: action.message };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'NEXT_ROUND':
      return { ...state, lastResult: null };
    default:
      return state;
  }
}

let emojiIdCounter = 0;

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'room_created':
        dispatch({ type: 'ROOM_CREATED', roomId: msg.roomId, bestOf: msg.bestOf }); break;
      case 'joined':
        dispatch({ type: 'JOINED', roomId: msg.roomId, bestOf: msg.bestOf }); break;
      case 'game_start':
        dispatch({ type: 'GAME_START', you: msg.you, bestOf: msg.bestOf }); break;
      case 'opponent_ready':
        dispatch({ type: 'OPPONENT_READY' }); break;
      case 'round_result':
        dispatch({ type: 'ROUND_RESULT', choices: msg.choices, result: msg.result, score: msg.score, round: msg.round }); break;
      case 'game_over':
        dispatch({ type: 'GAME_OVER', winner: msg.winner }); break;
      case 'chat_broadcast':
        dispatch({ type: 'CHAT', entry: { from: msg.from, text: msg.text, timestamp: msg.timestamp } }); break;
      case 'emoji_broadcast': {
        const id = ++emojiIdCounter;
        dispatch({ type: 'EMOJI', float: { id, emoji: msg.emoji, from: msg.from } });
        setTimeout(() => dispatch({ type: 'REMOVE_EMOJI', id }), 2000);
        break;
      }
      case 'opponent_left':
        dispatch({ type: 'OPPONENT_LEFT' }); break;
      case 'error':
        dispatch({ type: 'ERROR', message: msg.message }); break;
    }
  }, []);

  return { state, dispatch, handleMessage };
}