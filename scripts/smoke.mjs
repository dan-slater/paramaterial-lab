#!/usr/bin/env node
// End-to-end smoke of the new block-scroll webapp.
// - iPhone 13 viewport + desktop viewport, screenshots for each
// - Picks a preset, adds a series of blocks via tool palette, sends a chat message
// - Captures console errors / failed requests

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = '/tmp/paramaterial-smoke';
mkdirSync(OUT, { recursive: true });

const results = [];

async function runForViewport(label, deviceName, viewport) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({
		viewport,
		userAgent: devices[deviceName]?.userAgent,
		deviceScaleFactor: viewport.width < 500 ? 3 : 1
	});
	const page = await ctx.newPage();
	const errors = [];
	const failed = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));

	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.screenshot({ path: join(OUT, `${label}-01-empty.png`), fullPage: true });

	// Pick first preset from the dataset-picker block
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Basic Usage')
		);
		btn?.click();
	});
	await page.waitForTimeout(1500);
	await page.screenshot({ path: join(OUT, `${label}-02-dataset-loaded.png`), fullPage: true });

	// Click each tool in the palette by firing the click directly (palette scrolls horizontally)
	for (const tool of ['Stress–strain', 'Foot correction', 'Properties table', 'Representative curves', 'Parameter scatter', 'Ramberg–Osgood', 'Zener–Hollomon', 'Dataset summary']) {
		await page.evaluate((t) => {
			const btn = [...document.querySelectorAll('button')].find((b) =>
				b.textContent?.includes(t)
			);
			btn?.click();
		}, tool);
		await page.waitForTimeout(1500);
	}
	await page.screenshot({ path: join(OUT, `${label}-03-all-blocks.png`), fullPage: true });

	// Send a chat message via direct DOM manipulation (works regardless of viewport / off-screen pane)
	await page.evaluate(() => {
		const ta = document.querySelector('textarea[placeholder*="analysis"]');
		if (ta) {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
				.set;
			setter.call(ta, 'add a note');
			ta.dispatchEvent(new Event('input', { bubbles: true }));
			// Submit the parent form
			const form = ta.closest('form');
			form?.requestSubmit?.() ?? form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		}
	});
	await page.waitForTimeout(1000);
	await page.screenshot({ path: join(OUT, `${label}-04-after-chat.png`), fullPage: true });

	// count blocks
	const blockCount = await page.locator('article').count();
	results.push({
		label,
		viewport,
		blockCount,
		errors: [...errors],
		failed: [...failed]
	});
	await browser.close();
}

await runForViewport('phone', 'iPhone 13', devices['iPhone 13'].viewport);
await runForViewport('desktop', 'Desktop Chrome', { width: 1440, height: 900 });

console.log(JSON.stringify(results, null, 2));
const bad = results.some((r) => r.errors.length || r.failed.length);
process.exit(bad ? 1 : 0);
