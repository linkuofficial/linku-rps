import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Locale } from '../locales/types';
import Icon from './Icon';

interface Props {
    compact?: boolean;
}

const LANGUAGE_LABELS: Record<Locale, string> = {
    en: 'English',
    zh: '中文',
    ja: '日本語',
    fr: 'Français',
    es: 'Español',
    ar: 'العربية',
    ru: 'Русский',
};

const LANGUAGE_FONT_CLASS: Record<Locale, string> = {
    en: 'font-locale-latin',
    zh: 'font-locale-zh',
    ja: 'font-locale-ja',
    fr: 'font-locale-latin',
    es: 'font-locale-latin',
    ar: 'font-locale-ar',
    ru: 'font-locale-cyrillic',
};

export default function LanguageSwitcher({ compact = false }: Props) {
    const { locale, setLocale } = useI18n();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!compact || !open) return;

        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            const target = event.target as Node;
            if (!rootRef.current.contains(target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [compact, open]);

    if (compact) {
        return (
            <div ref={rootRef} className="relative">
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 border border-border bg-surface-container-lowest px-3 py-2 text-label-sm text-on-surface transition-colors hover:bg-surface-alt"
                    aria-haspopup="menu"
                    aria-expanded={open}
                >
                    <Icon name="language" className="text-[18px]" />
                    <span>{LANGUAGE_LABELS[locale]}</span>
                </button>

                {open && (
                    <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 w-[min(92vw,320px)] rounded-sm border border-border bg-surface-container-lowest p-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)]" role="menu">
                        <div className="grid grid-cols-2 gap-1">
                            {(['en', 'zh', 'ja', 'fr', 'es', 'ar', 'ru'] as const).map((code) => (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => {
                                        setLocale(code);
                                        setOpen(false);
                                    }}
                                    className={`flex items-center justify-between rounded-sm border px-2 py-2 text-label-sm transition-colors ${LANGUAGE_FONT_CLASS[code]} ${locale === code
                                        ? 'border-primary bg-primary text-on-primary'
                                        : 'border-border bg-surface-container-lowest text-on-surface-variant hover:bg-surface-alt'
                                        }`}
                                    aria-pressed={locale === code}
                                    role="menuitemradio"
                                >
                                    <span className="whitespace-nowrap">{LANGUAGE_LABELS[code]}</span>
                                    <Icon
                                        name="check"
                                        className={`text-[16px] ${locale === code ? 'opacity-100' : 'opacity-0'}`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1 bg-surface-container-lowest p-1">
            {(['en', 'zh', 'ja', 'fr', 'es', 'ar', 'ru'] as const).map((code) => (
                <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    className={`min-w-0 px-2 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${LANGUAGE_FONT_CLASS[code]} ${locale === code
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-alt'
                        }`}
                    aria-pressed={locale === code}
                >
                    {LANGUAGE_LABELS[code]}
                </button>
            ))}
        </div>
    );
}
