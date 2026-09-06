import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from '../../lib/motion-lite';
import { motion } from '../../lib/motion-lite';
import ToolSocial from './ToolSocial';
import Icon from '../../components/Icon';
import { useI18n } from '../../i18n';
import { sanitizeWheelOptions, WHEEL_MAX_OPTIONS, WHEEL_MAX_LABEL_LENGTH, WHEEL_MAX_IMAGE_URL_LENGTH, type WheelOption } from '@rps/shared';
import type { GameToolProps } from './types';

const WHEEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function GameWheel({ state, send, exportCsv, sendEmoji, sendChat, showChat, setShowChat }: GameToolProps) {
    const { t } = useI18n();

    const defaultWheelLabels = useMemo(
        () => [t('sample.optionA'), t('sample.optionB'), t('sample.optionC'), t('sample.optionD')],
        [t],
    );

    const [wheelOptions, setWheelOptions] = useState<WheelOption[]>([
        { id: '1', label: defaultWheelLabels[0], color: WHEEL_COLORS[0] },
        { id: '2', label: defaultWheelLabels[1], color: WHEEL_COLORS[1] },
        { id: '3', label: defaultWheelLabels[2], color: WHEEL_COLORS[2] },
        { id: '4', label: defaultWheelLabels[3], color: WHEEL_COLORS[3] },
    ]);
    const [wheelHiddenMode, setWheelHiddenMode] = useState(false);
    const [wheelRevealed, setWheelRevealed] = useState(false);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [wheelDiscRotation, setWheelDiscRotation] = useState(0);
    const [wheelDiscDurationMs, setWheelDiscDurationMs] = useState(780);
    const [wheelSpinPulseKey, setWheelSpinPulseKey] = useState(0);
    const [wheelSpinInFlight, setWheelSpinInFlight] = useState(false);
    const [isEditingWheel, setIsEditingWheel] = useState(false);
    const [wheelImageInputsOpen, setWheelImageInputsOpen] = useState<Record<string, boolean>>({});

    const editorRef = useRef<HTMLDialogElement>(null);
    const hiddenModeRef = useRef(wheelHiddenMode);
    hiddenModeRef.current = wheelHiddenMode;
    const wheelResultTimestampRef = useRef<number | null>(null);
    const wheelSpinFallbackTimerRef = useRef<number | null>(null);
    const defaultWheelLabelsRef = useRef(defaultWheelLabels);

    const spinWheel = () => {
        send({ type: 'wheel_spin', options: sanitizeWheelOptions(wheelOptions) });
    };

    const handleWheelSpin = () => {
        const validOptions = wheelOptions.filter((opt) => opt.label.trim());
        if (validOptions.length < 2 || wheelSpinInFlight) return;
        setWheelRevealed(false);
        if (wheelSpinFallbackTimerRef.current) window.clearTimeout(wheelSpinFallbackTimerRef.current);
        setWheelSpinInFlight(true);
        setWheelDiscDurationMs(1400);
        setWheelDiscRotation((prev) => prev + 1080 + Math.random() * 360);
        setWheelSpinPulseKey((c) => c + 1);
        spinWheel();
        wheelSpinFallbackTimerRef.current = window.setTimeout(() => setWheelSpinInFlight(false), 2500);
    };

    const updateWheelOption = (id: string, patch: Partial<WheelOption>) => {
        setWheelOptions((current) => current.map((opt) => (opt.id === id ? { ...opt, ...patch } : opt)));
    };

    const addWheelOption = () => {
        setWheelOptions((current) => {
            if (current.length >= WHEEL_MAX_OPTIONS) return current;
            const nextIndex = current.length;
            return [
                ...current,
                {
                    id: String(Date.now() + nextIndex),
                    label: `${t('wheel.optionPlaceholder')} ${nextIndex + 1}`,
                    color: WHEEL_COLORS[nextIndex % WHEEL_COLORS.length],
                },
            ];
        });
    };

    const removeWheelOption = (id: string) => {
        setWheelOptions((current) => {
            if (current.length <= 2) return current;
            return current.filter((opt) => opt.id !== id);
        });
    };

    const shuffleWheelOptions = () => {
        setWheelOptions((current) => {
            const out = [...current];
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [out[i], out[j]] = [out[j], out[i]];
            }
            return out;
        });
    };

    const toggleWheelImageInput = (id: string) => {
        setWheelImageInputsOpen((current) => ({ ...current, [id]: !current[id] }));
    };

    // Sync wheel to result timestamp
    useEffect(() => {
        const ts = state.wheelResult?.timestamp ?? null;
        if (!ts || ts === wheelResultTimestampRef.current) return;
        if (wheelSpinFallbackTimerRef.current) {
            window.clearTimeout(wheelSpinFallbackTimerRef.current);
            wheelSpinFallbackTimerRef.current = null;
        }
        wheelResultTimestampRef.current = ts;
        setWheelRevealed(!hiddenModeRef.current);
        setWheelSpinInFlight(true);
        setWheelSpinPulseKey((c) => c + 1);
        const result = state.wheelResult;
        if (result && result.options.length > 0) {
            const segmentAngle = 360 / result.options.length;
            const targetAngle = 360 - (result.selectedIndex * segmentAngle + segmentAngle / 2);
            setWheelDiscDurationMs(820);
            setWheelDiscRotation((prev) => {
                const normalized = ((prev % 360) + 360) % 360;
                const delta = (targetAngle - normalized + 360) % 360;
                return prev + 720 + delta;
            });
        }
        wheelSpinFallbackTimerRef.current = window.setTimeout(() => {
            setWheelRevealed(true);
            setWheelSpinInFlight(false);
            wheelSpinFallbackTimerRef.current = null;
        }, 850);
    }, [state.wheelResult]);

    // Cleanup wheel fallback timer on unmount
    useEffect(() => {
        return () => {
            if (wheelSpinFallbackTimerRef.current) window.clearTimeout(wheelSpinFallbackTimerRef.current);
        };
    }, []);

    // Vibration on result
    useEffect(() => {
        if (!vibrationEnabled) return;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && state.wheelResult?.timestamp) {
            navigator.vibrate?.([40, 60, 120]);
        }
    }, [state.wheelResult?.timestamp, vibrationEnabled]);

    // Native modal semantics provide focus containment, Escape and focus restoration.
    useEffect(() => {
        if (isEditingWheel && !editorRef.current?.open) editorRef.current?.showModal();
        if (!isEditingWheel && editorRef.current?.open) editorRef.current?.close();
    }, [isEditingWheel]);

    // Prevent body scroll when editor is open
    useEffect(() => {
        if (!isEditingWheel) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isEditingWheel]);

    // Cleanup stale image input state for removed options
    useEffect(() => {
        setWheelImageInputsOpen((current) => {
            const validIds = new Set(wheelOptions.map((opt) => opt.id));
            let changed = false;
            const next: Record<string, boolean> = {};
            for (const [id, isOpen] of Object.entries(current)) {
                if (!validIds.has(id)) { changed = true; continue; }
                next[id] = isOpen;
            }
            return changed ? next : current;
        });
    }, [wheelOptions]);

    // Update labels on locale change
    useEffect(() => {
        const previous = defaultWheelLabelsRef.current;
        setWheelOptions((current) => {
            if (current.length !== previous.length) return current;
            const unchangedTemplate = current.every((opt, idx) => opt.label === previous[idx]);
            if (!unchangedTemplate) return current;
            return current.map((opt, idx) => ({ ...opt, label: defaultWheelLabels[idx] ?? opt.label }));
        });
        defaultWheelLabelsRef.current = defaultWheelLabels;
    }, [defaultWheelLabels]);

    const selected = state.wheelResult?.options[state.wheelResult.selectedIndex];
    const showLabel = !wheelHiddenMode || wheelRevealed;
    const hasEnoughWheelOptions = wheelOptions.filter((opt) => opt.label.trim()).length >= 2;
    const currentVisualOptions = sanitizeWheelOptions(wheelOptions);
    const resultMatchesCurrentOptions = state.wheelResult?.options.length === currentVisualOptions.length
        && state.wheelResult.options.every((option, index) => {
            const current = currentVisualOptions[index];
            return current
                && option.id === current.id
                && option.label === current.label
                && option.color === current.color
                && option.imageUrl === current.imageUrl;
        });
    const wheelVisualOptions = resultMatchesCurrentOptions ? state.wheelResult!.options : currentVisualOptions;
    const wheelGradient = wheelVisualOptions.length
        ? `conic-gradient(${wheelVisualOptions
            .map((opt, index) => {
                const start = (index / wheelVisualOptions.length) * 100;
                const end = ((index + 1) / wheelVisualOptions.length) * 100;
                return `${opt.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
            })
            .join(', ')})`
        : 'conic-gradient(#d9d9d9 0% 100%)';

    const closeWheelEditor = () => setIsEditingWheel(false);

    return (
        <>
            <div
                role="status" aria-live="polite" aria-atomic="true"
                key={`wheel-result-${state.wheelResult?.timestamp ?? 'idle'}`}
                className={`tool-result-panel mb-4 border border-border p-5 text-center ${state.wheelResult ? 'tool-result-panel--reveal' : ''}`}
            >
                <div className="text-label-sm text-on-surface-variant mb-1">{t('wheel.round', { round: Math.max(1, state.round - 1) })}</div>
                <motion.div
                    key={`${state.wheelResult?.timestamp ?? 0}-${showLabel ? 'reveal' : 'hidden'}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-headline-md text-on-surface ${state.wheelResult ? 'result-text-flip' : ''}`}
                >
                    {showLabel ? (selected?.label ?? t('wheel.notYet')) : t('wheel.hidden')}
                </motion.div>
            </div>

            <div className="wheel-stage mb-6 flex justify-center">
                <div className={`wheel-visual ${wheelSpinInFlight ? 'wheel-visual--spinning' : ''}`} aria-hidden="true">
                    <div
                        className="wheel-visual-disc"
                        style={{
                            backgroundImage: wheelGradient,
                            transform: `rotate(${wheelDiscRotation}deg)`,
                            transitionDuration: `${wheelDiscDurationMs}ms`,
                        }}
                    />
                    <div className="wheel-visual-core">
                        <div className="wheel-visual-core-label">{wheelVisualOptions.length}</div>
                    </div>
                    <div className="wheel-visual-pointer" />
                </div>
            </div>

            <ol className="wheel-legend mb-4 grid grid-cols-2 gap-2 text-label-sm" aria-label={t('wheel.options')}>
                {wheelVisualOptions.map((option) => <li key={option.id} className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: option.color }} />
                    <span className="break-words">{option.label}</span>
                </li>)}
            </ol>

            <button
                onClick={() => setIsEditingWheel(true)} disabled={wheelSpinInFlight}
                className="tool-config-action mb-4 w-full border border-primary bg-surface-container-lowest px-4 py-3 text-label-md font-medium text-on-surface transition-colors hover:bg-surface-alt"
            >
                {'\u2699\uFE0F '}{t('wheel.editOptions')}
            </button>

            <button
                onClick={handleWheelSpin}
                disabled={!hasEnoughWheelOptions || wheelSpinInFlight}
                className="tool-primary-action mb-4 w-full bg-primary px-4 py-5 text-lg font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <span key={wheelSpinPulseKey} className="wheel-spin-label">
                    {t('wheel.spin')}
                </span>
            </button>

            <button
                onClick={exportCsv}
                disabled={!state.history.length}
                className="tool-export mb-4 w-full text-center text-label-sm text-on-surface-variant underline-offset-2 transition-colors hover:text-on-surface hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {t('common.exportCsv')}
            </button>

            <ToolSocial {...{ state, sendEmoji, sendChat, showChat, setShowChat }} />

            {/* Wheel editor modal */}
            <dialog
                ref={editorRef}
                aria-labelledby="wheel-edit-title"
                onCancel={closeWheelEditor}
                onClose={closeWheelEditor}
                onClick={(event) => { if (event.target === event.currentTarget) closeWheelEditor(); }}
                className="wheel-editor-dialog m-auto w-[calc(100%-2rem)] max-w-2xl bg-surface-container-lowest p-0 text-on-surface"
            >
                        <motion.div
                            initial={{ opacity: 0, y: 16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 w-full max-w-2xl border border-border bg-surface-container-lowest shadow-[0_16px_56px_rgba(0,0,0,0.22)]"
                        >
                            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                                <div>
                                    <div id="wheel-edit-title" className="text-label-md font-semibold text-on-surface">
                                        {t('wheel.editTitle')}
                                    </div>
                                    <div className="text-label-sm text-on-surface-variant">{t('wheel.options')}</div>
                                </div>
                                <button
                                    onClick={closeWheelEditor}
                                    aria-label={t('wheel.closeEditor')}
                                    className="h-9 w-9 border border-border text-xl leading-none text-on-surface-variant transition-colors hover:border-on-surface hover:text-on-surface"
                                >
                                    {'\u00D7'}
                                </button>
                            </div>

                            <div className="max-h-[72vh] overflow-y-auto px-4 py-4">
                                <div className="space-y-2">
                                    {wheelOptions.map((opt) => {
                                        const imageInputOpen = !!wheelImageInputsOpen[opt.id];
                                        return (
                                            <div key={opt.id} className="border border-border bg-surface-alt/40 p-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="color" aria-label={`${t('wheel.color')}: ${opt.label}`}
                                                        value={opt.color}
                                                        onChange={(e) => updateWheelOption(opt.id, { color: e.target.value })}
                                                        className="h-9 w-11 shrink-0 border border-border bg-transparent"
                                                    />
                                                    <input
                                                        type="text" aria-label={t('wheel.optionPlaceholder')} maxLength={WHEEL_MAX_LABEL_LENGTH}
                                                        value={opt.label}
                                                        onChange={(e) => updateWheelOption(opt.id, { label: e.target.value })}
                                                        className="min-w-0 flex-1 border border-border bg-surface-container-lowest px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-on-surface transition-colors"
                                                        placeholder={t('wheel.optionPlaceholder')}
                                                    />
                                                    <button
                                                        onClick={() => toggleWheelImageInput(opt.id)}
                                                        aria-label={imageInputOpen ? t('wheel.hideImageField') : t('wheel.showImageField')}
                                                        className={`h-9 w-9 shrink-0 border transition-colors ${imageInputOpen ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface-container-lowest text-on-surface-variant hover:border-on-surface hover:text-on-surface'}`}
                                                    >
                                                        <Icon name="image" className="mx-auto text-[18px]" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeWheelOption(opt.id)}
                                                        disabled={wheelOptions.length <= 2}
                                                        aria-label={t('wheel.delete')}
                                                        className="h-9 w-9 shrink-0 border border-border bg-surface-container-lowest text-on-surface-variant transition-colors hover:border-on-surface hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-30"
                                                    >
                                                        <Icon name="delete" className="mx-auto text-[18px]" />
                                                    </button>
                                                </div>

                                                <AnimatePresence>
                                                    {imageInputOpen && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -4 }}
                                                            className="pt-2"
                                                        >
                                                            <input
                                                                type="url" aria-label={t('wheel.imagePlaceholder')} maxLength={WHEEL_MAX_IMAGE_URL_LENGTH}
                                                                value={opt.imageUrl ?? ''}
                                                                onChange={(e) => updateWheelOption(opt.id, { imageUrl: e.target.value })}
                                                                className="w-full border border-border bg-surface-container-lowest px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-on-surface transition-colors"
                                                                placeholder={t('wheel.imagePlaceholder')}
                                                            />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>

                                <p role="status" className="mt-3 text-label-sm text-on-surface-variant">{t('wheel.inputHint', { n: wheelOptions.length, max: WHEEL_MAX_OPTIONS })}</p>
                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button onClick={addWheelOption} disabled={wheelOptions.length >= WHEEL_MAX_OPTIONS} className="w-full border border-primary py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-alt">
                                        {t('wheel.addOption')}
                                    </button>
                                    <button onClick={shuffleWheelOptions} className="w-full border border-primary py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-alt">
                                        {t('wheel.shuffle')}
                                    </button>
                                </div>

                                <div className="mt-5 border-t border-border pt-4">
                                    <div className="mb-2 text-label-sm font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                                        {t('wheel.advanced')}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-label-sm text-on-surface">
                                            <input
                                                type="checkbox"
                                                checked={wheelHiddenMode}
                                                onChange={(e) => {
                                                    setWheelHiddenMode(e.target.checked);
                                                    setWheelRevealed(true);
                                                }}
                                            />
                                            {t('wheel.hiddenMode')}
                                        </label>
                                        <label className="flex items-center gap-2 text-label-sm text-on-surface">
                                            <input
                                                type="checkbox"
                                                checked={vibrationEnabled}
                                                onChange={(e) => setVibrationEnabled(e.target.checked)}
                                            />
                                            {t('wheel.vibrate')}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
            </dialog>
        </>
    );
}
