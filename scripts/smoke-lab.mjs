#!/usr/bin/env node
// Smoke for the public lab surface: the shareable preset routes and the
// in-browser CSV import. Assumes a running server at BASE_URL.
//
//   BASE_URL=http://127.0.0.1:5177 node scripts/smoke-lab.mjs
//
// Each check prints ok/FAIL; exit code is the number of failures.

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5177';
const SAMPLES = new URL('../static/samples/', import.meta.url).pathname;

let fails = 0;
let passes = 0;
function check(cond, msg) {
	console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
	if (cond) passes++;
	else fails++;
}

const browser = await chromium.launch();

async function fresh() {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	return { ctx, page, errors };
}

async function headerText(page) {
	return (await page.locator('header').first().innerText()).replace(/\s+/g, ' ');
}

// --- 1. Preset routes ------------------------------------------------------
const PRESETS = [
	{ slug: 'materials', name: 'Materials — Uniaxial Tension', tests: 154 },
	{ slug: 'finance', name: 'Finance — Daily Adjusted Closes', tests: 40, json: 'finance' },
	{ slug: 'climate', name: 'Climate — GHCN-Daily Temperatures', tests: 30, json: 'climate' },
	{ slug: 'battery', name: 'Battery — Severson 2019 LFP Cycling', tests: 124, json: 'battery' }
];
for (const p of PRESETS) {
	const { ctx, page, errors } = await fresh();
	const res = await page.goto(`${BASE}/lab/${p.slug}`, { waitUntil: 'networkidle' });
	check(res?.status() === 200, `/lab/${p.slug} returns 200`);
	await page.waitForFunction((n) => document.querySelector('header')?.textContent?.includes(`${n} tests`), p.tests, { timeout: 15000 }).catch(() => {});
	const h = await headerText(page);
	check(h.includes(`${p.tests} tests`), `/lab/${p.slug} loads ${p.tests} series (header: "${h.slice(0, 90)}")`);
	const title = await page.title();
	check(title.includes('paramaterial lab'), `/lab/${p.slug} has a page title ("${title}")`);
	const scatters = await page.locator('article').count();
	check(scatters >= 4, `/lab/${p.slug} opens its template (${scatters} blocks)`);
	const link = await page.locator('[data-testid="preset-link"]').getAttribute('href').catch(() => null);
	check(link === `/lab/${p.slug}`, `/lab/${p.slug} shows its share link (${link})`);
	check(errors.length === 0, `/lab/${p.slug} no console errors ${errors.slice(0, 2).join(' | ')}`);
	// Reload keeps the visitor's blocks (template is not re-applied over their work).
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Note'));
		btn?.click();
	});
	await page.waitForTimeout(400);
	const before = await page.locator('article').count();
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(800);
	const after = await page.locator('article').count();
	check(after === before, `/lab/${p.slug} reload keeps blocks (${before} -> ${after})`);
	await ctx.close();
}

{
	const { ctx, page } = await fresh();
	const res = await page.goto(`${BASE}/lab/nope`);
	check(res?.status() === 404, `/lab/nope is a 404 (${res?.status()})`);
	await page.goto(`${BASE}/lab`, { waitUntil: 'networkidle' });
	check(new URL(page.url()).pathname === '/lab/materials', `/lab redirects to /lab/materials (${page.url()})`);
	await ctx.close();
}

// --- 2. CSV import ---------------------------------------------------------
async function importAndRead(page) {
	await page.locator('[data-testid="csv-mapping"]').waitFor({ timeout: 5000 });
	await page.locator('[data-testid="csv-import-go"]').click();
	await page.waitForTimeout(500);
	return headerText(page);
}

{
	const { ctx, page, errors } = await fresh();
	await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
	check((await page.locator('[data-testid="csv-import"]').count()) === 1, 'import panel on the picker');

	// Sample button, long format.
	await page.getByRole('button', { name: '4 climate stations (long)' }).click();
	await page.locator('[data-testid="csv-mapping"]').waitFor();
	const id = await page.locator('[data-testid="map-id"]').inputValue();
	const dom = await page.locator('[data-testid="map-domain"]').inputValue();
	check(id === 'station' && dom === 'climate', `long sample auto-maps id=${id}, domain=${dom}`);
	let h = await importAndRead(page);
	check(h.includes('climate-long · 4 tests'), `long sample imports 4 series ("${h.slice(0, 80)}")`);

	// File input, one wide file.
	await page.getByRole('button', { name: 'Change dataset' }).click();
	await page.locator('[data-testid="csv-input"]').setInputFiles(`${SAMPLES}tension-single.csv`);
	h = await importAndRead(page);
	check(h.includes('tension-single · 1 tests'), `wide file imports 1 series ("${h.slice(0, 80)}")`);

	// Add a stress-strain block and confirm it plots the import.
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Stress–strain'));
		btn?.click();
	});
	await page.waitForTimeout(800);
	check((await page.locator('canvas').count()) > 0, 'imported series renders on a plot');

	// Two wide files -> two series.
	await page.getByRole('button', { name: 'Change dataset' }).click();
	const body = readFileSync(`${SAMPLES}tension-single.csv`);
	await page.locator('[data-testid="csv-input"]').setInputFiles([
		{ name: 'a.csv', mimeType: 'text/csv', buffer: body },
		{ name: 'b.csv', mimeType: 'text/csv', buffer: body }
	]);
	h = await importAndRead(page);
	check(h.includes('2 uploaded files · 2 tests'), `two files import 2 series ("${h.slice(0, 80)}")`);

	// Bad mapping surfaces an error instead of crashing.
	await page.getByRole('button', { name: 'Change dataset' }).click();
	await page.locator('[data-testid="csv-input"]').setInputFiles({
		name: 'words.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('name,colour\nfoo,red\nbar,blue\n')
	});
	await page.locator('[data-testid="csv-import-go"]').click();
	const err = await page.locator('[data-testid="csv-error"]').innerText().catch(() => '');
	check(/No series/.test(err), `non-numeric file shows an error ("${err.slice(0, 60)}")`);

	check(errors.length === 0, `import flow no console errors ${errors.slice(0, 2).join(' | ')}`);
	await ctx.close();
}

await browser.close();
console.log(`\nsmoke-lab: ${passes} passed, ${fails} failed`);
process.exit(fails);
