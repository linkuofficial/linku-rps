import type { Dispatch } from 'react';
import type { ClientMessage } from '@rps/shared';
import type { GameAction, GameState } from '../../hooks/useGameState';

export interface GameToolProps {
    state: GameState;
    send: (msg: ClientMessage) => void;
    dispatch: Dispatch<GameAction>;
    exportCsv: () => void;
    sendEmoji: (emoji: string) => void;
    sendChat: (text: string) => void;
    showChat: boolean;
    setShowChat: (v: boolean) => void;
}
