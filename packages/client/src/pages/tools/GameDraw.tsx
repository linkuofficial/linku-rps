import { useEffect, useMemo, useRef, useState } from 'react';
import EmojiBar from '../../components/EmojiBar';
import { useI18n } from '../../i18n';
import type { GameToolProps } from './types';

export default function GameDraw({ state, send, exportCsv, sendEmoji }: GameToolProps) {
    const { t, whoLabel } = useI18n();

    const defaultDrawNames = useMemo(
        () => [t('sample.person1'), t('sample.person2'), t('sample.person3'), t('sample.person4')].join('\n'),
        [t],
    );

    const [drawNamesText, setDrawNamesText] = useState(defaultDrawNames);
    const [drawMode, setDrawMode] = useState<'pick' | 'shuffle'>('pick');
    const [drawNoRepeat, setDrawNoRepeat] = useState(false);
    const defaultSamplesRef = useRef({ draw: defaultDrawNames });

    useEffect(() => {
        const previous = defaultSamplesRef.current;
        setDrawNamesText((current) => (current === previous.draw ? defaultDrawNames : current));
        defaultSamplesRef.current = { draw: defaultDrawNames };
    }, [defaultDrawNames]);

    const runDraw = () => {
        const names = drawNamesText.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
        if (!names.length) return;
        send({ type: 'draw_run', names, mode: drawMode, noRepeat: drawMode === 'pick' ? drawNoRepeat : false });
    };

    const byMe = state.drawResult?.by === state.mySlot;

    return (
        <>
            <div className="tool-result-panel mb-4 border border-border p-5 text-center">
                <div className="text-label-sm text-on-surface-variant mb-1">{t('draw.result')}</div>
                <div className="text-headline-md text-on-surface">
                    {state.drawResult?.pickedName ?? (state.drawResult ? t('draw.shuffledDone') : t('draw.notYet'))}
                </div>
                {state.drawResult && (
                    <div className="text-label-sm text-on-surface-variant mt-2">
                        {t('draw.by', {
                            who: whoLabel(byMe ? 'me' : 'opp'),
                            mode: state.drawResult.mode === 'pick' ? t('draw.modePick') : t('draw.modeShuffle'),
                        })}
                    </div>
                )}
            </div>

            <div className="border border-border bg-surface-container-lowest p-4 mb-4">
                <label className="text-label-sm text-on-surface font-medium">{t('draw.names')}</label>
                <textarea
                    value={drawNamesText}
                    onChange={(e) => setDrawNamesText(e.target.value)}
                    rows={6}
                    className="mt-2 w-full border border-border bg-surface-container-lowest text-on-surface px-3 py-2 text-sm focus:outline-none focus:border-on-surface transition-colors"
                />
                <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
                    <button
                        onClick={() => setDrawMode('pick')}
                        className={`py-2 text-sm font-medium transition-colors ${drawMode === 'pick' ? 'bg-primary text-on-primary' : 'bg-surface-alt text-on-surface hover:bg-surface-container-high'}`}
                    >
                        {t('draw.modePick')}
                    </button>
                    <button
                        onClick={() => setDrawMode('shuffle')}
                        className={`py-2 text-sm font-medium transition-colors ${drawMode === 'shuffle' ? 'bg-primary text-on-primary' : 'bg-surface-alt text-on-surface hover:bg-surface-container-high'}`}
                    >
                        {t('draw.modeShuffle')}
                    </button>
                </div>
                <label className="mb-3 flex items-center gap-2 text-label-sm text-on-surface">
                    <input
                        type="checkbox"
                        checked={drawNoRepeat}
                        disabled={drawMode !== 'pick'}
                        onChange={(e) => setDrawNoRepeat(e.target.checked)}
                    />
                    {t('draw.noRepeat')}
                </label>
                <button onClick={runDraw} className="w-full py-3 bg-primary text-on-primary font-medium hover:bg-primary-container transition-colors">
                    {t('draw.run')}
                </button>
            </div>

            {state.drawResult && (
                <div className="border border-border bg-surface-container-lowest p-4 mb-4">
                    <div className="mb-2 flex items-center justify-between text-label-md font-semibold text-on-surface">
                        <span>{t('draw.ordered')}</span>
                        {state.drawResult.mode === 'pick' && state.drawResult.noRepeat && (
                            <span className="bg-surface-alt px-2 py-1 text-label-sm text-on-surface-variant">
                                {t('draw.remaining', { n: state.drawResult.remainingNames.length })}
                            </span>
                        )}
                    </div>
                    <div className="max-h-36 overflow-auto text-sm text-on-surface space-y-1">
                        {state.drawResult.orderedNames.map((name, idx) => (
                            <div key={`${name}-${idx}`} className="flex items-center justify-between bg-surface-alt px-2 py-1">
                                <span>{name}</span>
                                <span className="text-label-sm text-on-surface-variant">#{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={exportCsv}
                disabled={!state.roomId}
                className="w-full py-2 border border-primary text-on-surface text-sm font-medium hover:bg-surface-alt transition-colors mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {t('common.exportCsv')}
            </button>

            <EmojiBar onEmoji={sendEmoji} />
        </>
    );
}
