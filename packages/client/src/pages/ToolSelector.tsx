import { useEffect, useState } from 'react';
import { motion } from '../lib/motion-lite';
import { Link } from 'wouter';
import type { ToolId } from '@rps/shared';
import { useI18n } from '../i18n';
import LanguageSwitcherCompact from '../components/LanguageSwitcherCompact';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';

interface Props {
    onSelect: (tool: ToolId) => void;
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

export default function ToolSelector({ onSelect }: Props) {
    const { t, locale } = useI18n();
    const isRtl = locale === 'ar';
    const currentYear = new Date().getFullYear();
    const copyrightYears = currentYear > 2025 ? `2025-${currentYear}` : '2025';
    const [clock, setClock] = useState(() => formatClock(locale));

    useEffect(() => {
        setClock(formatClock(locale));
        const timer = window.setInterval(() => setClock(formatClock(locale)), 1000);
        return () => window.clearInterval(timer);
    }, [locale]);

    const displayNames: Record<ToolId, string> = {
        rps: t('tool.name.rps'),
        coin: t('tool.name.coin'),
        wheel: t('tool.name.wheel'),
        dice: t('tool.name.dice'),
        draw: t('tool.name.draw'),
        reaction: t('tool.name.reaction'),
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex min-h-screen flex-col overflow-hidden bg-white"
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
                                onClick={() => tool.enabled && onSelect(tool.id)}
                                disabled={!tool.enabled}
                                className={`group flex aspect-square min-h-[136px] min-w-[136px] flex-shrink-0 flex-col items-center justify-center border p-4 text-center transition-colors sm:min-h-[160px] sm:min-w-[160px] sm:p-5 lg:min-h-[176px] lg:min-w-[176px] xl:min-h-[188px] xl:min-w-[188px] ${isRtl ? 'rtl' : ''} ${tool.enabled
                                    ? 'border-border bg-white hover:border-black'
                                    : 'border-border bg-surface-alt text-on-surface-variant cursor-not-allowed'
                                    }`}
                            >
                                <Icon name={tool.icon} className="mb-3 text-[30px] text-primary transition-transform duration-300 group-hover:scale-105 sm:mb-4 sm:text-[36px] lg:text-[42px]" />
                                <span className="text-center text-[16px] font-semibold leading-tight tracking-[-0.02em] text-primary sm:text-[19px] lg:text-[21px]">{displayNames[tool.id]}</span>
                                {!tool.enabled && <span className="mt-3 text-label-sm uppercase tracking-[0.2em] text-on-surface-variant">{t('toolSelector.comingSoon')}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            <footer className="border-t border-outline-variant bg-white">
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
                        <div className={`w-full md:w-auto md:max-w-[320px] ${isRtl ? 'md:justify-self-start' : 'md:justify-self-end'}`}>
                            <LanguageSwitcherCompact />
                        </div>
                    </div>
                </div>
            </footer>
        </motion.div>
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
