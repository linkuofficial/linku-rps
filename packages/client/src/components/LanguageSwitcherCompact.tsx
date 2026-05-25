import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { Locale } from '../locales/types';

const LANGUAGE_LABELS: Record<Locale, string> = {
    en: 'English',
    zh: '中文',
    ja: '日本語',
    fr: 'Français',
    es: 'Español',
    ar: 'العربية',
    ru: 'Русский',
};

const LOCALES = ['en', 'zh', 'ja', 'fr', 'es', 'ar', 'ru'] as const;

export default function LanguageSwitcherCompact() {
    const { locale, setLocale } = useI18n();
    const currentLabel = useMemo(() => LANGUAGE_LABELS[locale], [locale]);

    const nextLocaleClass =
        locale === 'zh' ? 'font-locale-zh' : locale === 'ja' ? 'font-locale-ja' : locale === 'ar' ? 'font-locale-ar' : locale === 'ru' ? 'font-locale-cyrillic' : 'font-locale-latin';

    return (
        <label className={`inline-flex items-center gap-2 border border-border bg-white px-2 py-2 text-label-sm text-on-surface ${nextLocaleClass}`}>
            <span className="sr-only">Language</span>
            <span aria-hidden="true" className="text-[11px] text-on-surface-variant uppercase tracking-[0.08em]">Lang</span>
            <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="bg-transparent text-label-sm text-on-surface outline-none"
                aria-label="Language"
            >
                {LOCALES.map((code) => (
                    <option key={code} value={code}>
                        {LANGUAGE_LABELS[code]}
                    </option>
                ))}
            </select>
            <span aria-hidden="true" className="text-[11px] text-on-surface-variant">{currentLabel}</span>
        </label>
    );
}
