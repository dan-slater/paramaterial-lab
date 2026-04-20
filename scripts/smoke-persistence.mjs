#!/usr/bin/env node
// Persistence smoke test:
// 1) load landing
// 2) pick a preset
// 3) add 2 blocks via the tool palette
// 4) reload the page
// 5) verify the 2 blocks are still there (plus dataset-picker) after rehydration
// 6) verify the preset dataset was also restored

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

// Start fresh
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// 2) Pick a preset
await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Basic Usage')
	);
	btn?.click();
});
await page.waitForTimeout(1500);

// 3) Add two blocks via the tool palette
for (const tool of ['Stress–strain', 'Properties table']) {
	await page.evaluate((t) => {
		const btn = [...document.querySelectorAll('button')].find((b) =>
			b.textContent?.includes(t)
		);
		btn?.click();
	}, tool);
	await page.waitForTimeout(800);
}

const countBefore = await page.locator('main article').count();
const storageBefore = await page.evaluate(() => ({
	blocks: localStorage.getItem('paramaterial:blocks:v1'),
	chat: localStorage.getItem('paramaterial:chat:v1')
}));

// 4) Reload
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // let datasetStore.load finish

// 5) Verify
const countAfter = await page.locator('main article').count();
const datasetNameAfter = await page.evaluate(
	() => document.querySelector('main article h2')?.textContent ?? ''
);
const types = await page.evaluate(() => {
	const blocks = JSON.parse(localStorage.getItem('paramaterial:blocks:v1') ?? '{}');
	return (blocks.blocks ?? []).map((b) => b.type);
});

const pass =
	countAfter === countBefore &&
	countAfter === 3 &&
	types.includes('stress-strain') &&
	types.includes('property-table') &&
	datasetNameAfter.includes('Basic Usage') &&
	errors.length === 0;

console.log(JSON.stringify(
	{
		countBefore,
		countAfter,
		types,
		datasetNameAfter,
		storageSizes: {
			blocks: storageBefore.blocks?.length ?? 0,
			chat: storageBefore.chat?.length ?? 0
		},
		errors,
		pass
	},
	null,
	2
));

await browser.close();
process.exit(pass ? 0 : 1);
