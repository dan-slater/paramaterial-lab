#!/usr/bin/env node
// Template picker smoke test:
// 1) Open the landing page.
// 2) Click the Template button → pick "Tension quick-look".
// 3) Confirm 5 blocks exist (dataset-picker + 4 analysis blocks).

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

// Accept any window.confirm() dialog (so the "Replace current report?" prompt
// resolves without blocking when the test re-runs against a persisted state).
page.on('dialog', (d) => d.accept());

// Start fresh so we know the initial state (1 dataset-picker block).
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

// 1) Click the Template button in the header.
await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) =>
		b.textContent?.trim().startsWith('Template')
	);
	btn?.click();
});
await page.waitForTimeout(200);

// 2) Pick "Tension quick-look".
await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Tension quick-look')
	);
	btn?.click();
});
await page.waitForTimeout(400);

// 3) Count blocks via localStorage (stable across render timing).
const types = await page.evaluate(() => {
	const raw = localStorage.getItem('paramaterial:blocks:v1');
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return (parsed.blocks ?? []).map((b) => b.type);
	} catch {
		return [];
	}
});

const expected = [
	'dataset-picker',
	'stress-strain',
	'foot-correction',
	'property-table',
	'scatter'
];
const pass =
	types.length === 5 &&
	expected.every((t) => types.includes(t)) &&
	errors.length === 0;

console.log(
	JSON.stringify(
		{
			blockCount: types.length,
			types,
			expected,
			errors,
			pass
		},
		null,
		2
	)
);

await browser.close();
process.exit(pass ? 0 : 1);
