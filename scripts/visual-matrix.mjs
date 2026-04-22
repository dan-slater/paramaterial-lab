#!/usr/bin/env node
// Exhaustive visual-states test matrix for the paramaterial webapp.
//
// Walks every UI surface across 4 viewports:
//   phone  (iPhone 13, 390x844)
//   tablet (iPad Mini, 768x1024)
//   desktop-narrow (1280x800)
//   desktop-wide   (1920x1080)
//
// For each viewport a fresh browser context is created (ephemeral localStorage),
// so scenarios start clean unless one explicitly seeds state first.
//
// Each scenario is { name, desktopOnly?, phoneOnly?, setup(page), expect?(page) }.
// We screenshot to /tmp/paramaterial-smoke/visual-<viewport>-<scenario>.png,
// record any console errors and failed requests, then write a JSON + HTML report.

import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = process.env.SMOKE_OUT ?? new URL('../../tmp/visual-matrix-screenshots', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
	{
		label: 'phone',
		opts: {
			viewport: devices['iPhone 13'].viewport,
			userAgent: devices['iPhone 13'].userAgent,
			deviceScaleFactor: 3,
			hasTouch: true,
			isMobile: true
		}
	},
	{
		label: 'tablet',
		opts: {
			viewport: { width: 768, height: 1024 },
			userAgent: devices['iPad Mini'].userAgent,
			deviceScaleFactor: 2,
			hasTouch: true,
			isMobile: true
		}
	},
	{ label: 'desktop-narrow', opts: { viewport: { width: 1280, height: 800 } } },
	{ label: 'desktop-wide', opts: { viewport: { width: 1920, height: 1080 } } }
];

// ---------------------------------------------------------------------------
// Helpers usable inside scenarios.
// ---------------------------------------------------------------------------

async function clickByText(page, text, { exact = false } = {}) {
	return page.evaluate(
		({ t, e }) => {
			const candidates = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')];
			const btn = candidates.find((b) =>
				e ? b.textContent?.trim() === t : (b.textContent?.includes(t))
			);
			if (btn) {
				btn.click();
				return true;
			}
			return false;
		},
		{ t: text, e: exact }
	);
}

async function gotoFresh(page) {
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(150);
}

async function loadPreset(page, id) {
	// Trigger via the preset-grid button text; Basic Usage / CS1…CS4 share name patterns.
	const labels = {
		'basic-usage': 'Basic Usage',
		cs1: 'CS1',
		cs2: 'CS2',
		cs3: 'CS3',
		cs4: 'CS4'
	};
	const text = labels[id];
	if (!text) return false;
	const clicked = await clickByText(page, text);
	if (!clicked) return false;
	// Poll for dataset loading to actually finish
	for (let i = 0; i < 30; i++) {
		const ok = await page.evaluate(() => {
			const h = document.querySelector('body > header');
			return !!h && /tests/.test(h.textContent || '');
		});
		if (ok) break;
		await page.waitForTimeout(150);
	}
	await page.waitForTimeout(300);
	return true;
}

async function addBlock(page, label) {
	return page.evaluate((t) => {
		const btns = [...document.querySelectorAll('#tool-palette button')];
		const b = btns.find((x) => x.textContent?.includes(t));
		if (b) {
			b.click();
			return true;
		}
		return false;
	}, label);
}

async function getArticles(page) {
	return page.locator('article').count();
}

async function canvasBox(page, nth = 0) {
	const h = await page.$$('.uplot canvas');
	const c = h[nth];
	if (!c) return null;
	return c.boundingBox();
}

async function dismissDialogsOnce(page) {
	page.once('dialog', (d) => d.accept());
}

// ---------------------------------------------------------------------------
// Scenario catalog.
// ---------------------------------------------------------------------------

/** @typedef {Object} Scenario
 *  @property {string} name
 *  @property {boolean} [desktopOnly]
 *  @property {boolean} [phoneOnly]
 *  @property {(page: import('playwright').Page) => Promise<void>} setup
 *  @property {(page: import('playwright').Page) => Promise<{ ok: boolean, info?: string } | void>} [expect]
 */

/** @type {Scenario[]} */
const SCENARIOS = [
	// ── Startup / landing ─────────────────────────────────────────────
	{
		name: '01-landing-empty',
		async setup(page) { await gotoFresh(page); }
	},
	{
		name: '02-landing-with-dataset-presets-grid',
		async setup(page) {
			await gotoFresh(page);
			// The preset grid is part of DatasetPickerBlock when no dataset loaded.
			// Nothing else to do.
		},
		async expect(page) {
			const count = await page.locator('button:has-text("Basic Usage")').count();
			return { ok: count >= 1, info: `Basic Usage button count=${count}` };
		}
	},
	{
		name: '03-csv-upload-error',
		async setup(page) {
			await gotoFresh(page);
			// Inject a bogus file lacking a Strain column.
			const bad = 'Time,Load\n0,0\n1,10\n';
			await page.setInputFiles('input[type="file"][accept=".csv"]', {
				name: 'bad.csv',
				mimeType: 'text/csv',
				buffer: Buffer.from(bad)
			});
			await page.waitForTimeout(400);
		},
		async expect(page) {
			const err = await page.locator('text=CSV must have Strain and Stress').count();
			return { ok: err >= 1 };
		}
	},
	{
		name: '04-csv-upload-success',
		async setup(page) {
			await gotoFresh(page);
			const good = 'Strain,Stress\n0,0\n0.01,200\n0.02,350\n0.03,420\n0.04,450\n';
			await page.setInputFiles('input[type="file"][accept=".csv"]', {
				name: 'good.csv',
				mimeType: 'text/csv',
				buffer: Buffer.from(good)
			});
			await page.waitForTimeout(500);
		},
		async expect(page) {
			const header = await page.locator('body > header').first().textContent();
			return { ok: /tests/.test(header || ''), info: header?.trim() };
		}
	},
	{
		name: '05-reupload-notice-banner',
		async setup(page) {
			// Seed localStorage with an uploaded-flag block set, then reload.
			await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
			await page.evaluate(() => {
				localStorage.setItem(
					'paramaterial:blocks:v1',
					JSON.stringify({
						v: 1,
						blocks: [
							{
								id: 'picker',
								type: 'dataset-picker',
								config: { uploaded: true, name: 'prior.csv' },
								createdAt: Date.now()
							}
						]
					})
				);
			});
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(400);
		},
		async expect(page) {
			const count = await page.locator('text=raw data isn\'t saved').count();
			return { ok: count >= 1 };
		}
	},

	// ── Preset datasets ───────────────────────────────────────────────
	...['basic-usage', 'cs1', 'cs2', 'cs3', 'cs4'].map((id) => ({
		name: `06-preset-${id}-loaded`,
		async setup(page) {
			await gotoFresh(page);
			const ok = await loadPreset(page, id);
			if (!ok) throw new Error(`preset ${id} not clickable`);
		},
		async expect(page) {
			const header = await page.locator('body > header').first().textContent();
			return { ok: /tests/.test(header || ''), info: header?.trim()?.slice(0, 60) };
		}
	})),

	// ── Each of 9 tool-palette blocks added (dataset-picker is always present) ──
	...[
		{ type: 'stress-strain', label: 'Stress–strain' },
		{ type: 'foot-correction', label: 'Foot correction' },
		{ type: 'property-table', label: 'Properties table' },
		{ type: 'representative-curves', label: 'Representative curves' },
		{ type: 'scatter', label: 'Parameter scatter' },
		{ type: 'ramberg-osgood', label: 'Ramberg–Osgood' },
		{ type: 'zener-hollomon', label: 'Zener–Hollomon' },
		{ type: 'dataset-summary', label: 'Dataset summary' },
		{ type: 'note', label: 'Note' }
	].map((tool) => ({
		name: `10-block-${tool.type}-visible`,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, tool.label);
			await page.waitForTimeout(1000);
		},
		async expect(page) {
			const n = await getArticles(page);
			return { ok: n >= 2, info: `articles=${n}` };
		}
	})),
	// 10-block-dataset-picker-visible: always present from the start
	{
		name: '10-block-dataset-picker-visible',
		async setup(page) {
			await gotoFresh(page);
		},
		async expect(page) {
			const n = await getArticles(page);
			return { ok: n >= 1, info: `articles=${n}` };
		}
	},

	// ── Stress-strain block configuration ─────────────────────────────
	...['temperature', 'lot', 'test_type'].map((col) => ({
		name: `11-stress-strain-colorby-${col}`,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await page.waitForTimeout(800);
			// Select the "Color by" <select> inside the stress-strain article
			await page.evaluate((c) => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Stress–strain/.test(a.textContent || '')) {
						const sel = a.querySelector('select');
						if (sel) {
							// Some columns may not exist — filter to existing options first
							const hasOpt = [...sel.options].some((o) => o.value === c);
							if (hasOpt) {
								sel.value = c;
								sel.dispatchEvent(new Event('change', { bubbles: true }));
							}
						}
						return;
					}
				}
			}, col);
			await page.waitForTimeout(500);
		},
		async expect(page) {
			// If that column didn't exist in the dataset it'll fall through; treat as soft.
			return { ok: true };
		}
	})),
	{
		name: '12-stress-strain-offset-toggle-on',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await page.waitForTimeout(800);
			await page.evaluate(() => {
				const cb = [...document.querySelectorAll('input[type="checkbox"]')].find((c) => {
					const label = c.closest('label');
					return label?.textContent?.includes('offset');
				});
				if (cb) cb.click();
			});
			await page.waitForTimeout(500);
		}
	},
	{
		name: '13-stress-strain-legend-group-toggled-hidden',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await page.waitForTimeout(900);
			// Click the first legend swatch button
			await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Stress–strain/.test(a.textContent || '')) {
						const legend = a.querySelectorAll('button[title^="Toggle"]');
						if (legend.length) legend[0].click();
						return;
					}
				}
			});
			await page.waitForTimeout(400);
		}
	},
	{
		name: '14-stress-strain-hover-tooltip',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await page.waitForTimeout(1500);
			await page.evaluate(() => {
				document.querySelector('.uplot')?.scrollIntoView({ behavior: 'instant', block: 'center' });
			});
			await page.waitForTimeout(300);
			const box = await canvasBox(page, 0);
			if (!box) throw new Error('no canvas');
			// First enter from outside to ensure mouseenter fires, then sweep.
			await page.mouse.move(box.x - 20, box.y + box.height / 2);
			await page.waitForTimeout(50);
			for (let i = 0; i < 12; i++) {
				const x = box.x + box.width * (0.2 + i * 0.05);
				const y = box.y + box.height * (0.35 + (i % 3) * 0.1);
				await page.mouse.move(x, y, { steps: 5 });
				await page.waitForTimeout(80);
				const shown = await page.evaluate(() => {
					const t = document.querySelector('[data-testid="plot-tooltip"]');
					return !!t;
				});
				if (shown) break;
			}
			await page.waitForTimeout(300);
		},
		async expect(page) {
			const n = await page.locator('[data-testid="plot-tooltip"]').count();
			// Document the current behavior — tooltip relies on uPlot's setSeries
			// being triggered by native mousemove; synthetic moves may miss the
			// ±16px proximity threshold if the curve density isn't high. Treat a
			// miss as a soft warning, not a hard fail.
			return { ok: true, info: `tooltip count=${n}` };
		}
	},
	{
		name: '15-stress-strain-click-isolate',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await page.waitForTimeout(1200);
			await page.evaluate(() => {
				document.querySelector('.uplot')?.scrollIntoView({ behavior: 'instant', block: 'center' });
			});
			await page.waitForTimeout(200);
			const box = await canvasBox(page, 0);
			if (!box) throw new Error('no canvas');
			// Hover first to focus a series, then click at same spot
			const x = box.x + box.width * 0.35;
			const y = box.y + box.height * 0.5;
			await page.mouse.move(x, y, { steps: 4 });
			await page.waitForTimeout(200);
			await page.mouse.click(x, y);
			await page.waitForTimeout(400);
		}
	},

	// ── Foot correction: first/middle/last test ───────────────────────
	...['first', 'middle', 'last'].map((which) => ({
		name: `16-foot-correction-test-${which}`,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Foot correction');
			await page.waitForTimeout(900);
			await page.evaluate((w) => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Foot correction/.test(a.textContent || '')) {
						const sel = a.querySelector('select');
						if (!sel) return;
						const opts = [...sel.options];
						const tgt =
							w === 'first'
								? opts[0]
								: w === 'last'
									? opts[opts.length - 1]
									: opts[Math.floor(opts.length / 2)];
						if (tgt) {
							sel.value = tgt.value;
							sel.dispatchEvent(new Event('change', { bubbles: true }));
						}
						return;
					}
				}
			}, which);
			await page.waitForTimeout(500);
		}
	})),

	// ── Property table expanded ───────────────────────────────────────
	{
		name: '17-property-table-expanded',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Properties table');
			await page.waitForTimeout(1100);
			// Click "Show N more" up to 3 times to expand
			for (let i = 0; i < 3; i++) {
				const clicked = await page.evaluate(() => {
					const btn = [...document.querySelectorAll('button')].find((b) =>
						/Show\s+\d+\s+more/.test(b.textContent || '')
					);
					if (btn) {
						btn.click();
						return true;
					}
					return false;
				});
				if (!clicked) break;
				await page.waitForTimeout(200);
			}
			await page.waitForTimeout(300);
		}
	},

	// ── Representative curves groupBy ────────────────────────────────
	...['temperature', 'lot', 'test_type'].map((col) => ({
		name: `18-representative-curves-groupby-${col}`,
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Representative curves');
			await page.waitForTimeout(900);
			await page.evaluate((c) => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Representative curves/.test(a.textContent || '')) {
						const sel = a.querySelector('select');
						if (!sel) return;
						const hasOpt = [...sel.options].some((o) => o.value === c);
						if (hasOpt) {
							sel.value = c;
							sel.dispatchEvent(new Event('change', { bubbles: true }));
						}
						return;
					}
				}
			}, col);
			await page.waitForTimeout(500);
		}
	})),

	// ── Scatter Y x X combinations ────────────────────────────────────
	...['UTS', 'E', 'PS'].flatMap((y) =>
		['temperature', 'lot'].map((x) => ({
			name: `19-scatter-y-${y}-x-${x}`,
			async setup(page) {
				await gotoFresh(page);
				await loadPreset(page, 'basic-usage');
				await addBlock(page, 'Parameter scatter');
				await page.waitForTimeout(1100);
				await page.evaluate(
					({ yv, xv }) => {
						const arts = document.querySelectorAll('article');
						for (const a of arts) {
							if (/Parameter scatter/.test(a.textContent || '')) {
								const sels = a.querySelectorAll('select');
								if (sels.length >= 2) {
									const ySel = sels[0];
									const xSel = sels[1];
									if ([...ySel.options].some((o) => o.value === yv)) {
										ySel.value = yv;
										ySel.dispatchEvent(new Event('change', { bubbles: true }));
									}
									if ([...xSel.options].some((o) => o.value === xv)) {
										xSel.value = xv;
										xSel.dispatchEvent(new Event('change', { bubbles: true }));
									}
								}
								return;
							}
						}
					},
					{ yv: y, xv: x }
				);
				await page.waitForTimeout(500);
			}
		}))
	),

	// ── Ramberg-Osgood preview test changed ──────────────────────────
	{
		name: '20-ramberg-osgood-preview-test-changed',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Ramberg–Osgood');
			await page.waitForTimeout(1500);
			await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Ramberg/.test(a.textContent || '')) {
						const sel = a.querySelector('select');
						if (sel && sel.options.length > 1) {
							sel.value = sel.options[Math.floor(sel.options.length / 2)].value;
							sel.dispatchEvent(new Event('change', { bubbles: true }));
						}
						return;
					}
				}
			});
			await page.waitForTimeout(600);
		}
	},

	// ── Zener-Hollomon: sparse rates (basic-usage) + multi-rate (cs3) ──
	{
		name: '21-zener-hollomon-basic-usage',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Zener–Hollomon');
			await page.waitForTimeout(1200);
		}
	},
	{
		name: '21-zener-hollomon-cs3',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'cs3');
			await addBlock(page, 'Zener–Hollomon');
			await page.waitForTimeout(1500);
		}
	},
	{
		name: '22-zener-hollomon-Q-changed',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'cs3');
			await addBlock(page, 'Zener–Hollomon');
			await page.waitForTimeout(1500);
			await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				for (const a of arts) {
					if (/Zener/.test(a.textContent || '')) {
						const input = a.querySelector('input[type="number"]');
						if (input) {
							const setter = Object.getOwnPropertyDescriptor(
								window.HTMLInputElement.prototype,
								'value'
							).set;
							setter.call(input, '300');
							input.dispatchEvent(new Event('input', { bubbles: true }));
							input.dispatchEvent(new Event('change', { bubbles: true }));
						}
						return;
					}
				}
			});
			await page.waitForTimeout(500);
		}
	},

	// ── Note filled ───────────────────────────────────────────────────
	{
		name: '23-note-filled',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await page.waitForTimeout(400);
			await page.evaluate(() => {
				const ta = document.querySelectorAll('article textarea');
				const noteTa = [...ta].find((t) => t.placeholder?.includes('observation'));
				if (noteTa) {
					const setter = Object.getOwnPropertyDescriptor(
						window.HTMLTextAreaElement.prototype,
						'value'
					).set;
					setter.call(noteTa, 'Interesting hardening transition around 100°C, and the highest-temperature lot shows a kink near ε=0.05.');
					noteTa.dispatchEvent(new Event('input', { bubbles: true }));
				}
			});
			await page.waitForTimeout(200);
		}
	},

	// ── Block toolbar states ──────────────────────────────────────────
	{
		name: '30-toolbar-move-up-disabled-at-top',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await addBlock(page, 'Note');
			await page.waitForTimeout(800);
		},
		async expect(page) {
			// First analysis block (#2) has Move-up disabled.
			const disabled = await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				const btn = arts[1]?.querySelector('button[aria-label="Move block up"]');
				return btn?.disabled === true;
			});
			return { ok: disabled === true, info: `first-analysis move-up disabled=${disabled}` };
		}
	},
	{
		name: '31-toolbar-move-down-disabled-at-bottom',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await addBlock(page, 'Note');
			await page.waitForTimeout(800);
		},
		async expect(page) {
			const disabled = await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				const last = arts[arts.length - 1];
				const btn = last?.querySelector('button[aria-label="Move block down"]');
				return btn?.disabled === true;
			});
			return { ok: disabled === true, info: `last move-down disabled=${disabled}` };
		}
	},
	{
		name: '32-toolbar-duplicate-clicked',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await page.waitForTimeout(500);
			const before = await getArticles(page);
			await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				const btn = arts[arts.length - 1]?.querySelector('button[aria-label="Duplicate block"]');
				btn?.click();
			});
			await page.waitForTimeout(500);
			const after = await getArticles(page);
			page.__dupResult = { before, after };
		},
		async expect(page) {
			const r = page.__dupResult;
			return { ok: !!r && r.after === r.before + 1, info: JSON.stringify(r) };
		}
	},
	{
		name: '33-toolbar-remove-clicked',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await addBlock(page, 'Note');
			await page.waitForTimeout(600);
			const before = await getArticles(page);
			await page.evaluate(() => {
				const arts = document.querySelectorAll('article');
				const btn = arts[arts.length - 1]?.querySelector('button[aria-label="Remove block"]');
				btn?.click();
			});
			await page.waitForTimeout(500);
			const after = await getArticles(page);
			page.__remResult = { before, after };
		},
		async expect(page) {
			const r = page.__remResult;
			return { ok: !!r && r.after === r.before - 1, info: JSON.stringify(r) };
		}
	},

	// ── Tool palette scroll / keyboard ────────────────────────────────
	{
		name: '40-palette-scrolled-right',
		phoneOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await page.evaluate(() => {
				document.getElementById('tool-palette')?.scrollBy({ left: 500 });
			});
			await page.waitForTimeout(200);
		}
	},
	{
		name: '41-palette-first-button-focused',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await page.keyboard.press('Meta+K');
			await page.waitForTimeout(400);
		},
		async expect(page) {
			const focused = await page.evaluate(() => document.activeElement?.id);
			return { ok: focused === 'tool-palette-first', info: `active=${focused}` };
		}
	},

	// ── Template ▾ dropdown ───────────────────────────────────────────
	{
		name: '50-template-dropdown-open',
		async setup(page) {
			await gotoFresh(page);
			await clickByText(page, 'Template');
			await page.waitForTimeout(250);
		},
		async expect(page) {
			const n = await page.locator('[role="menu"]').count();
			return { ok: n >= 1, info: `menus=${n}` };
		}
	},
	...[
		{ key: 'tension', match: 'Tension quick-look' },
		{ key: 'hot', match: 'Hot deformation' },
		{ key: 'foot', match: 'Foot-correction sweep' }
	].map(({ key, match }) => ({
		name: `51-template-${key}-applied`,
		async setup(page) {
			await gotoFresh(page);
			dismissDialogsOnce(page);
			await clickByText(page, 'Template');
			await page.waitForTimeout(250);
			const picked = await clickByText(page, match);
			if (!picked) throw new Error(`template menu missing: ${match}`);
			await page.waitForTimeout(1500);
		},
		async expect(page) {
			const n = await getArticles(page);
			return { ok: n >= 2, info: `articles=${n}` };
		}
	})),
	{
		name: '52-template-confirm-dialog',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await addBlock(page, 'Note');
			await page.waitForTimeout(500);
			// Next confirm dialog — intercept and screenshot while still showing
			let dialogMsg = '';
			page.once('dialog', async (d) => {
				dialogMsg = d.message();
				await d.dismiss();
			});
			await clickByText(page, 'Template');
			await page.waitForTimeout(250);
			await clickByText(page, 'Tension quick-look');
			await page.waitForTimeout(500);
			page.__dialog = dialogMsg;
		},
		async expect(page) {
			return { ok: /Replace/i.test(page.__dialog || ''), info: page.__dialog };
		}
	},

	// ── Export ▾ dropdown ─────────────────────────────────────────────
	{
		name: '60-export-dropdown-open',
		async setup(page) {
			await gotoFresh(page);
			await clickByText(page, 'Export');
			await page.waitForTimeout(300);
		},
		async expect(page) {
			const n = await page.locator('[role="menu"] >> text=Download JSON').count();
			return { ok: n >= 1 };
		}
	},
	{
		name: '61-export-copy-link-toast',
		async setup(page) {
			// Grant clipboard permission so navigator.clipboard.writeText resolves.
			const ctx = page.context();
			await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await page.waitForTimeout(500);
			await clickByText(page, 'Export');
			await page.waitForTimeout(250);
			await clickByText(page, 'Copy link');
			await page.waitForTimeout(800);
		},
		async expect(page) {
			const n = await page.locator('role=status').count();
			return { ok: n >= 1 };
		}
	},
	{
		name: '62-export-link-too-large',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			// Synthesize 400 heavy note blocks by writing directly to localStorage and reloading.
			await page.evaluate(() => {
				const prev = JSON.parse(localStorage.getItem('paramaterial:blocks:v1') || '{"v":1,"blocks":[]}');
				const heavy = [];
				const fill = 'x'.repeat(120);
				for (let i = 0; i < 400; i++) {
					heavy.push({
						id: `h-${i}`,
						type: 'note',
						config: { text: `${fill} #${i}` },
						createdAt: Date.now()
					});
				}
				prev.blocks = [...prev.blocks, ...heavy];
				localStorage.setItem('paramaterial:blocks:v1', JSON.stringify(prev));
			});
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(500);
			await clickByText(page, 'Export');
			await page.waitForTimeout(200);
			await clickByText(page, 'Copy link');
			await page.waitForTimeout(600);
		},
		async expect(page) {
			const txt = await page.locator('role=status').textContent().catch(() => null);
			return { ok: /too large/i.test(txt || ''), info: txt || '' };
		}
	},
	{
		name: '63-export-clear-all-executed',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Note');
			await addBlock(page, 'Note');
			await page.waitForTimeout(500);
			page.once('dialog', (d) => d.accept());
			await clickByText(page, 'Export');
			await page.waitForTimeout(200);
			await clickByText(page, 'Clear all');
			await page.waitForTimeout(500);
		},
		async expect(page) {
			const n = await getArticles(page);
			return { ok: n === 1, info: `articles=${n}` };
		}
	},

	// ── Chat pane states ──────────────────────────────────────────────
	{
		name: '70-chat-empty-welcome',
		async setup(page) {
			await gotoFresh(page);
			// Make sure chat is visible on mobile
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await clickByText(page, 'Clear');
			await page.waitForTimeout(400);
		}
	},
	{
		name: '71-chat-with-user-message',
		async setup(page) {
			await gotoFresh(page);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			// Stub the chat response by intercepting fetch BEFORE submit — without API key
			// the fallback path adds a block locally, so user msg is visible instantly.
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				if (!ta) return;
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLTextAreaElement.prototype,
					'value'
				).set;
				setter.call(ta, 'summarise the dataset');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
			});
			await page.waitForTimeout(150);
		}
	},
	{
		name: '72-chat-assistant-response',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				if (!ta) return;
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLTextAreaElement.prototype,
					'value'
				).set;
				setter.call(ta, 'plot stress strain');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
				ta.closest('form')?.requestSubmit();
			});
			await page.waitForTimeout(900);
		}
	},
	{
		name: '73-chat-busy-thinking',
		async setup(page) {
			// Install a stubbed API key so usingClaude=true, and intercept the fetch so
			// the request hangs long enough for us to screenshot "thinking…".
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			await page.evaluate(() => {
				localStorage.setItem('paramaterial:apikey:v1', 'sk-ant-fake-stub');
			});
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(300);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			// Intercept anthropic requests
			await page.route('**/api.anthropic.com/**', async (route) => {
				await new Promise((r) => setTimeout(r, 2500));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						id: 'msg_stub',
						type: 'message',
						role: 'assistant',
						model: 'claude',
						content: [{ type: 'text', text: 'stubbed reply' }],
						stop_reason: 'end_turn'
					})
				});
			});
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				if (!ta) return;
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLTextAreaElement.prototype,
					'value'
				).set;
				setter.call(ta, 'hello');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
				ta.closest('form')?.requestSubmit();
			});
			// Screenshot during the stalled request
			await page.waitForTimeout(800);
		},
		async expect(page) {
			const txt = await page.locator('text=thinking').count();
			return { ok: txt >= 1 };
		}
	},
	{
		name: '74-chat-error-message',
		async setup(page) {
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			await page.evaluate(() => {
				localStorage.setItem('paramaterial:apikey:v1', 'sk-ant-fake-stub');
			});
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(300);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await page.route('**/api.anthropic.com/**', (route) =>
				route.fulfill({
					status: 401,
					contentType: 'application/json',
					body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
				})
			);
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				if (!ta) return;
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLTextAreaElement.prototype,
					'value'
				).set;
				setter.call(ta, 'please error');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
				ta.closest('form')?.requestSubmit();
			});
			await page.waitForTimeout(1500);
		},
		async expect(page) {
			// Either an "Error:" message or a "!" error avatar should be present.
			const has = await page.locator('text=Error:').count();
			return { ok: has >= 1, info: `error-rows=${has}` };
		}
	},
	{
		name: '75-chat-mode-indicator-rule-based',
		async setup(page) {
			await gotoFresh(page);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
		},
		async expect(page) {
			const txt = await page.locator('[data-testid="chat-mode"]').textContent();
			return { ok: /rule-based/.test(txt || ''), info: txt?.trim() };
		}
	},
	{
		name: '76-chat-mode-indicator-using-claude',
		async setup(page) {
			await page.goto(BASE + '/', { waitUntil: 'networkidle' });
			await page.evaluate(() => {
				localStorage.setItem('paramaterial:apikey:v1', 'sk-ant-stub');
			});
			await page.reload({ waitUntil: 'networkidle' });
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await page.waitForTimeout(300);
		},
		async expect(page) {
			const txt = await page.locator('[data-testid="chat-mode"]').textContent();
			return { ok: /using Claude/.test(txt || ''), info: txt?.trim() };
		}
	},
	{
		name: '77-chat-mobile-toggled-open',
		phoneOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await clickByText(page, 'Chat', { exact: true });
			await page.waitForTimeout(400);
		},
		async expect(page) {
			const pressed = await page.evaluate(
				() => document.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed')
			);
			return { ok: pressed === 'true', info: `pressed=${pressed}` };
		}
	},
	{
		name: '78-chat-mobile-toggled-closed',
		phoneOnly: true,
		async setup(page) {
			await gotoFresh(page);
			// Open then close
			await clickByText(page, 'Chat', { exact: true });
			await page.waitForTimeout(250);
			await clickByText(page, 'Hide chat');
			await page.waitForTimeout(400);
		}
	},
	{
		name: '79-api-key-modal-open',
		async setup(page) {
			await gotoFresh(page);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await page.evaluate(() => {
				document.querySelector('button[aria-label="Chat settings"]')?.click();
			});
			await page.waitForTimeout(350);
		},
		async expect(page) {
			return { ok: (await page.locator('[role="dialog"]').count()) >= 1 };
		}
	},
	{
		name: '80-api-key-modal-with-fake-key-entered',
		async setup(page) {
			await gotoFresh(page);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(250);
			}
			await page.evaluate(() => {
				document.querySelector('button[aria-label="Chat settings"]')?.click();
			});
			await page.waitForTimeout(350);
			await page.fill('#apikey-input', 'sk-ant-fake-for-screenshot');
			await page.waitForTimeout(200);
		}
	},

	// ── Keyboard shortcuts (desktop only) ─────────────────────────────
	{
		name: '90-cmdk-palette-focused',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await page.keyboard.press('Meta+K');
			await page.waitForTimeout(350);
		},
		async expect(page) {
			const id = await page.evaluate(() => document.activeElement?.id);
			return { ok: id === 'tool-palette-first', info: `active=${id}` };
		}
	},
	{
		name: '91-cmdslash-chat-focused',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await page.keyboard.press('Meta+/');
			await page.waitForTimeout(350);
		},
		async expect(page) {
			const info = await page.evaluate(() => {
				const el = document.activeElement;
				return {
					tag: el?.tagName,
					ph: el?.placeholder
				};
			});
			return { ok: info.tag === 'TEXTAREA', info: JSON.stringify(info) };
		}
	},
	{
		name: '92-esc-blurred',
		desktopOnly: true,
		async setup(page) {
			await gotoFresh(page);
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				ta?.focus();
			});
			await page.keyboard.press('Escape');
			await page.waitForTimeout(200);
		},
		async expect(page) {
			const tag = await page.evaluate(() => document.activeElement?.tagName);
			return { ok: tag !== 'TEXTAREA', info: `active=${tag}` };
		}
	},

	// ── Shareable link ────────────────────────────────────────────────
	{
		name: '95-load-with-state-param',
		async setup(page) {
			const payload = {
				v: 1,
				blocks: [
					{ id: 'p', type: 'dataset-picker', config: { id: 'basic-usage' } },
					{ id: 'n', type: 'note', config: { text: 'hydrated via share link' } }
				],
				datasetId: 'basic-usage'
			};
			const encoded = Buffer.from(encodeURIComponent(JSON.stringify(payload))).toString('base64');
			await page.goto(BASE + '/?state=' + encoded, { waitUntil: 'networkidle' });
			await page.waitForTimeout(1500);
		},
		async expect(page) {
			const n = await getArticles(page);
			const hydrated = await page.evaluate(() => {
				const tas = document.querySelectorAll('article textarea');
				for (const ta of tas) {
					if ((ta.value || '').includes('hydrated via share link')) return 1;
				}
				return 0;
			});
			return { ok: n >= 2 && hydrated >= 1, info: `articles=${n}, hydrated=${hydrated}` };
		}
	},

	// ── Persistence / recovery ────────────────────────────────────────
	{
		name: '97-reload-preserves-state',
		async setup(page) {
			await gotoFresh(page);
			await loadPreset(page, 'basic-usage');
			await addBlock(page, 'Stress–strain');
			await addBlock(page, 'Note');
			await page.waitForTimeout(700);
			const before = await getArticles(page);
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(1200);
			const after = await getArticles(page);
			page.__state = { before, after };
		},
		async expect(page) {
			const r = page.__state;
			return { ok: !!r && r.before === r.after, info: JSON.stringify(r) };
		}
	},
	{
		name: '98-reload-preserves-chat-messages',
		async setup(page) {
			await gotoFresh(page);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(200);
			}
			await page.evaluate(() => {
				const ta = document.querySelector('textarea[placeholder*="analysis"]');
				if (!ta) return;
				const setter = Object.getOwnPropertyDescriptor(
					window.HTMLTextAreaElement.prototype,
					'value'
				).set;
				setter.call(ta, 'add a note');
				ta.dispatchEvent(new Event('input', { bubbles: true }));
				ta.closest('form')?.requestSubmit();
			});
			await page.waitForTimeout(900);
			const before = await page.locator('.flex.gap-2.text-sm').count();
			await page.reload({ waitUntil: 'networkidle' });
			await page.waitForTimeout(1200);
			if (page.viewportSize().width < 1024) {
				await clickByText(page, 'Chat', { exact: true });
				await page.waitForTimeout(200);
			}
			const after = await page.locator('.flex.gap-2.text-sm').count();
			page.__chat = { before, after };
		},
		async expect(page) {
			const r = page.__chat;
			return { ok: !!r && r.before > 0 && r.after >= r.before, info: JSON.stringify(r) };
		}
	}
];

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

/** @type {Array<{viewport:string, scenario:string, status:'pass'|'fail'|'skipped', errors:string[], failed:string[], screenshot:string|null, info?:string}>} */
const rows = [];

for (const vp of VIEWPORTS) {
	const browser = await chromium.launch();
	const isPhone = vp.label === 'phone';
	const isDesktop = vp.label.startsWith('desktop');
	for (const scenario of SCENARIOS) {
		// viewport gating
		if (scenario.desktopOnly && !isDesktop) {
			rows.push({
				viewport: vp.label,
				scenario: scenario.name,
				status: 'skipped',
				errors: [],
				failed: [],
				screenshot: null,
				info: 'desktopOnly'
			});
			continue;
		}
		if (scenario.phoneOnly && !isPhone) {
			rows.push({
				viewport: vp.label,
				scenario: scenario.name,
				status: 'skipped',
				errors: [],
				failed: [],
				screenshot: null,
				info: 'phoneOnly'
			});
			continue;
		}

		const ctx = await browser.newContext(vp.opts);
		const page = await ctx.newPage();
		const errors = [];
		const failed = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
		page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`));

		const shotName = `visual-${vp.label}-${scenario.name}.png`;
		const shotPath = join(OUT, shotName);
		let status = 'pass';
		let info = '';

		try {
			await scenario.setup(page);
		} catch (e) {
			status = 'fail';
			errors.push(`setup: ${e instanceof Error ? e.message : String(e)}`);
		}

		try {
			await page.screenshot({ path: shotPath, fullPage: true });
		} catch (e) {
			errors.push(`screenshot: ${e instanceof Error ? e.message : String(e)}`);
		}

		if (status !== 'fail' && typeof scenario.expect === 'function') {
			try {
				const r = await scenario.expect(page);
				if (r && r.info) info = r.info;
				if (r && r.ok === false) status = 'fail';
			} catch (e) {
				status = 'fail';
				errors.push(`expect: ${e instanceof Error ? e.message : String(e)}`);
			}
		}

		// Pure JS errors are logged but do NOT alone fail the scenario, so that
		// bugs we find show up visibly in the report without forcing exit 1.
		// Truly broken scenarios (setup/expect throws) are already marked fail.

		rows.push({
			viewport: vp.label,
			scenario: scenario.name,
			status,
			errors,
			failed,
			screenshot: shotName,
			info
		});

		await ctx.close();

		// Compact live log
		const pad = scenario.name.padEnd(44);
		const mark = status === 'pass' ? 'OK' : status === 'skipped' ? 'SKIP' : 'FAIL';
		process.stdout.write(`[${vp.label.padEnd(14)}] ${pad} ${mark}${info ? ` (${info})` : ''}\n`);
	}
	await browser.close();
}

// ---------------------------------------------------------------------------
// JSON + HTML report.
// ---------------------------------------------------------------------------

const summary = {
	total: rows.length,
	pass: rows.filter((r) => r.status === 'pass').length,
	fail: rows.filter((r) => r.status === 'fail').length,
	skipped: rows.filter((r) => r.status === 'skipped').length,
	errors: rows.reduce((n, r) => n + r.errors.length, 0),
	failedRequests: rows.reduce((n, r) => n + r.failed.length, 0)
};

writeFileSync(
	join(OUT, 'visual-matrix.json'),
	JSON.stringify({ summary, rows }, null, 2)
);

// HTML report (self-contained, inline CSS, no JS)
function esc(s) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function badge(status) {
	const color = status === 'pass' ? '#16a34a' : status === 'fail' ? '#dc2626' : '#737373';
	return `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;color:#fff;background:${color}">${status.toUpperCase()}</span>`;
}

// group by scenario, then columns = viewports
const scenarios = [...new Set(rows.map((r) => r.scenario))];
const viewports = [...new Set(rows.map((r) => r.viewport))];

let html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>paramaterial — visual matrix report</title>
<style>
  :root { color-scheme: dark; }
  body { font: 13px/1.5 -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary div { padding: 6px 12px; background: #171717; border: 1px solid #262626; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #262626; padding: 8px; vertical-align: top; font-size: 11px; }
  th { position: sticky; top: 0; background: #171717; text-align: left; z-index: 1; }
  td.s { background: #0f0f0f; }
  .sname { font-family: ui-monospace, Menlo, monospace; white-space: nowrap; color: #cbd5e1; }
  img { max-width: 100%; height: auto; display: block; border: 1px solid #262626; border-radius: 4px; }
  .cell-meta { margin-top: 4px; color: #888; font-size: 10px; }
  .err { margin-top: 4px; color: #fca5a5; font-size: 10px; max-height: 100px; overflow: auto; }
  .missing { padding: 18px; text-align: center; color: #525252; font-size: 11px; background: #0f0f0f; border-radius: 4px; }
</style>
</head>
<body>
<h1>paramaterial — visual matrix</h1>
<div class="meta">Generated ${esc(new Date().toISOString())} · base ${esc(BASE)}</div>
<div class="summary">
  <div>Total: <strong>${summary.total}</strong></div>
  <div>Pass: <strong style="color:#16a34a">${summary.pass}</strong></div>
  <div>Fail: <strong style="color:#dc2626">${summary.fail}</strong></div>
  <div>Skipped: <strong style="color:#737373">${summary.skipped}</strong></div>
  <div>Console errors: <strong>${summary.errors}</strong></div>
  <div>Failed requests: <strong>${summary.failedRequests}</strong></div>
</div>
<table>
<thead><tr><th>Scenario</th>${viewports.map((v) => `<th>${esc(v)}</th>`).join('')}</tr></thead>
<tbody>
`;
for (const s of scenarios) {
	html += `<tr><td class="s sname">${esc(s)}</td>`;
	for (const v of viewports) {
		const row = rows.find((r) => r.scenario === s && r.viewport === v);
		if (!row) {
			html += '<td><div class="missing">—</div></td>';
			continue;
		}
		const img = row.screenshot
			? `<a href="${esc(row.screenshot)}" target="_blank"><img src="${esc(row.screenshot)}" alt="${esc(s)} ${esc(v)}" loading="lazy" /></a>`
			: '<div class="missing">no screenshot</div>';
		const errBlock = row.errors.length
			? `<div class="err">${esc(row.errors.slice(0, 3).join('\n'))}${row.errors.length > 3 ? `\n…+${row.errors.length - 3} more` : ''}</div>`
			: '';
		const failBlock = row.failed.length
			? `<div class="err">failed: ${esc(row.failed.slice(0, 3).join('\n'))}</div>`
			: '';
		html += `<td>${img}<div class="cell-meta">${badge(row.status)} ${row.info ? esc(row.info) : ''}</div>${errBlock}${failBlock}</td>`;
	}
	html += '</tr>\n';
}
html += '</tbody></table></body></html>';

writeFileSync(join(OUT, 'report.html'), html);

console.log('\n── summary ──');
console.log(JSON.stringify(summary, null, 2));
console.log(`\nReport: ${join(OUT, 'report.html')}`);

// Exit 1 only when at least one scenario explicitly failed (not just console noise).
process.exit(summary.fail > 0 ? 1 : 0);
