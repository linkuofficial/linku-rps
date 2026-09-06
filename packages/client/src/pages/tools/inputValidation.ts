import { DRAW_MAX_NAMES, DRAW_MAX_NAME_LENGTH, sanitizeNames } from '@rps/shared';

export function validIntegerInput(value: string, min: number, max: number): boolean {
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
}

export function inspectDrawInput(text: string) {
    const lines = text.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    const tooMany = lines.length > DRAW_MAX_NAMES;
    const tooLong = lines.some((name) => name.length > DRAW_MAX_NAME_LENGTH);
    const names = sanitizeNames(lines);
    return { names, tooMany, tooLong, valid: names.length > 0 && !tooMany && !tooLong };
}
