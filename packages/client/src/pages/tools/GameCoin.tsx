import ToolSocial from './ToolSocial';
import { useI18n } from '../../i18n';
import type { GameToolProps } from './types';

export default function GameCoin({ state, send, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t, whoLabel } = useI18n();

    const coinLabel = state.coinResult?.result === 'heads'
        ? t('coin.heads')
        : state.coinResult?.result === 'tails'
            ? t('coin.tails')
            : t('coin.notYet');
    const flips = state.history.filter((entry) => entry.event === 'coin_flip');
    const heads = flips.filter((entry) => entry.result === 'heads').length;
    const flippedByMe = state.coinResult?.by === state.mySlot;

    return (
        <>
            <div
                role="status" aria-live="polite" aria-atomic="true"
                key={`coin-result-${state.coinResult?.timestamp ?? 'idle'}`}
                className={`tool-result-panel mb-4 border border-border p-5 text-center ${state.coinResult ? 'tool-result-panel--reveal' : ''}`}
            >
                <div className="text-label-sm text-on-surface-variant mb-1">{t('coin.resultRound', { round: Math.max(1, state.round - 1) })}</div>
                <div aria-hidden="true" className={`text-6xl mb-2 ${state.coinResult ? 'result-emoji-pop' : ''}`}>
                    {state.coinResult?.result === 'heads' ? '\uD83E\uDE99' : state.coinResult?.result === 'tails' ? '\uD83C\uDF11' : '\u2753'}
                </div>
                <div className="text-headline-md text-on-surface">{coinLabel}</div>
                {state.coinResult && (
                    <div className="text-label-sm text-on-surface-variant mt-2">
                        {t('coin.by', { who: whoLabel(flippedByMe ? 'me' : 'opp') })}
                    </div>
                )}
            </div>

            <button
                onClick={() => send({ type: 'coin_flip' })}
                className="tool-primary-action w-full py-3 bg-primary text-on-primary font-medium hover:bg-primary-container transition-colors mb-4"
            >
                {t('coin.flip')}
            </button>

            <button
                onClick={exportCsv}
                disabled={!state.history.length}
                className="tool-export w-full py-2 border border-primary text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {t('common.exportCsv')}
            </button>

            {flips.length > 0 && (
                <section className="tool-history mb-4 border border-border bg-surface-container-lowest p-4" aria-label={t('coin.history')}>
                    <h2 className="text-label-md font-semibold">{t('coin.history')}</h2>
                    <p className="mt-2 text-sm tabular-nums">{t('coin.heads')}: {heads} · {t('coin.tails')}: {flips.length - heads}</p>
                    <ol className="mt-3 flex flex-wrap gap-2" reversed>
                        {flips.slice(-10).reverse().map((entry, index) => (
                            <li key={index} className="border border-border bg-surface-alt px-2 py-1 text-label-sm">
                                #{entry.round} {t(entry.result === 'heads' ? 'coin.heads' : 'coin.tails')}
                            </li>
                        ))}
                    </ol>
                </section>
            )}
            <ToolSocial {...{ state, sendEmoji, sendChat, showChat, setShowChat }} />
        </>
    );
}
