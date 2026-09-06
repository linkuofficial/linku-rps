// Run against the local Vite server. Supply PLAYWRIGHT_MODULE if Playwright is bundled externally.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.TOOL_PREVIEW_URL || 'http://127.0.0.1:5173';
const out = path.resolve('docs/tasks/tool-polish-evidence');

async function main() {
    await fs.mkdir(out, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    const checks = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', (error) => errors.push(error.message));
    const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' });
    async function start(name) {
        await page.goto(base);
        await button(new RegExp(name + ' ')).click();
        await button('立即開始').click();
        await page.locator('.tool-game').waitFor();
        assert.equal(await page.getByRole('button', { name: /^聊天/ }).count(), 0);
        assert(!page.url().includes('room='));
    }
    async function capture(name) {
        for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: page overflow at ${width}`);
            const outside = await page.locator('.tool-game button:visible, .tool-game textarea:visible').evaluateAll((elements) => elements.filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.textContent));
            assert.deepEqual(outside, [], `${name}: controls outside viewport at ${width}`);
            await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true, animations: 'disabled' });
        }
        await page.setViewportSize({ width: 390, height: 844 });
    }
    try {
        if (process.argv.includes('--rps')) {
            await page.goto(base);
            await button(/猜拳 /).click();
            await button('建立房間').click();
            const code = page.locator('[dir="ltr"]').filter({ hasText: /^\d{5}$/ });
            await code.waitFor();
            const room = await code.innerText();
            const otherContext = await browser.newContext({ locale: 'zh-TW' });
            const other = await otherContext.newPage();
            other.on('pageerror', error => errors.push(error.message));
            await other.goto(`${base}/join/${room}`);
            await other.locator('.tool-game').waitFor();
            await button('石頭').click();
            assert.equal(await button('石頭').getAttribute('aria-pressed'), 'true');
            assert(await button('布').isDisabled());
            await other.getByRole('button', { name: '剪刀', exact: true }).click();
            await page.getByText('你贏了！', { exact: true }).waitFor();
            await other.getByText('你輸了', { exact: true }).waitFor();
            await capture('rps');
            checks.push('Two actual local browser clients: join, choice lock, opposite results and responsive layout');
            await otherContext.close();
        } else {
            await start('骰子');
            await button('擲骰子').click();
            await page.waitForFunction(() => /^\d+$/.test(document.querySelector('.dice-total')?.textContent.trim()));
            await button('2d6').click();
            const count = page.getByLabel('顆數', { exact: true });
            const sides = page.getByLabel('面數', { exact: true });
            await count.fill(''); assert(await button('擲骰子').isDisabled());
            await count.fill('1.5'); assert(await button('擲骰子').isDisabled());
            await count.fill('20'); await sides.fill('1000');
            await button('擲骰子').click();
            await page.getByText('20d1000', { exact: true }).first().waitFor();
            const total = Number(await page.locator('.dice-total').innerText());
            assert(total >= 20 && total <= 20000);
            const downloadPromise = page.waitForEvent('download');
            await button('匯出 CSV').click();
            const download = await downloadPromise;
            const csv = await fs.readFile(await download.path(), 'utf8');
            assert(csv.includes('dice_roll') && csv.includes('local'));
            await capture('dice');
            checks.push('Dice: blank/fraction blocked, 20d1000 roll, local CSV download');

            await start('擲硬幣');
            for (let i = 0; i < 3; i++) await button('擲硬幣').click();
            assert.equal(await page.locator('section ol li').count(), 3);
            await capture('coin');
            checks.push('Coin: three successive flips and recent history');

            await start('抽籤');
            await page.locator('#draw-names').fill('  \n');
            assert(await button('開始抽籤').isDisabled());
            await page.locator('#draw-names').fill('x'.repeat(41));
            assert(await button('開始抽籤').isDisabled());
            await page.locator('#draw-names').fill('Alice\nBob\nAlice\n\n');
            await page.getByLabel('不重複抽籤（自動去重）').check();
            await button('開始抽籤').click();
            const first = await page.locator('.tool-result-panel .text-headline-md').innerText();
            await button('開始抽籤').click();
            const second = await page.locator('.tool-result-panel .text-headline-md').innerText();
            assert.notEqual(first, second);
            await button('全部洗牌').click(); await button('開始抽籤').click();
            assert.equal(await button('全部洗牌').getAttribute('aria-pressed'), 'true');
            await capture('draw');
            checks.push('Draw: empty/oversized input blocked, duplicate normalization, no-repeat picks, shuffle');

            await start('轉盤');
            await button(/編輯選項/).click();
            assert(await page.locator('dialog').evaluate(el => el.open));
            for (let i = 0; i < 20; i++) await button('新增選項').click();
            assert(await button('新增選項').isDisabled());
            assert.equal(await page.locator('dialog input[type="text"]').count(), 24);
            await page.keyboard.press('Tab');
            assert(await page.locator('dialog').evaluate(el => el.contains(document.activeElement)));
            await page.screenshot({ path: path.join(out, 'wheel-editor.png'), animations: 'disabled' });
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
            assert(await button(/編輯選項/).evaluate(el => el === document.activeElement));
            await button('轉動轉盤').click();
            assert(await button('轉動轉盤').isDisabled());
            await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === '轉動轉盤')?.disabled);
            assert.equal(await page.locator('ol[aria-label] li').count(), 24);
            const labels = await page.locator('ol[aria-label] li').allTextContents();
            const selected = await page.locator('.tool-result-panel .text-headline-md').innerText();
            const selectedIndex = labels.findIndex(label => label.trim() === selected);
            assert(selectedIndex >= 0);
            const rotation = await page.locator('.wheel-visual-disc').evaluate(el => Number(el.style.transform.match(/rotate\(([-.\d]+)deg\)/)[1]));
            assert(Math.abs(((rotation + (selectedIndex + 0.5) * 360 / labels.length) % 360)) < 0.001, 'wheel pointer must land at selected sector center');
            await button(/編輯選項/).click();
            await page.locator('dialog input[type="text"]').first().fill('更新選項');
            await page.keyboard.press('Escape');
            assert.equal((await page.locator('ol[aria-label] li').first().innerText()).trim(), '更新選項');
            await capture('wheel');
            checks.push('Wheel: 24 option cap, native modal focus/Escape, spin lock, result geometry, live edited preview');

            await start('F1 反應測試');
            await button('我已準備好').click();
            assert(await button(/目標時間/).isDisabled());
            await page.keyboard.press('F1');
            await button('再試一次').waitFor();
            await button('再試一次').click();
            await page.getByText('綠燈！現在按！', { exact: true }).waitFor();
            await page.keyboard.press('F1');
            await button('再試一次').waitFor();
            assert(!(await page.locator('.tool-game').innerText()).includes('對手'));
            await capture('reaction-f1');
            await button(/目標時間/).click();
            await button('我已準備好').click();
            await page.getByText('綠燈！現在按！', { exact: true }).waitFor();
            await button('按下').click();
            await button('再試一次').waitFor();
            await capture('reaction-target');
            checks.push('Reaction: false start, retry, F1 green result, locked mode, target mode, no solo opponent');
            await page.setViewportSize({ width: 320, height: 844 });
            for (const locale of ['en', 'ja', 'fr', 'es', 'ru', 'ar', 'zh']) {
                await page.locator('select').selectOption(locale);
                await page.waitForFunction(locale => document.documentElement.lang === locale, locale);
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale}: horizontal overflow`);
                if (locale === 'ar') {
                    await page.getByText('اختر وضعًا، ثم استعد للبدء.', { exact: true }).waitFor();
                    await page.screenshot({ path: path.join(out, 'reaction-arabic-320.png'), animations: 'disabled' });
                }
            }
            await button('啟用深色模式').click();
            await page.screenshot({ path: path.join(out, 'reaction-dark-320.png'), animations: 'disabled' });
            checks.push('Language switching across all seven locales at 320px; Arabic RTL and dark mode snapshots');
        }
        assert.deepEqual(errors, []);
        const report = { checks, pageErrors: errors, checkedAt: new Date().toISOString() };
        await fs.writeFile(path.join(out, process.argv.includes('--rps') ? 'rps.json' : 'solo.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify(report, null, 2));
    } catch (error) {
        await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
        console.error(await page.locator('body').innerText());
        throw error;
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
