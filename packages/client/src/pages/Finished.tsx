import { motion } from '../lib/motion-lite';
import type { ClientMessage } from '@rps/shared';
import type { GameAction, GameState } from '../hooks/useGameState';
import { useI18n } from '../i18n';

interface Props {
  state: GameState;
  send: (msg: ClientMessage) => void;
  dispatch: React.Dispatch<GameAction>;
  connected: boolean;
}

export default function Finished({ state, send, dispatch, connected }: Props) {
  const { t } = useI18n();
  const iWon = (state.winner === 'a' && state.mySlot === 'a') || (state.winner === 'b' && state.mySlot === 'b');

  const requestRematch = () => {
    send({ type: 'rematch_request' });
  };

  const rematchHint =
    state.rematchRequestedByMe && state.rematchRequestedByOpponent
      ? t('finished.rematchBoth')
      : state.rematchRequestedByMe
        ? t('finished.rematchMe')
        : state.rematchRequestedByOpponent
          ? t('finished.rematchOpp')
          : null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center">
      <div className="text-6xl mb-4">{iWon ? '🏆' : '😢'}</div>
      <h1 className="text-headline-lg text-on-surface mb-2">{iWon ? t('finished.win') : t('finished.lose')}</h1>
      <p className="text-on-surface-variant mb-8">
        {t('finished.finalScore')} <span className="font-mono font-bold text-on-surface">{state.score[state.mySlot!]} : {state.score[state.mySlot === 'a' ? 'b' : 'a']}</span>
      </p>

      {rematchHint && <p className="text-label-md text-on-surface-variant mb-4">{rematchHint}</p>}

      <div className="flex gap-3 justify-center">
        <button
          onClick={requestRematch}
          disabled={!connected || state.rematchRequestedByMe}
          className="px-8 py-3 bg-primary text-on-primary font-medium hover:bg-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {state.rematchRequestedByMe ? t('finished.rematchSent') : t('finished.rematch')}
        </button>
        <button
          onClick={() => dispatch({ type: 'BACK_TO_TOOL_SELECT' })}
          className="px-6 py-3 border border-primary text-on-surface font-medium hover:bg-surface-alt transition-colors"
        >
          {t('common.backToTools')}
        </button>
      </div>
    </motion.div>
  );
}