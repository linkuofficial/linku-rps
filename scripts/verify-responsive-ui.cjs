const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.TOOL_PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve('docs/tasks/responsive-ui-evidence');
const sizes = [[320, 568], [390, 844], [768, 1024], [844, 390], [1280, 720], [1440, 900], [1920, 1080]];
async function main() {
    await fs.mkdir(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ locale: 'zh-TW' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const checks = [];
    async function geometry(label, width, height) {
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} ${width}: horizontal overflow`);
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        const outside = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll(elements => elements.filter(el => {
            // The original desktop strip intentionally retains its horizontal scrolling.
            if (el.closest('.tool-selector-strip')) return false;
            const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        }).map(el => el.outerHTML.slice(0, 180)));
        assert.deepEqual(outside, [], `${label} ${width}: controls outside viewport`);
        await page.screenshot({ path: path.join(out, `${label}-${width}x${height}.png`), fullPage: label !== 'wheel-editor', animations: 'disabled' });
        checks.push(`${label}: ${width}x${height}`);
    }
    try {
        await page.goto(base);
        await page.getByRole('button', { name: /骰子 / }).waitFor();
        for (const [width, height] of sizes) {
            await page.setViewportSize({ width, height });
            const selector = width < 900 ? '.tool-card' : '.tool-selector-strip button';
            await page.locator(selector).first().waitFor();
            const cards = await page.locator(selector).evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
            assert.equal(cards.length, 6);
            assert.equal(new Set(cards.map(card => Math.round(card.x))).size, width < 900 ? 2 : 6);
            if (width >= 900) {
                assert.equal(await page.locator('.hub-intro').count(), 0, 'desktop must not show the redesigned heading');
                assert.equal(await page.locator('.tool-selector-strip').evaluate(el => getComputedStyle(el).display), 'flex');
            }
            assert(cards.every(card => card.h >= 44 && card.w >= 44));
            await geometry('hub', width, height);
        }
        for (const name of ['骰子', '擲硬幣', '轉盤', '抽籤', 'F1 反應測試']) {
            await page.goto(base);
            await page.getByRole('button', { name: new RegExp(name + ' ') }).click();
            await page.getByRole('button', { name: '立即開始', exact: true }).click();
            await page.locator('.tool-workspace').waitFor();
            const tool = await page.locator('.tool-workspace').getAttribute('data-tool');
            if (tool === 'dice') { await page.getByRole('button', { name: '2d6', exact: true }).click(); await page.getByRole('button', { name: '擲骰子', exact: true }).click(); }
            if (tool === 'coin') await page.getByRole('button', { name: '擲硬幣', exact: true }).click();
            if (tool === 'wheel') {
                await page.getByRole('button', { name: '轉動轉盤', exact: true }).click();
                await page.waitForFunction(() => !document.querySelector('.tool-primary-action')?.disabled);
            }
            if (tool === 'draw') await page.getByRole('button', { name: '開始抽籤', exact: true }).click();
            for (const [width, height] of sizes) {
                await page.setViewportSize({ width, height });
                await geometry(tool, width, height);
                const exportButton = page.getByRole('button', { name: '匯出 CSV', exact: true });
                await exportButton.scrollIntoViewIfNeeded();
                assert(await exportButton.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }), `${tool}: export unreachable`);
            }
            if (tool === 'wheel') {
                for (const [width, height] of [[320, 568], [844, 390]]) {
                    await page.setViewportSize({ width, height });
                    await page.getByRole('button', { name: /編輯選項/ }).click();
                    assert(await page.locator('dialog').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'wheel dialog exceeds viewport height');
                    await geometry('wheel-editor', width, height);
                    await page.keyboard.press('Escape');
                }
            }
            await page.setViewportSize({ width: 390, height: 844 });
            await page.getByRole('button', { name: '啟用深色模式', exact: true }).click();
            await geometry(`${tool}-dark`, 390, 844);
            await page.getByRole('button', { name: '關閉深色模式', exact: true }).click();
        }
        await page.goto(base);
        await page.setViewportSize({ width: 320, height: 568 });
        for (const locale of ['en', 'ja', 'fr', 'es', 'ru', 'ar']) {
            await page.locator('select').selectOption(locale);
            await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
            // Wait for the lazy locale dictionary, not only the DOM lang attribute.
            await page.getByRole('heading', { name: 'TOOLBOX', exact: true }).waitFor();
            await geometry(`hub-${locale}`, 320, 568);
        }
        await page.locator('select').selectOption('zh');
        await page.getByRole('heading', { name: 'TOOLBOX', exact: true }).waitFor();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
        await geometry('hub-200pct', 1440, 900);
        await page.evaluate(() => { document.documentElement.style.zoom = ''; });
        await page.getByPlaceholder('輸入房間代碼').fill('123');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.tool-card').first().waitFor();
        assert.equal(await page.getByPlaceholder('輸入房間代碼').inputValue(), '123');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('.tool-selector-strip').waitFor();
        assert.equal(await page.getByPlaceholder('輸入房間代碼').inputValue(), '123');
        checks.push('Join-code input survives mobile/desktop breakpoint transitions');
        await page.getByRole('button', { name: '啟用深色模式', exact: true }).click();
        await page.getByRole('button', { name: /骰子 / }).click();
        await page.getByRole('button', { name: '立即開始', exact: true }).click();
        await page.getByRole('button', { name: '關閉深色模式', exact: true }).waitFor();
        assert(await page.evaluate(() => document.documentElement.classList.contains('dark')));
        await page.getByRole('button', { name: '擲骰子', exact: true }).click();
        const result = await page.locator('.dice-total').innerText();
        assert.equal(await page.locator('.tool-workspace').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
        assert((await page.locator('.tool-game').boundingBox()).width <= 960);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.locator('.dice-total').innerText(), result);
        await page.setViewportSize({ width: 1440, height: 900 });
        assert.equal(await page.locator('.dice-total').innerText(), result);
        checks.push('Desktop two-column dice workspace and results survive viewport resizing');
        await page.getByRole('button', { name: '返回工具列表', exact: true }).click();
        await page.getByRole('button', { name: '關閉深色模式', exact: true }).waitFor();
        checks.push('Theme stays synchronized across hub, tool and return navigation');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ checks, pageErrors: errors, checkedAt: new Date().toISOString() }, null, 2) + '\n');
        console.log(JSON.stringify({ checks: checks.length, pageErrors: errors }));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
