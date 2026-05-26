import { useState, useRef, useEffect } from 'react';
import { motion } from '../lib/motion-lite';
import type { PlayerSlot } from '@rps/shared';
import type { ChatEntry } from '../hooks/useGameState';
import { useI18n } from '../i18n';

interface Props { messages: ChatEntry[]; mySlot: PlayerSlot; onSend: (text: string) => void; }

export default function Chat({ messages, mySlot, onSend }: Props) {
  const { t } = useI18n();
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
    <div className="mt-3 bg-surface-alt border border-border p-4">
      <div className="h-40 overflow-y-auto mb-3 space-y-2">
        {messages.length === 0 && <div className="text-label-sm text-on-surface-variant text-center pt-12">{t('common.noMessages')}</div>}
        {messages.map((msg, i) => {
          const isMe = msg.from === mySlot;
          return (
            <motion.div key={i} initial={{ opacity: 0, x: isMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-1.5 text-sm ${isMe ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface border border-border'}`}>{msg.text}</div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} maxLength={100} placeholder={t('common.chatPlaceholder')}
          className="flex-1 px-3 py-2 bg-surface-container-lowest border border-border text-on-surface text-sm focus:outline-none focus:border-on-surface transition-colors" />
        <button onClick={handleSend} disabled={!text.trim()} className="px-4 py-2 bg-primary text-on-primary text-sm font-medium hover:bg-primary-container transition-colors disabled:opacity-30">{t('common.send')}</button>
      </div>
    </div>
  );
}