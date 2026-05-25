import { spawn } from 'node:child_process';

const port = 3901;
const baseUrl = `http://127.0.0.1:${port}`;

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJson(path, timeoutMs = 15000) {
    const started = Date.now();
    let lastError = null;

    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(`${baseUrl}${path}`);
            if (res.ok) {
                return await res.json();
            }
            lastError = new Error(`HTTP ${res.status} for ${path}`);
        } catch (err) {
            lastError = err;
        }
        await wait(300);
    }

    throw new Error(`Timeout waiting for ${path}: ${lastError ? String(lastError) : 'unknown error'}`);
}

const startCommand = process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', 'pnpm --filter @rps/server start']]
    : ['pnpm', ['--filter', '@rps/server', 'start']];

const child = spawn(startCommand[0], startCommand[1], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
});

let startupLogs = '';
child.stdout.on('data', (buf) => {
    startupLogs += buf.toString();
});
child.stderr.on('data', (buf) => {
    startupLogs += buf.toString();
});

try {
    const health = await waitForJson('/health');
    if (!health || health.ok !== true || typeof health.rooms !== 'number') {
        throw new Error(`Unexpected /health payload: ${JSON.stringify(health)}`);
    }

    const metrics = await waitForJson('/metrics');
    if (!metrics || metrics.ok !== true) {
        throw new Error(`Unexpected /metrics payload: ${JSON.stringify(metrics)}`);
    }

    const requiredKeys = [
        'uptimeSec',
        'wsActiveConnections',
        'roomsTotal',
        'roomsActive',
        'errorsPerMinute',
        'counters',
    ];

    for (const key of requiredKeys) {
        if (!(key in metrics)) {
            throw new Error(`Missing /metrics key: ${key}`);
        }
    }

    console.log('Smoke test passed for /health and /metrics');
} catch (err) {
    console.error('Smoke test failed');
    console.error(String(err));
    console.error(startupLogs);
    process.exitCode = 1;
} finally {
    child.kill('SIGTERM');
    await wait(250);
}
