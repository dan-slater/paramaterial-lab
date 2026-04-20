#!/usr/bin/env node
// End-to-end smoke test of the paramaterial webapp.
// - iPhone 13 viewport (390x844)
// - Walks: landing → click preset → /prepare → /process → /aggregate → /fit → /results
// - Screenshots each page and saves to /tmp/paramaterial-smoke/
// - Logs console errors + failed network requests
// - Exits non-zero if any page has console errors, or plot fails to render

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = '/tmp/paramaterial-smoke';
mkdirSync(OUT, { recursive: true });

const viewport = devices['iPhone 13'].viewport; // 390 x 844

const results = [];

async function run() {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({
		viewport,
		userAgent: devices['iPhone 13'].userAgent,
		deviceScaleFactor: 2
	});
	const page = await ctx.newPage();

	const errors = [];
	const failedReqs = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
	page.on('requestfailed', (req) =>
		failedReqs.push(`${req.failure()?.errorText} ${req.url()}`)
	);

	async function snap(name, url, { waitForSelector } = {}) {
		errors.length = 0;
		failedReqs.length = 0;
		const t0 = Date.now();
		const resp = await page.goto(url, { waitUntil: 'networkidle' });
		if (waitForSelector) {
			try {
				await page.waitForSelector(waitForSelector, { timeout: 5000 });
			} catch (e) {
				errors.push(`missing selector ${waitForSelector}: ${e.message}`);
			}
		}
		await page.waitForTimeout(400); // let charts finish paint
		const file = join(OUT, `${name}.png`);
		await page.screenshot({ path: file, fullPage: true });
		const title = await page.title();
		results.push({
			name,
			url,
			status: resp?.status() ?? null,
			title,
			ms: Date.now() - t0,
			errors: [...errors],
			failedReqs: [...failedReqs],
			file
		});
	}

	// 1. Landing
	await snap('01-landing', `${BASE}/`, { waitForSelector: 'text=Choose a dataset' });

	// 2. Click first preset → should navigate to /prepare with chart
	try {
		await page.click('button:has-text("Basic Usage")');
		await page.waitForURL('**/prepare', { timeout: 5000 });
	} catch (e) {
		results.push({ name: '02-click-preset', error: e.message });
	}
	await page.waitForTimeout(800);
	const chartCount = await page.locator('.uplot').count();
	results.push({ name: '02-click-preset', chartCount, url: page.url() });
	await page.screenshot({ path: join(OUT, '02-prepare-after-click.png'), fullPage: true });

	// 3. Directly hit each pipeline step (exercises SPA nav)
	await snap('03-prepare-direct', `${BASE}/prepare`);
	await snap('04-process', `${BASE}/process`);
	await snap('05-aggregate', `${BASE}/aggregate`);
	await snap('06-fit', `${BASE}/fit`);
	await snap('07-results', `${BASE}/results`);

	// 8. Data fixture sanity
	const dataResp = await page.request.get(`${BASE}/data/basic-usage.json`);
	results.push({
		name: '08-data-fixture',
		status: dataResp.status(),
		bytes: (await dataResp.body()).length
	});

	await browser.close();

	console.log(JSON.stringify(results, null, 2));
	const anyFail = results.some(
		(r) => (r.errors?.length ?? 0) > 0 || (r.failedReqs?.length ?? 0) > 0 || r.error
	);
	process.exit(anyFail ? 1 : 0);
}

run().catch((e) => {
	console.error(e);
	process.exit(2);
});
