import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClientMessage, Choice } from '@rps/shared';
import type { GameState } from '../hooks/useGameState';
import ScoreBoard from '../components/ScoreBoard';
import ChoiceButton from '../components/ChoiceButton';
import Arena from '../components/Arena';
import Chat from '../components/Chat';
import EmojiBar from '../components/EmojiBar';
import EmojiFloats from '../components/EmojiFloats';

interface Props {
  state: GameState;
  send: (msg: ClientMessage) => void;
  dispatch: React.Dispatch<any>;
}

const CHOICES: { choice: Choice; emoji: string; label: string }[] = [
  { choice: 'rock', emoji: '✊', label: '石頭' },
  { choice: 'paper', emoji: '✋', label: '布' },
  { choice: 'scissors', emoji: '✌️', label: '剪刀' },
];

export default function Game({ state, send, dispatch }: Props) {
  const [showChat, setShowChat] = useState(false);

  const choose = (choice: Choice) => {
    if (state.myChoice) return;
    dispatch({ type: 'CHOICE_MADE', choice });
    send({ type: 'choice', choice });
  };

  const sendChat = (text: string) => { send({ type: 'chat', text }); };
  const sendEmoji = (emoji: string) => { send({ type: 'emoji', emoji }); };

  const iWon = state.lastResult && ((state.lastResult.result === 'a_wins' && state.mySlot === 'a') || (state.lastResult.result === 'b_wins' && state.mySlot === 'b'));
  const isDraw = state.lastResult?.result === 'draw';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
      <EmojiFloats emojis={state.emojis} mySlot={state.mySlot!} />
      <ScoreBoard score={state.score} mySlot={state.mySlot!} bestOf={state.bestOf} round={state.round} />
      <Arena myChoice={state.myChoice} lastResult={state.lastResult} mySlot={state.mySlot!} opponentReady={state.opponentReady} />

      <AnimatePresence>
        {state.lastResult && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className={`text-center py-3 rounded-xl mb-4 font-semibold text-lg ${iWon ? 'bg-emerald-50 text-emerald-600' : isDraw ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
            {iWon ? '🏆 你贏了！' : isDraw ? '🤝 平手' : '💀 你輸了'}
          </motion.div>
        )}
      </AnimatePresence>

      {!state.lastResult && (
        <div className="text-center text-sm text-gray-400 mb-4">
          {state.myChoice ? (state.opponentReady ? '雙方出拳中...' : '等待對手出拳...') : (state.opponentReady ? '對手已出拳，輪到你了！' : '選擇你的出拳')}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        {CHOICES.map(({ choice, emoji, label }) => (
          <ChoiceButton key={choice} choice={choice} emoji={emoji} label={label} selected={state.myChoice === choice} disabled={!!state.myChoice} onChoose={choose} />
        ))}
      </div>

      <EmojiBar onEmoji={sendEmoji} />

      <button onClick={() => setShowChat(!showChat)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2">
        {showChat ? '收起聊天' : `💬 聊天 ${state.chat.length > 0 ? `(${state.chat.length})` : ''}`}
      </button>

      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}