import { describe, expect, it } from 'vitest';
import en from './en';
import zh from './zh';
import ja from './ja';
import fr from './fr';
import es from './es';
import ar from './ar';
import ru from './ru';

const LOCALES = {
    en,
    zh,
    ja,
    fr,
    es,
    ar,
    ru,
} as const;

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function extractPlaceholders(text: string): string[] {
    return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]).sort();
}

describe('locale integrity', () => {
    const baseKeys = Object.keys(LOCALES.en).sort();

    it('has identical key sets for all locales', () => {
        for (const [locale, dict] of Object.entries(LOCALES)) {
            const keys = Object.keys(dict).sort();
            expect(keys, `${locale} keys should match en`).toEqual(baseKeys);
        }
    });

    it('keeps placeholder signatures aligned with en', () => {
        for (const key of baseKeys) {
            const base = extractPlaceholders(LOCALES.en[key]);
            for (const [locale, dict] of Object.entries(LOCALES)) {
                if (locale === 'en') continue;
                expect(
                    extractPlaceholders(dict[key]),
                    `${locale}:${key} placeholder signature should match en`,
                ).toEqual(base);
            }
        }
    });
});
