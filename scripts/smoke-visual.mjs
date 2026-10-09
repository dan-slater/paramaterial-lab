#!/usr/bin/env node
// Thorough visual sweep across features on both phone + desktop viewports.
// Screenshots land at /tmp/paramaterial-smoke/visual-*.png
// No assertions beyond "no console errors / no failed requests" — the
// screenshots are for review.

import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = process.env.SMOKE_OUT ?? new URL('../../tmp/visual-matrix-screenshots', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function clickByText(page, text, opts = {}) {
	return page.evaluate(
		({ t, exact }) => {
			const btns = [...document.querySelectorAll('button, a, [role="button"]')];
			const btn = btns.find((b) =>
				exact ? b.textContent?.trim() === t : b.textContent?.includes(t)
			);
			btn?.click();
		},
		{ t: text, exact: !!opts.exact }
	);
}

async function runViewport(label, viewportSpec) {
	const browser = await chromium.launch();
	const ctx = await browser.newContext(viewportSpec);
	// clear all storage by starting fresh context every run
	const page = await ctx.newPage();
	const errors = [];
	const failed = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));

	async function snap(name) {
		await page.waitForTimeout(300);
		await page.screenshot({
			path: join(OUT, `visual-${label}-${name}.png`),
			fullPage: true
		});
	}

	// ── 01. Landing, empty state ──────────────────────────────────────
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await snap('01-landing-empty');

	// ── 02. Pick "Materials — Uniaxial" preset ─────────────────────────────────
	await clickByText(page, 'Materials — Uniaxial');
	await page.waitForTimeout(1500);
	await snap('02-dataset-loaded');

	// ── 03. Open Template dropdown ────────────────────────────────────
	await clickByText(page, 'Template');
	await page.waitForTimeout(400);
	await snap('03-template-dropdown-open');

	// ── 04. Apply tension-quick-look template (auto-confirms since only 1 block) ──
	await page.evaluate(() => {
		const b = [...document.querySelectorAll('button')].find((x) =>
			x.textContent?.includes('Tension quick-look')
		);
		b?.click();
	});
	await page.waitForTimeout(1200);
	// Accept any confirm dialog
	page.on('dialog', (d) => d.accept());
	await snap('04-template-tension-applied');

	// ── 05. Add all remaining tool-palette blocks ─────────────────────
	const remaining = [
		'Representative curves',
		'Ramberg–Osgood',
		'Zener–Hollomon',
		'Dataset summary',
		'Note'
	];
	for (const t of remaining) {
		await page.evaluate((txt) => {
			const btn = [...document.querySelectorAll('button')].find((b) =>
				b.textContent?.includes(txt)
			);
			btn?.click();
		}, t);
		await page.waitForTimeout(1100);
	}
	await snap('05-all-blocks-added');

	// ── 06. Toggle 0.2% offset line on stress-strain block ────────────
	await page.evaluate(() => {
		const cb = [...document.querySelectorAll('input[type="checkbox"]')].find((c) => {
			const label = c.closest('label');
			return label?.textContent?.includes('offset');
		});
		if (cb) {
			cb.click();
		}
	});
	await page.waitForTimeout(600);
	await snap('06-offset-line-on');

	// ── 07. Stress-strain hover tooltip ───────────────────────────────
	// Scroll to the stress-strain plot and hover its center
	await page.evaluate(() => {
		const el = [...document.querySelectorAll('.uplot')][0]; // first uPlot = stress-strain
		el?.scrollIntoView({ behavior: 'instant', block: 'center' });
	});
	await page.waitForTimeout(500);
	{
		const box = await page.$('.uplot canvas');
		if (box) {
			const r = await box.boundingBox();
			if (r) {
				await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.4);
				await page.waitForTimeout(600);
			}
		}
	}
	await snap('07-tooltip-hover');

	// ── 08. Click-to-isolate ──────────────────────────────────────────
	{
		const box = await page.$('.uplot canvas');
		if (box) {
			const r = await box.boundingBox();
			if (r) {
				await page.mouse.click(r.x + r.width * 0.3, r.y + r.height * 0.4);
				await page.waitForTimeout(400);
			}
		}
	}
	await snap('08-click-isolate');
	// Click empty area (above the plot) to reset
	await page.mouse.click(20, 20);
	await page.waitForTimeout(400);

	// ── 09. Open Export dropdown ──────────────────────────────────────
	// Scroll header into view first
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(200);
	await clickByText(page, 'Export');
	await page.waitForTimeout(400);
	await snap('09-export-dropdown-open');
	// dismiss
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);

	// ── 10. Open ApiKey modal via chat cog (desktop) / chat toggle+cog (mobile) ──
	if (viewportSpec.viewport.width < 1024) {
		await clickByText(page, 'Chat', { exact: true });
		await page.waitForTimeout(400);
	}
	// Click the settings cog — it has aria-label "Chat settings"
	await page.evaluate(() => {
		const btn = document.querySelector('button[aria-label="Chat settings"]');
		btn?.click();
	});
	await page.waitForTimeout(500);
	await snap('10-api-key-modal');
	// close modal
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);

	// ── 11. Send a chat message (rule-based fallback, no API key set) ─
	await page.evaluate(() => {
		const ta = document.querySelector('textarea[placeholder*="analysis"]');
		if (ta) {
			const setter = Object.getOwnPropertyDescriptor(
				window.HTMLTextAreaElement.prototype,
				'value'
			).set;
			setter.call(ta, 'summarise the dataset');
			ta.dispatchEvent(new Event('input', { bubbles: true }));
			const form = ta.closest('form');
			form?.requestSubmit?.() ?? form?.dispatchEvent(new Event('submit', { bubbles: true }));
		}
	});
	await page.waitForTimeout(800);
	await snap('11-chat-summarise');

	// ── 12. Reorder: move 2nd block down via its toolbar ──────────────
	await page.evaluate(() => {
		const articles = document.querySelectorAll('article');
		const target = articles[1]; // second block (first analysis block)
		const downBtn = target?.querySelector('button[aria-label*="Move down" i], button[title*="Move down" i], button[aria-label*="down" i]');
		downBtn?.click();
	});
	await page.waitForTimeout(500);
	await snap('12-reorder-down');

	// ── 13. Duplicate a block ─────────────────────────────────────────
	await page.evaluate(() => {
		const articles = document.querySelectorAll('article');
		const target = articles[2];
		const dupBtn = target?.querySelector(
			'button[aria-label*="Duplicate" i], button[title*="Duplicate" i]'
		);
		dupBtn?.click();
	});
	await page.waitForTimeout(500);
	await snap('13-duplicated');

	// ── 14. Persistence: reload and verify blocks still there ─────────
	const beforeReload = await page.locator('article').count();
	await page.reload({ waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	const afterReload = await page.locator('article').count();
	await snap('14-after-reload');

	const blockCount = await page.locator('article').count();
	const datasetName = await page
		.locator('header span.hidden.sm\\:inline')
		.first()
		.textContent()
		.catch(() => null);

	await browser.close();

	return {
		label,
		viewport: viewportSpec.viewport,
		blockCount,
		beforeReload,
		afterReload,
		datasetName: datasetName?.trim() || null,
		errors,
		failed
	};
}

const results = [];
results.push(await runViewport('desktop', { viewport: { width: 1440, height: 900 } }));
results.push(
	await runViewport('phone', {
		viewport: devices['iPhone 13'].viewport,
		userAgent: devices['iPhone 13'].userAgent,
		deviceScaleFactor: 3
	})
);

console.log(JSON.stringify(results, null, 2));
const bad = results.some(
	(r) => r.errors.length || r.failed.length || r.beforeReload !== r.afterReload
);
process.exit(bad ? 1 : 0);
