import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PlayerSlot } from '@rps/shared';
import type { ChatEntry } from '../hooks/useGameState';

interface Props { messages: ChatEntry[]; mySlot: PlayerSlot; onSend: (text: string) => void; }

export default function Chat({ messages, mySlot, onSend }: Props) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="mt-3 bg-gray-50 rounded-2xl p-4">
      <div className="h-40 overflow-y-auto mb-3 space-y-2">
        {messages.length === 0 && <div className="text-xs text-gray-300 text-center pt-12">還沒有訊息</div>}
        {messages.map((msg, i) => {
          const isMe = msg.from === mySlot;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: isMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-sm ${isMe ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>{msg.text}</div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} maxLength={100} placeholder="說點什麼..."
          className="flex-1 px-3 py-2 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
        <button onClick={handleSend} disabled={!text.trim()} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-30">送出</button>
      </div>
    </div>
  );
}