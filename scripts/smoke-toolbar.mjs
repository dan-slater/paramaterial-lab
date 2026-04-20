#!/usr/bin/env node
// Smoke test for the per-block toolbar: reorder + duplicate.
// Assumes the dev/preview server is already running at BASE_URL (default :8080).

import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	userAgent: devices['Desktop Chrome'].userAgent
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

function fail(msg) {
	console.error('FAIL:', msg);
	process.exit(1);
}

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// Load a preset so tools become meaningful.
await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Basic Usage')
	);
	btn?.click();
});
await page.waitForTimeout(1000);

// Add two stress-strain blocks via the tool palette.
for (let i = 0; i < 2; i++) {
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Stress–strain')
		);
		btn?.click();
	});
	await page.waitForTimeout(700);
}

// Sanity: we now have 3 blocks (dataset-picker + 2 stress-strain).
let articles = await page.locator('article').count();
if (articles !== 3) fail(`expected 3 blocks after adding two, got ${articles}`);

// Capture the ids of the 2 stress-strain blocks (indexes 1 and 2).
const blockIdsBefore = await page.evaluate(() =>
	[...document.querySelectorAll('[id^="block-"]')].map((el) => el.id)
);
if (blockIdsBefore.length !== 3) fail(`expected 3 block wrappers, got ${blockIdsBefore.length}`);
const firstSS_before = blockIdsBefore[1];
const secondSS_before = blockIdsBefore[2];

// Click "Move down" on the first stress-strain block.
await page.evaluate((wrapperId) => {
	const wrapper = document.getElementById(wrapperId);
	const btn = wrapper?.querySelector('button[aria-label="Move block down"]');
	btn?.click();
}, firstSS_before);
await page.waitForTimeout(300);

// Verify the order swapped.
const blockIdsAfterMove = await page.evaluate(() =>
	[...document.querySelectorAll('[id^="block-"]')].map((el) => el.id)
);
if (blockIdsAfterMove[1] !== secondSS_before || blockIdsAfterMove[2] !== firstSS_before) {
	fail(
		`move did not swap order. before=${JSON.stringify(blockIdsBefore)} after=${JSON.stringify(blockIdsAfterMove)}`
	);
}
console.log('move down: OK (swapped', firstSS_before, '<->', secondSS_before, ')');

// Click "Duplicate" on the block at index 1 now.
const targetDup = blockIdsAfterMove[1];
const debug = await page.evaluate((wrapperId) => {
	const wrapper = document.getElementById(wrapperId);
	const btn = wrapper?.querySelector('button[aria-label="Duplicate block"]');
	if (!btn) return { found: false, html: wrapper?.innerHTML?.slice(0, 400) };
	btn.click();
	return { found: true };
}, targetDup);
if (!debug.found) fail(`duplicate button not found on ${targetDup}: ${debug.html}`);
await page.waitForTimeout(400);

articles = await page.locator('article').count();
if (articles !== 4) fail(`expected 4 blocks after duplicate, got ${articles}`);
console.log('duplicate: OK (blockCount 3 -> 4)');

// Filter out the known 404 that the existing smoke.mjs also tolerates
// (a static data file fetched by the dataset picker preset).
const realErrors = errors.filter((e) => !/404.*Not Found/.test(e));
if (realErrors.length) {
	console.error('console errors:', realErrors);
	process.exit(1);
}

await browser.close();
console.log('toolbar smoke: PASS');
