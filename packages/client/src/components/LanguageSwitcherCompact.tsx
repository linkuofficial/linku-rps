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

    const nextLocaleClass =
        locale === 'zh' ? 'font-locale-zh' : locale === 'ja' ? 'font-locale-ja' : locale === 'ar' ? 'font-locale-ar' : locale === 'ru' ? 'font-locale-cyrillic' : 'font-locale-latin';

    return (
        <label className={`inline-flex items-center border border-border bg-surface-container-lowest px-2 py-2 text-label-sm text-on-surface ${nextLocaleClass}`}>
            <span className="sr-only">Language</span>
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
        </label>
    );
}
