#!/usr/bin/env node
// Interactive Playwright driver.
// Keeps a Chromium page open. Listens on 127.0.0.1:9823 for JSON commands.
// After each command takes a screenshot and returns the path + any console log deltas.
//
// Start once in background:  node scripts/driver.mjs
// Send a command:             curl -s -X POST http://127.0.0.1:9823/cmd -d '{"action":"goto","url":"http://localhost:8080/"}'
// Shut down:                  curl -s http://127.0.0.1:9823/quit

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Output dir: repo-local tmp/driver-screenshots (gitignored). Override with DRIVER_OUT if needed.
const OUT = process.env.DRIVER_OUT ?? new URL('../../tmp/driver-screenshots', import.meta.url).pathname;
const PORT = 9823;
fs.mkdirSync(OUT, { recursive: true });

let step = 0;
let browser, context, page;
const consoleLog = []; // appended-to; returned as delta per command

async function start() {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    page.on('console', (msg) => consoleLog.push({ t: Date.now(), type: msg.type(), text: msg.text().slice(0, 500) }));
    page.on('pageerror', (err) => consoleLog.push({ t: Date.now(), type: 'pageerror', text: String(err).slice(0, 500) }));
}

async function shot(label = '') {
    step += 1;
    const n = String(step).padStart(3, '0');
    const safe = label.replace(/[^a-z0-9-]/gi, '_').slice(0, 40);
    const file = path.join(OUT, `${n}${safe ? '-' + safe : ''}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
}

async function handle(body) {
    const { action, ...args } = body;
    const before = consoleLog.length;
    let result = {};
    try {
        switch (action) {
            case 'goto':
                await page.goto(args.url, { waitUntil: args.wait ?? 'domcontentloaded', timeout: 15000 });
                break;
            case 'reload':
                await page.reload({ waitUntil: 'domcontentloaded' });
                break;
            case 'click':
                await page.click(args.selector, { timeout: 5000, force: args.force ?? false });
                break;
            case 'click_text':
                await page.getByText(args.text, { exact: args.exact ?? false }).first().click({ timeout: 5000 });
                break;
            case 'click_role':
                await page.getByRole(args.role, { name: args.name }).first().click({ timeout: 5000 });
                break;
            case 'js_click': // bypass actionability checks by clicking via DOM
                result.clicked = await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return false;
                    el.scrollIntoView({ block: 'center' });
                    el.click();
                    return true;
                }, args.selector);
                break;
            case 'js_click_text':
                result.clicked = await page.evaluate(({ text, tag }) => {
                    const els = [...document.querySelectorAll(tag || 'button, a, [role=button]')];
                    const hit = els.find((e) => (e.textContent || '').trim().includes(text));
                    if (!hit) return false;
                    hit.scrollIntoView({ block: 'center' });
                    hit.click();
                    return true;
                }, args);
                break;
            case 'fill':
                await page.fill(args.selector, args.text, { timeout: 5000 });
                break;
            case 'select':
                await page.selectOption(args.selector, args.value, { timeout: 5000 });
                break;
            case 'press':
                await page.keyboard.press(args.key);
                break;
            case 'type':
                await page.keyboard.type(args.text, { delay: args.delay ?? 20 });
                break;
            case 'wait':
                if (args.selector) await page.waitForSelector(args.selector, { timeout: args.timeout ?? 5000, state: args.state ?? 'visible' });
                else if (args.ms) await page.waitForTimeout(args.ms);
                else if (args.url) await page.waitForURL(args.url, { timeout: args.timeout ?? 5000 });
                break;
            case 'eval':
                result.value = await page.evaluate(args.script);
                break;
            case 'viewport':
                await page.setViewportSize({ width: args.width, height: args.height });
                break;
            case 'state':
                result.url = page.url();
                result.title = await page.title();
                break;
            case 'snapshot':
                // aria snapshot — a text view of the accessibility tree
                result.aria = await page.locator('body').ariaSnapshot({ timeout: 3000 }).catch((e) => String(e));
                break;
            case 'html':
                result.html = await page.content();
                result.html = result.html.slice(0, args.limit ?? 5000);
                break;
            case 'reset_context':
                await context.close();
                context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
                page = await context.newPage();
                page.on('console', (msg) => consoleLog.push({ t: Date.now(), type: msg.type(), text: msg.text().slice(0, 500) }));
                page.on('pageerror', (err) => consoleLog.push({ t: Date.now(), type: 'pageerror', text: String(err).slice(0, 500) }));
                break;
            default:
                result.error = `unknown action: ${action}`;
        }
        // try to settle a little before screenshot
        await page.waitForTimeout(args.settle ?? 120);
        const file = await shot(args.label ?? action);
        const newLogs = consoleLog.slice(before);
        return {
            ok: !result.error,
            screenshot: file,
            url: page.url(),
            console: newLogs,
            step,
            ...result
        };
    } catch (e) {
        let file = null;
        try { file = await shot('ERR-' + (args.label ?? action)); } catch {}
        return {
            ok: false,
            error: String(e).slice(0, 800),
            screenshot: file,
            url: page.url(),
            console: consoleLog.slice(before),
            step
        };
    }
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/quit') {
        res.end('bye');
        await browser?.close();
        process.exit(0);
    }
    if (req.url === '/ping') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ ok: true, step, url: page?.url() ?? null }));
        return;
    }
    if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end('POST only');
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
        let parsed;
        try { parsed = JSON.parse(body); }
        catch (e) { res.statusCode = 400; return res.end('bad json'); }
        const out = await handle(parsed);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(out));
    });
});

await start();
server.listen(PORT, '127.0.0.1', () => {
    console.log(`[driver] listening on 127.0.0.1:${PORT}, screenshots -> ${OUT}`);
});
