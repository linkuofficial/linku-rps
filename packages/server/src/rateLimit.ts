export function isRateLimited(timestamps: number[], maxPerSecond = 3): boolean {
    const now = Date.now();
    const recent = timestamps.filter((t) => now - t < 1000);
    timestamps.length = 0;
    timestamps.push(...recent);
    return recent.length >= maxPerSecond;
}
