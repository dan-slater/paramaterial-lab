#!/usr/bin/env node
// Smoke for the processing blocks (Trim → Foot correction → Screen) on real data.
// Drops the 154 thesis CSVs + info.csv through the import panel, builds
//   Parameters (raw) · Trim · Foot correction · Screen · Parameter scatter · Parameters (processed)
// and reports how many tests read 0 MPa 0.2% proof stress above and below the
// processing blocks. Then checks Screen rejections survive a reload on the preset.
//
//   BASE_URL=http://127.0.0.1:3082 DROP_DIR=~/PycharmProjects/paramaterial-media/drop-basic-usage \
//     SHOTS=.shots node scripts/smoke-processing.mjs
//
// Each check prints ok/FAIL; exit code is the number of failures.

import { chromium } from 'playwright';
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3082';
const DROP = process.env.DROP_DIR ?? `${process.env.HOME}/PycharmProjects/paramaterial-media/drop-basic-usage`;
const SHOTS = process.env.SHOTS ?? '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let fails = 0;
let passes = 0;
function check(cond, msg) {
	console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
	if (cond) passes++;
	else fails++;
}

const browser = await chromium.launch();

async function fresh(viewport = { width: 1280, height: 800 }) {
	const ctx = await browser.newContext({ viewport, colorScheme: 'light' });
	const page = await ctx.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	return { ctx, page, errors };
}

async function blocks(page) {
	return page.evaluate(() => JSON.parse(localStorage.getItem('paramaterial:blocks:v1') ?? '{"blocks":[]}').blocks);
}

/** Click a palette tool; return the new block's id (it is appended last). */
async function add(page, type) {
	await page.locator(`[data-tool="${type}"]`).click();
	await page.waitForTimeout(250);
	const list = await blocks(page);
	return list[list.length - 1].id;
}

/** Proof-stress column of a Parameters block, every row. */
async function proofStresses(page, blockId) {
	const art = page.locator(`#block-${blockId}`);
	const more = art.getByRole('button', { name: /Show \d+ more/ });
	if (await more.count()) await more.click();
	return art.evaluate((el) => {
		const heads = [...el.querySelectorAll('thead th')].map((th) => th.textContent ?? '');
		const col = heads.findIndex((h) => /proof stress/i.test(h));
		return [...el.querySelectorAll('tbody tr')].map((tr) => {
			const t = tr.children[col]?.textContent?.trim() ?? '—';
			return t === '—' ? null : Number(t);
		});
	});
}
const zeroCount = (v) => v.filter((x) => x !== null && Math.abs(x) < 0.5).length;
const nullCount = (v) => v.filter((x) => x === null).length;

/** Viewport screenshot with the block (or a part of it) scrolled to just below the header. */
async function shot(page, blockId, name, inner) {
	if (!SHOTS) return;
	const target = inner ? page.locator(`#block-${blockId} ${inner}`).first() : page.locator(`#block-${blockId}`);
	// The report pane scrolls on its own, so let the browser find the scroller.
	await target.evaluate((el) => {
		const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
		el.style.scrollMarginTop = `${header + 12}px`;
		el.scrollIntoView({ block: 'start', behavior: 'instant' });
	});
	await page.waitForTimeout(350);
	await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

// --- 1. Real data through import -------------------------------------------
const files = readdirSync(DROP)
	.filter((f) => f.endsWith('.csv'))
	.map((f) => join(DROP, f));

for (const vp of [
	{ width: 1280, height: 800, tag: '1280' },
	{ width: 390, height: 844, tag: '390' }
]) {
	const { ctx, page, errors } = await fresh(vp);
	await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
	await page.locator('[data-testid="csv-input"]').setInputFiles(files);
	await page.locator('[data-testid="csv-mapping"]').waitFor({ timeout: 15000 });
	await page.locator('[data-testid="csv-import-go"]').click();
	await page.waitForFunction(() => /154 tests/.test(document.querySelector('header')?.textContent ?? ''), null, {
		timeout: 20000
	});
	check(true, `[${vp.tag}] ${files.length} files import as 154 tests`);

	const pRaw = await add(page, 'parameters');
	const trim = await add(page, 'trim');
	const foot = await add(page, 'foot-correction');
	const screen = await add(page, 'screen');
	const scatter = await add(page, 'scatter');
	const pOut = await add(page, 'parameters');
	await page.waitForTimeout(800);

	const list = await blocks(page);
	const footCfg = list.find((b) => b.id === foot)?.config ?? {};
	check(footCfg.apply === true, `[${vp.tag}] palette foot correction applies (config ${JSON.stringify(footCfg)})`);

	const kept = await page.locator(`#block-${trim} [data-testid="trim-kept"]`).innerText();
	check(/of/.test(kept), `[${vp.tag}] trim reports points kept (${kept.replace(/\s+/g, ' ')})`);
	const corrected = await page.locator(`#block-${foot} [data-testid="foot-corrected"]`).innerText();
	check(/154/.test(corrected), `[${vp.tag}] foot correction corrected ${corrected.replace(/\s+/g, ' ')}`);
	const cards = await page.locator(`#block-${screen} [data-testid="screen-card"]`).count();
	check(cards === 154, `[${vp.tag}] screen shows a plot per test (${cards})`);

	// Scatter: 0.2% proof stress vs temperature.
	const sc = page.locator(`#block-${scatter}`);
	const ySel = sc.locator('select').first();
	await ySel.selectOption('param:ProofStress');
	await sc.locator('select').nth(1).selectOption('meta:temperature');
	await page.waitForTimeout(300);
	const scTitle = await sc.locator('h2').innerText();
	check(/proof stress.* vs temperature/i.test(scTitle), `[${vp.tag}] scatter is "${scTitle}"`);

	const raw = await proofStresses(page, pRaw);
	const out = await proofStresses(page, pOut);
	console.log(
		`     [${vp.tag}] proof stress above the processing blocks: ${raw.length} tests, ${zeroCount(raw)} at 0 MPa, ${nullCount(raw)} not found`
	);
	console.log(
		`     [${vp.tag}] proof stress below Trim → Foot → Screen: ${out.length} tests, ${zeroCount(out)} at 0 MPa, ${nullCount(out)} not found`
	);
	check(zeroCount(out) < zeroCount(raw), `[${vp.tag}] processing removes the 0 MPa readings (${zeroCount(raw)} → ${zeroCount(out)})`);

	// Reject two tests in the screen; the scatter and the table below lose them.
	const ids = ['test_ID_107', 'test_ID_112'];
	for (const id of ids) await page.locator(`#block-${screen} [data-test-id="${id}"]`).click();
	await page.waitForTimeout(400);
	const after = await proofStresses(page, pOut);
	check(after.length === 152, `[${vp.tag}] 2 rejected → ${after.length} rows below the screen`);
	const rawAfter = await proofStresses(page, pRaw);
	check(rawAfter.length === 154, `[${vp.tag}] block above the screen still has ${rawAfter.length} rows`);
	const scCaption = await sc.locator('.caption-note').innerText();
	// Tests with no proof stress are not plotted.
	const plotted = after.length - nullCount(after);
	check(scCaption.includes(`${plotted} points`), `[${vp.tag}] scatter below plots ${plotted}: "${scCaption}"`);
	const cfg = (await blocks(page)).find((b) => b.id === screen)?.config;
	check(JSON.stringify(cfg?.rejected) === JSON.stringify(ids), `[${vp.tag}] rejected ids stored in config ${JSON.stringify(cfg?.rejected)}`);

	await shot(page, trim, `trim-${vp.tag}`);
	await shot(page, foot, `foot-correction-${vp.tag}`);
	await shot(page, foot, `foot-correction-per-test-${vp.tag}`, '[data-testid="foot-test"]');
	await shot(page, screen, `screen-${vp.tag}`);
	await shot(page, screen, `screen-rejected-${vp.tag}`, '[data-test-id="test_ID_107"]');
	await shot(page, scatter, `scatter-proof-stress-${vp.tag}`);

	check(errors.length === 0, `[${vp.tag}] no console errors ${errors.slice(0, 3).join(' | ')}`);
	await ctx.close();
}

// --- 2. Reload keeps rejections (preset data persists, uploads do not) ------
{
	const { ctx, page, errors } = await fresh();
	await page.goto(`${BASE}/lab/materials`, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => /154 tests/.test(document.querySelector('header')?.textContent ?? ''));
	const screen = await add(page, 'screen');
	const pOut = await add(page, 'parameters');
	await page.locator(`#block-${screen} [data-test-id="test_ID_001"]`).click();
	await page.waitForTimeout(400);
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForFunction(() => /154 tests/.test(document.querySelector('header')?.textContent ?? ''));
	await page.waitForTimeout(800);
	const pressed = await page.locator(`#block-${screen} [data-test-id="test_ID_001"]`).getAttribute('aria-pressed');
	check(pressed === 'true', `reload keeps the rejection (aria-pressed=${pressed})`);
	const rows = await proofStresses(page, pOut);
	check(rows.length === 153, `reload: block below the screen has ${rows.length} rows`);

	// The template's foot-correction block (no apply key) stays a diagnostic.
	const tpl = (await blocks(page)).find((b) => b.type === 'foot-correction');
	check(tpl && tpl.config.apply === undefined, 'template foot-correction has no apply key');
	check((await page.locator(`#block-${tpl.id} [data-testid="foot-apply"]`).count()) === 1, 'template foot-correction offers "Apply to blocks below"');
	check(errors.length === 0, `reload flow no console errors ${errors.slice(0, 3).join(' | ')}`);
	await ctx.close();
}

await browser.close();
console.log(`\nsmoke-processing: ${passes} passed, ${fails} failed`);
process.exit(fails);
