import Chat from '../../components/Chat';
import EmojiBar from '../../components/EmojiBar';
import { useI18n } from '../../i18n';
import type { GameToolProps } from './types';

export default function ToolSocial({ state, sendEmoji, sendChat, showChat, setShowChat }: Pick<GameToolProps, 'state' | 'sendEmoji' | 'sendChat' | 'showChat' | 'setShowChat'>) {
    const { t } = useI18n();
    if (!state.roomId) return null;
    return (
        <div className="tool-social">
            <EmojiBar onEmoji={sendEmoji} />
            <button
                type="button"
                aria-expanded={showChat}
                aria-controls="tool-chat"
                onClick={() => setShowChat(!showChat)}
                className="mt-2 min-h-11 w-full py-2 text-label-sm text-on-surface-variant hover:text-on-surface hover:underline"
            >
                {showChat ? t('common.hideChat') : `${t('common.chat')}${state.chat.length ? ` (${state.chat.length})` : ''}`}
            </button>
            {showChat && <div id="tool-chat"><Chat messages={state.chat} mySlot={state.mySlot!} onSend={sendChat} /></div>}
        </div>
    );
}
