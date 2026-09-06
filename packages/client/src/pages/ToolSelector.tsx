import { useEffect, useRef, useState } from 'react';
import { motion } from '../lib/motion-lite';
import { Link } from 'wouter';
import type { ToolId } from '@rps/shared';
import { ROOM_CODE_LENGTH } from '@rps/shared';
import { useCompactLayout } from '../hooks/useCompactLayout';
import { useI18n } from '../i18n';
import LanguageSwitcherCompact from '../components/LanguageSwitcherCompact';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';

interface Props {
    onSelect: (tool: ToolId) => void;
    connected: boolean;
    isDark: boolean;
    onToggleDark: () => void;
    onJoinByCode?: (code: string) => void;
    pendingJoinCode?: string | null;
    onPendingJoinTimeout?: () => void;
    error?: { code: string; message: string } | null;
    onClearError?: () => void;
}

interface ToolCard {
    id: ToolId;
    enabled: boolean;
}

interface ToolMeta extends ToolCard {
    icon: IconName;
}

const TOOLS: ToolMeta[] = [
    { id: 'rps', enabled: true, icon: 'back_hand' },
    { id: 'coin', enabled: true, icon: 'monetization_on' },
    { id: 'wheel', enabled: true, icon: 'radio_button_checked' },
    { id: 'dice', enabled: true, icon: 'casino' },
    { id: 'draw', enabled: true, icon: 'inventory_2' },
    { id: 'reaction', enabled: true, icon: 'touch_app' },
];

export default function ToolSelector({ onSelect, connected, isDark, onToggleDark, onJoinByCode, pendingJoinCode, onPendingJoinTimeout, error, onClearError }: Props) {
    const isCompact = useCompactLayout();
    const { t, locale, translateError } = useI18n();
    const isRtl = locale === 'ar';
    const currentYear = new Date().getFullYear();
    const copyrightYears = currentYear > 2025 ? `2025-${currentYear}` : '2025';
    const [clock, setClock] = useState(() => formatClock(locale));
    const [joinCode, setJoinCode] = useState('');
    const [loadingTool, setLoadingTool] = useState<ToolId | null>(null);
    const [joinTimeoutMessage, setJoinTimeoutMessage] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setClock(formatClock(locale));
        const timer = window.setInterval(() => setClock(formatClock(locale)), 1000);
        return () => window.clearInterval(timer);
    }, [locale]);

    // Reset loading state if the connection drops or an error arrives.
    useEffect(() => { if (!connected) setLoadingTool(null); }, [connected]);
    useEffect(() => { if (error) setLoadingTool(null); }, [error]);

    useEffect(() => {
        if (!pendingJoinCode) {
            setJoinTimeoutMessage(null);
            return;
        }
        const timer = window.setTimeout(() => {
            onPendingJoinTimeout?.();
            setJoinTimeoutMessage(translateError('connection_timeout', 'Connection timed out. Please try again.') ?? 'Connection timed out. Please try again.');
        }, 12000);
        return () => window.clearTimeout(timer);
    }, [pendingJoinCode, onPendingJoinTimeout, translateError]);

    const handleJoin = () => {
        const code = joinCode.trim().toUpperCase();
        if (!connected || code.length !== ROOM_CODE_LENGTH || pendingJoinCode) return;
        setJoinTimeoutMessage(null);
        onJoinByCode?.(code);
    };

    const handleToolClick = (tool: ToolId) => {
        // Selecting a tool only navigates to the Lobby — it needs no live connection,
        // so we must NOT gate it on `connected`. Gating here swallowed the first click
        // while the WebSocket was still connecting (user had to click twice). The Lobby
        // shows its own connection banner and disables create/join until connected.
        if (!tool || loadingTool || pendingJoinCode) return;
        onSelect(tool);
    };

    const displayNames: Record<ToolId, string> = {
        rps: t('tool.name.rps'),
        coin: t('tool.name.coin'),
        wheel: t('tool.name.wheel'),
        dice: t('tool.name.dice'),
        draw: t('tool.name.draw'),
        reaction: t('tool.name.reaction'),
    };

    if (!isCompact) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-10 flex flex-col overflow-y-auto bg-surface"
        >
            <main className="tool-selector-main mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-8 md:px-8 lg:px-10 lg:py-10">
                <div className="tool-selector-content">
                    <header className="tool-selector-header text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="text-display-clock text-primary">{clock}</div>
                            <div className={`text-label-sm text-secondary/70 ${isRtl ? 'tracking-[0.08em]' : 'uppercase tracking-[0.4em]'}`}>{t('toolSelector.standardTime')}</div>
                        </div>
                    </header>

                    <div
                        dir={isRtl ? 'rtl' : 'ltr'}
                        className={`tool-selector-strip scrollbar-none flex w-full gap-3 overflow-x-auto pb-2 sm:gap-4 ${isRtl ? 'flex-row-reverse' : ''}`}
                    >
                        {(isRtl ? [...TOOLS].reverse() : TOOLS).map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => tool.enabled && handleToolClick(tool.id)}
                                disabled={!tool.enabled || !!loadingTool || !!pendingJoinCode}
                                aria-busy={loadingTool === tool.id}
                                aria-label={`${displayNames[tool.id]} ${t('common.startNow')}`}
                                className={`group flex aspect-square min-h-[136px] min-w-[136px] flex-shrink-0 flex-col items-center justify-center border p-4 text-center transition-colors sm:min-h-[160px] sm:min-w-[160px] sm:p-5 lg:min-h-[176px] lg:min-w-[176px] xl:min-h-[188px] xl:min-w-[188px] ${isRtl ? 'rtl' : ''} ${tool.enabled
                                    ? loadingTool === tool.id
                                        ? 'border-on-surface bg-surface-container-lowest cursor-wait'
                                        : loadingTool
                                            ? 'border-border bg-surface-alt opacity-40 cursor-not-allowed'
                                            : 'border-border bg-surface-container-lowest hover:border-on-surface'
                                    : 'border-border bg-surface-alt text-on-surface-variant cursor-not-allowed'
                                    }`}
                            >
                                {loadingTool === tool.id
                                    ? <span className="mb-3 block w-[30px] h-[30px] sm:w-[36px] sm:h-[36px] lg:w-[42px] lg:h-[42px] border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                    : <Icon name={tool.icon} className="mb-3 text-[30px] text-primary transition-transform duration-300 group-hover:scale-105 sm:mb-4 sm:text-[36px] lg:text-[42px]" />
                                }
                                <span className="text-center text-[16px] font-semibold leading-tight tracking-[-0.02em] text-primary sm:text-[19px] lg:text-[21px]">{displayNames[tool.id]}</span>
                                {!tool.enabled && <span className="mt-3 text-label-sm uppercase tracking-[0.2em] text-on-surface-variant">{t('toolSelector.comingSoon')}</span>}
                            </button>
                        ))}
                    </div>

                    {!connected && (
                        <div className="mt-4 text-center text-label-sm text-on-surface-variant">
                            {t('lobby.offlineSoloHint')}
                        </div>
                    )}

                    {/* Join by code — skip tool selection for joiners */}
                    {onJoinByCode && (
                        <div className="mt-6 w-full max-w-sm mx-auto">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">{t('common.or')}</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-3 text-center cursor-pointer"
                                    onClick={() => { onClearError?.(); inputRef.current?.focus(); }}
                                >
                                    {translateError(error.code, error.message)}
                                </motion.div>
                            )}

                            {!error && joinTimeoutMessage && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-3 text-center"
                                >
                                    <p>{joinTimeoutMessage}</p>
                                    <button
                                        onClick={() => { setJoinTimeoutMessage(null); inputRef.current?.focus(); }}
                                        className="mt-2 px-3 py-1 border border-primary text-on-surface hover:bg-surface transition-colors"
                                    >
                                        {t('app.reconnectNow')}
                                    </button>
                                </motion.div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={ROOM_CODE_LENGTH}
                                    placeholder={t('lobby.joinCodePlaceholder')}
                                    value={joinCode}
                                    dir="ltr"
                                    disabled={!!pendingJoinCode}
                                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                    className="flex-1 min-w-0 px-4 py-3 bg-surface-container-lowest border border-border text-on-surface text-center text-lg font-mono tracking-[0.3em] uppercase placeholder:text-on-surface-variant placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-on-surface transition-colors disabled:opacity-50"
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={!connected || joinCode.trim().length !== ROOM_CODE_LENGTH || !!pendingJoinCode}
                                    className="shrink-0 px-5 py-3 bg-surface-container-lowest border border-primary text-on-surface font-medium hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {pendingJoinCode
                                        ? <><span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />{t('toolSelector.joining')}</>
                                        : t('common.join')
                                    }
                                </button>
                            </div>
                            {joinCode.length > 0 && joinCode.length !== ROOM_CODE_LENGTH && (
                                <p className="mt-2 text-label-sm text-on-surface-variant text-center">{t('lobby.joinCodeLength', { n: ROOM_CODE_LENGTH })}</p>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer className="border-t border-outline-variant bg-surface-container-lowest">
                <div className={`mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 md:py-2 lg:px-10 ${isRtl ? 'md:text-right' : 'md:text-left'}`}>
                    <div className="flex flex-col items-center gap-3 text-center md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4 md:text-left">
                        <div className="text-label-sm text-secondary md:justify-self-start">
                            © {copyrightYears} Linku Toolbox
                        </div>
                        <div className="flex items-center gap-3 text-label-sm text-primary md:justify-self-center">
                            <Link href="/privacy" className="underline-offset-2 hover:underline">
                                {t('common.privacyPolicy')}
                            </Link>
                            <span aria-hidden="true" className="text-secondary">|</span>
                            <Link href="/copyright" className="underline-offset-2 hover:underline">
                                {t('common.copyrightNotice')}
                            </Link>
                        </div>
                        <div className={`w-full md:w-auto md:max-w-[320px] flex items-center gap-2 ${isRtl ? 'md:justify-self-start' : 'md:justify-self-end'}`}>
                            <DarkModeToggle isDark={isDark} toggle={onToggleDark} />
                            <LanguageSwitcherCompact />
                        </div>
                    </div>
                </div>
            </footer>
        </motion.div>
    );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="tool-hub"
        >
            <header className="site-header">
                <div className="site-header-inner">
                    <span className="site-brand">LINKU<span className="brand-divider" aria-hidden="true">/</span><span>TOOLBOX</span></span>
                    <div className="site-preferences"><DarkModeToggle isDark={isDark} toggle={onToggleDark} /><LanguageSwitcherCompact /></div>
                </div>
            </header>
            <main className="tool-selector-main">
                <div className="tool-selector-content">
                    <header className="hub-intro">
                        <div>
                            <h1>TOOLBOX</h1>
                            <p>{t('ui.subtitle')}</p>
                        </div>
                        <div className="hub-clock">
                            <time className="text-display-clock" dir="ltr">{clock}</time>
                            <span>{t('toolSelector.standardTime')}</span>
                        </div>
                    </header>
                    <div dir={isRtl ? 'rtl' : 'ltr'} className="tool-grid">
                        {TOOLS.map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => tool.enabled && handleToolClick(tool.id)}
                                disabled={!tool.enabled || !!loadingTool || !!pendingJoinCode}
                                aria-busy={loadingTool === tool.id}
                                aria-label={displayNames[tool.id] + ' ' + t('common.startNow')}
                                className="tool-card"
                            >
                                <span className="tool-card-top"><Icon name={tool.icon} className="tool-card-icon" /></span>
                                <span className="tool-card-bottom"><span>{displayNames[tool.id]}</span></span>
                                {!tool.enabled && <span className="text-label-sm">{t('toolSelector.comingSoon')}</span>}
                            </button>
                        ))}
                    </div>

                    {!connected && (
                        <div className="hub-availability">
                            {t('lobby.offlineSoloHint')}
                        </div>
                    )}

                    {/* Join by code — skip tool selection for joiners */}
                    {onJoinByCode && (
                        <section className="hub-join" aria-label={t('common.join')}>
                            <p className="hub-join-label">{t('ui.join')}</p>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-3 text-center cursor-pointer"
                                    onClick={() => { onClearError?.(); inputRef.current?.focus(); }}
                                >
                                    {translateError(error.code, error.message)}
                                </motion.div>
                            )}

                            {!error && joinTimeoutMessage && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="border-2 border-primary bg-surface-alt text-on-surface text-label-md px-4 py-3 mb-3 text-center"
                                >
                                    <p>{joinTimeoutMessage}</p>
                                    <button
                                        onClick={() => { setJoinTimeoutMessage(null); inputRef.current?.focus(); }}
                                        className="mt-2 px-3 py-1 border border-primary text-on-surface hover:bg-surface transition-colors"
                                    >
                                        {t('app.reconnectNow')}
                                    </button>
                                </motion.div>
                            )}

                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={ROOM_CODE_LENGTH}
                                    aria-label={t('lobby.joinCodePlaceholder')} placeholder={t('lobby.joinCodePlaceholder')}
                                    value={joinCode}
                                    dir="ltr"
                                    disabled={!!pendingJoinCode}
                                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                                    className="flex-1 min-w-0 px-4 py-3 bg-surface-container-lowest border border-border text-on-surface text-center text-lg font-mono tracking-[0.3em] uppercase placeholder:text-on-surface-variant placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-on-surface transition-colors disabled:opacity-50"
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={!connected || joinCode.trim().length !== ROOM_CODE_LENGTH || !!pendingJoinCode}
                                    className="shrink-0 px-5 py-3 bg-surface-container-lowest border border-primary text-on-surface font-medium hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {pendingJoinCode
                                        ? <><span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />{t('toolSelector.joining')}</>
                                        : t('common.join')
                                    }
                                </button>
                            </div>
                            {joinCode.length > 0 && joinCode.length !== ROOM_CODE_LENGTH && (
                                <p className="mt-2 text-label-sm text-on-surface-variant text-center">{t('lobby.joinCodeLength', { n: ROOM_CODE_LENGTH })}</p>
                            )}
                        </section>
                    )}
                </div>
            </main>

            <footer className="site-footer">
                <span>© {copyrightYears} Linku Toolbox</span>
                <nav aria-label={t('ui.about')}>
                    <Link href="/privacy">{t('common.privacyPolicy')}</Link>
                    <Link href="/copyright">{t('common.copyrightNotice')}</Link>
                </nav>
            </footer>
        </motion.div>
    );
}

function DarkModeToggle({ isDark, toggle }: { isDark: boolean; toggle: () => void }) {
    const { t } = useI18n();
    return (
        <button
            onClick={toggle}
            aria-label={isDark ? t('darkMode.disable') : t('darkMode.enable')}
            className="icon-button"
        >
            <Icon name={isDark ? 'light_mode' : 'dark_mode'} className="text-[20px]" />
        </button>
    );
}

function formatClock(locale: string) {
    const formatterLocaleMap: Record<string, string> = {
        en: 'en-GB',
        zh: 'zh-TW',
        ja: 'ja-JP',
        fr: 'fr-FR',
        es: 'es-ES',
        ar: 'ar-SA-u-nu-arab',
        ru: 'ru-RU',
    };
    const formatterLocale = formatterLocaleMap[locale] ?? 'en-GB';
    return new Date().toLocaleTimeString(formatterLocale, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
