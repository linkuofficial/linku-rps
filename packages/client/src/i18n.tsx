import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToolId, Choice } from '@rps/shared';
import type { Dict, Locale } from './locales/types';

type DictCache = Partial<Record<Locale, Dict>>;

const STORAGE_KEY = 'linku-lang';
const SUPPORTED: Locale[] = ['en', 'zh', 'ja', 'fr', 'es', 'ar', 'ru'];

const DICT_CACHE: DictCache = {};

const LOCALE_LOADERS: Record<Locale, () => Promise<{ default: Dict }>> = {
    en: () => import('./locales/en'),
    zh: () => import('./locales/zh'),
    ja: () => import('./locales/ja'),
    fr: () => import('./locales/fr'),
    es: () => import('./locales/es'),
    ar: () => import('./locales/ar'),
    ru: () => import('./locales/ru'),
};

function normalizeLocale(value: string | null | undefined): Locale {
    if (!value) return 'en';
    const lower = value.toLowerCase();
    if (lower === 'zh-tw' || lower.startsWith('zh')) return 'zh';
    if (lower === 'ja-jp' || lower.startsWith('ja')) return 'ja';
    if (lower === 'fr-fr' || lower.startsWith('fr')) return 'fr';
    if (lower === 'es-es' || lower.startsWith('es')) return 'es';
    if (lower === 'ar-sa' || lower.startsWith('ar')) return 'ar';
    if (lower === 'ru-ru' || lower.startsWith('ru')) return 'ru';
    return SUPPORTED.includes(lower as Locale) ? (lower as Locale) : 'en';
}

function pickInitialLocale(): Locale {
    const savedRaw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (savedRaw) return normalizeLocale(savedRaw);

    const browserLocales = typeof navigator !== 'undefined' ? navigator.languages : [];
    if (browserLocales.length > 0) return normalizeLocale(browserLocales[0]);

    const language = typeof navigator !== 'undefined' ? navigator.language : null;
    return normalizeLocale(language);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
        const value = params[key];
        return value === undefined ? `{${key}}` : String(value);
    });
}

async function loadDict(locale: Locale): Promise<Dict> {
    if (DICT_CACHE[locale]) return DICT_CACHE[locale] as Dict;
    const module = await LOCALE_LOADERS[locale]();
    DICT_CACHE[locale] = module.default;
    return module.default;
}

interface I18nValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    toolName: (tool: ToolId) => string;
    toolSubtitle: (tool: ToolId) => string;
    choiceLabel: (choice: Choice) => string;
    whoLabel: (who: 'me' | 'opp') => string;
    translateError: (errorCode: string | null, fallbackMessage?: string | null) => string | null;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(() => pickInitialLocale());
    const [dicts, setDicts] = useState<DictCache>({});

    useEffect(() => {
        let cancelled = false;

        const targets: Locale[] = locale === 'en' ? ['en'] : ['en', locale];
        const missing = targets.filter((target) => !dicts[target]);
        if (missing.length === 0) return;

        (async () => {
            const loaded = await Promise.all(
                missing.map(async (target) => {
                    const dict = await loadDict(target);
                    return [target, dict] as const;
                })
            );

            if (cancelled) return;
            setDicts((prev) => {
                const next = { ...prev };
                for (const [target, dict] of loaded) {
                    next[target] = dict;
                }
                return next;
            });
        })();

        return () => {
            cancelled = true;
        };
    }, [dicts, locale]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const nextDir = locale === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = locale;
        document.documentElement.dir = nextDir;
        document.documentElement.dataset.locale = locale;
        document.body.dir = nextDir;
        document.body.dataset.locale = locale;

        // Dynamically load CJK/Arabic fonts only when needed
        const fontMap: Partial<Record<Locale, string>> = {
            zh: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap',
            ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap',
            ar: 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap',
        };
        const fontUrl = fontMap[locale];
        if (fontUrl) {
            const id = `font-${locale}`;
            if (!document.getElementById(id)) {
                const link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = fontUrl;
                document.head.appendChild(link);
            }
        }
    }, [locale]);

    const setLocale = (next: Locale) => {
        const normalized = normalizeLocale(next);
        setLocaleState(normalized);
        localStorage.setItem(STORAGE_KEY, normalized);
    };

    const value = useMemo<I18nValue>(() => {
        const t = (key: string, params?: Record<string, string | number>) => {
            const enDict = dicts.en;
            const activeDict = dicts[locale];
            const fallback = enDict?.[key] ?? key;
            return interpolate(activeDict?.[key] ?? fallback, params);
        };

        const toolName = (tool: ToolId) => t(`tool.name.${tool}`);
        const toolSubtitle = (tool: ToolId) => t(`tool.subtitle.${tool}`);
        const choiceLabel = (choice: Choice) => t(`choice.${choice}`);
        const whoLabel = (who: 'me' | 'opp') => t(`who.${who}`);

        const translateError = (errorCode: string | null, fallbackMessage: string | null = null) => {
            if (!errorCode) return fallbackMessage;
            const key = `error.${errorCode}`;
            const localeDict = dicts[locale];
            return localeDict?.[key] ?? dicts.en?.[key] ?? fallbackMessage;
        };

        return { locale, setLocale, t, toolName, toolSubtitle, choiceLabel, whoLabel, translateError };
    }, [dicts, locale]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (!context) throw new Error('useI18n must be used inside I18nProvider');
    return context;
}
