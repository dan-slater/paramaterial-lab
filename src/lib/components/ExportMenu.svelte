<script lang="ts">
	import { blocksStore, type Block } from '$lib/stores/blocks.svelte';
	import { chatStore, type ChatMessage } from '$lib/stores/chat.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import {
		findUplLpl,
		findE,
		findUTS,
		findProofStress,
		fitRambergOsgood,
		computeZH,
		computeRepresentative
	} from '$lib/processing';

	let open = $state(false);
	let fileInput: HTMLInputElement;
	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(msg: string, ms = 1800) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = null;
			toastTimer = null;
		}, ms);
	}

	function timestamp(): string {
		const d = new Date();
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
	}

	function downloadJSON() {
		const payload = {
			v: 1,
			exportedAt: new Date().toISOString(),
			datasetPresetId: datasetStore.current?.id && datasetStore.current.id !== 'upload'
				? datasetStore.current.id
				: null,
			blocks: blocksStore.list,
			messages: chatStore.messages
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `paramaterial-report-${timestamp()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		open = false;
	}

	function triggerImport() {
		fileInput?.click();
		open = false;
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const data = JSON.parse(text) as {
				blocks?: Block[];
				messages?: ChatMessage[];
				datasetPresetId?: string | null;
			};
			if (Array.isArray(data.blocks)) blocksStore.replaceAll(data.blocks);
			if (Array.isArray(data.messages)) chatStore.replaceAll(data.messages);
			if (typeof data.datasetPresetId === 'string') {
				void datasetStore.load(data.datasetPresetId);
			}
		} catch (err) {
			alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
		} finally {
			input.value = '';
		}
	}

	function escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function snapshotArticle(article: HTMLElement): string {
		const clone = article.cloneNode(true) as HTMLElement;
		clone.querySelectorAll('.opacity-0').forEach((el) => el.remove());
		const liveCanvases = article.querySelectorAll('canvas');
		const cloneCanvases = clone.querySelectorAll('canvas');
		cloneCanvases.forEach((cv, i) => {
			const live = liveCanvases[i] as HTMLCanvasElement | undefined;
			if (!live) return;
			try {
				const url = live.toDataURL('image/png');
				const img = document.createElement('img');
				img.src = url;
				img.style.maxWidth = '100%';
				img.style.height = 'auto';
				cv.replaceWith(img);
			} catch {
				/* tainted canvas; skip */
			}
		});
		clone.querySelectorAll('textarea').forEach((ta, i) => {
			const liveTa = article.querySelectorAll('textarea')[i] as HTMLTextAreaElement | undefined;
			const val = liveTa?.value ?? (ta as HTMLTextAreaElement).value ?? '';
			const p = document.createElement('p');
			p.textContent = val;
			p.style.whiteSpace = 'pre-wrap';
			ta.replaceWith(p);
		});
		clone.querySelectorAll('button, select, input').forEach((el) => el.remove());
		return clone.outerHTML;
	}

	function printReady() {
		const articles = document.querySelectorAll('main article');
		const body = Array.from(articles)
			.map((a, i) => `<section class="block"><div class="n">#${i + 1}</div>${snapshotArticle(a as HTMLElement)}</section>`)
			.join('\n');
		const title = `paramaterial report · ${new Date().toLocaleString()}`;
		const dsName = datasetStore.current?.name ?? 'No dataset';
		const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light; --serif: 'Source Serif 4', Georgia, serif; --sans: 'Inter', system-ui, sans-serif; }
  body { font-family: var(--serif); font-size: 11pt; line-height: 1.55; background: #faf8f3; color: #1b1a15; margin: 0; padding: 28px; }
  h1 { font-family: var(--serif); font-size: 22pt; margin: 0 0 4px; letter-spacing: -0.01em; }
  .meta { font-family: var(--sans); color: #4e4a3d; font-size: 10pt; margin-bottom: 22px; border-bottom: 1px solid #d9d4c6; padding-bottom: 12pt; }
  .block { background: #fffdf7; border: 1px solid #d9d4c6; border-radius: 6px; padding: 16px 18px; margin-bottom: 16px; position: relative; }
  .n { position: absolute; top: 10px; right: 14px; font-family: var(--sans); font-size: 9pt; color: #807a68; letter-spacing: 0.14em; text-transform: uppercase; }
  article { all: unset; display: block; }
  table { font-family: var(--sans); border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #d9d4c6; padding: 5px 9px; text-align: left; }
  th { background: #f3efe4; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 9pt; }
  h2 { font-family: var(--serif); font-size: 14pt; margin: 2px 0 4px; letter-spacing: -0.005em; }
  .caption-eyebrow { font-family: var(--sans); font-size: 9pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #564f42; }
  p { margin: 4px 0; }
  img { display: block; max-width: 100%; }
  @page { size: A4; margin: 18mm 16mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .block { break-inside: avoid; page-break-inside: avoid; border-color: #bbb; widows: 3; orphans: 3; }
  }
</style>
</head>
<body>
<h1>paramaterial report</h1>
<div class="meta">${escapeHtml(dsName)} · exported ${escapeHtml(new Date().toLocaleString())}</div>
${body}
</body>
</html>`;
		const w = window.open('', '_blank');
		if (w) {
			w.document.open();
			w.document.write(html);
			w.document.close();
		}
		open = false;
	}

	// ---------- Markdown export ----------

	function mdEscape(v: unknown): string {
		const s = String(v ?? '');
		return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
	}

	function titleForBlock(b: Block, idx: number): string {
		const fallback: Record<string, string> = {
			'dataset-picker': 'Dataset',
			'stress-strain': 'Stress–strain',
			'foot-correction': 'Foot correction',
			'property-table': 'Properties table',
			'representative-curves': 'Representative curves',
			scatter: 'Parameter scatter',
			'ramberg-osgood': 'Ramberg–Osgood',
			'zener-hollomon': 'Zener–Hollomon',
			note: 'Note',
			'dataset-summary': 'Dataset summary'
		};
		return b.title?.trim() || `${idx}. ${fallback[b.type] ?? b.type}`;
	}

	function renderStressStrainMd(b: Block): string {
		const tests = datasetStore.current?.tests ?? [];
		const colorBy = (b.config?.colorBy as string) ?? '—';
		return `_(${tests.length} tests, color by: ${colorBy})_`;
	}

	function renderFootCorrectionMd(b: Block): string {
		const tests = datasetStore.current?.tests ?? [];
		if (!tests.length) return '_No dataset loaded._';
		const requested = (b.config?.testId as string) ?? '';
		const test = tests.find((t) => t.test_id === requested) ?? tests[0];
		try {
			const foot = findUplLpl({ strain: test.strain, stress: test.stress });
			return `Test **${test.test_id}**: E = **${foot.E.toFixed(0)} MPa**, UPL = ${foot.uplIdx}, LPL = ${foot.lplIdx}`;
		} catch {
			return `Test **${test.test_id}**: fit failed.`;
		}
	}

	function renderPropertyTableMd(): string {
		const tests = datasetStore.current?.tests ?? [];
		if (!tests.length) return '_No dataset loaded._';
		interface Row {
			test_id: string;
			UTS: string;
			E: string;
			PS: string;
		}
		const rows: Row[] = [];
		for (const t of tests) {
			try {
				const foot = findUplLpl({ strain: t.strain, stress: t.stress });
				const uts = findUTS({ strain: t.strain, stress: t.stress });
				const ps = findProofStress({ strain: t.strain, stress: t.stress }, foot.E);
				rows.push({
					test_id: t.test_id,
					UTS: Number.isFinite(uts.UTS) ? uts.UTS.toFixed(1) : '—',
					E: Number.isFinite(foot.E) ? foot.E.toFixed(0) : '—',
					PS: Number.isFinite(ps.proofStress) ? ps.proofStress.toFixed(1) : '—'
				});
			} catch {
				rows.push({ test_id: t.test_id, UTS: '—', E: '—', PS: '—' });
			}
		}
		const cap = 20;
		const shown = rows.slice(0, cap);
		const head = '| test_id | UTS (MPa) | E (MPa) | PS (MPa) |';
		const sep = '| --- | ---: | ---: | ---: |';
		const body = shown
			.map((r) => `| ${mdEscape(r.test_id)} | ${r.UTS} | ${r.E} | ${r.PS} |`)
			.join('\n');
		let out = [head, sep, body].join('\n');
		if (rows.length > cap) {
			out += `\n\n… and ${rows.length - cap} more.`;
		}
		return out;
	}

	function renderRepresentativeCurvesMd(b: Block): string {
		const tests = datasetStore.current?.tests ?? [];
		const groupBy = (b.config?.groupBy as string) ?? '';
		if (!tests.length || !groupBy) return '_Missing dataset or group key._';
		try {
			const reps = computeRepresentative(tests, [groupBy], 50);
			return `**${reps.length}** groups grouped by \`${groupBy}\`.`;
		} catch {
			return '_Could not compute representative curves._';
		}
	}

	function renderScatterMd(b: Block): string {
		const tests = datasetStore.current?.tests ?? [];
		const xKey = (b.config?.xKey as string) ?? '—';
		const yProp = (b.config?.yProperty as string) ?? 'UTS';
		let n = 0;
		for (const t of tests) {
			const xv = Number(t.meta[xKey]);
			if (!Number.isFinite(xv)) continue;
			try {
				if (yProp === 'UTS') {
					findUTS({ strain: t.strain, stress: t.stress });
				} else if (yProp === 'E') {
					findUplLpl({ strain: t.strain, stress: t.stress });
				} else {
					const foot = findUplLpl({ strain: t.strain, stress: t.stress });
					findProofStress({ strain: t.strain, stress: t.stress }, foot.E);
				}
				n++;
			} catch {
				/* skip */
			}
		}
		return `**${yProp}** vs **${xKey}**, ${n} points.`;
	}

	function renderRambergOsgoodMd(): string {
		const tests = datasetStore.current?.tests ?? [];
		if (!tests.length) return '_No dataset loaded._';
		let n = 0;
		for (const t of tests) {
			try {
				const f = fitRambergOsgood({ strain: t.strain, stress: t.stress });
				if (Number.isFinite(f.C) && Number.isFinite(f.n)) n++;
			} catch {
				/* skip */
			}
		}
		return `**${n}** tests with fitted C, n.`;
	}

	function renderZenerHollomonMd(b: Block): string {
		const tests = datasetStore.current?.tests ?? [];
		if (!tests.length) return '_No dataset loaded._';
		const Q_kJmol = (b.config?.Q_kJmol as number) ?? 155;
		const flowStrain = (b.config?.flowStrain as number) ?? 0.3;
		try {
			const zh = computeZH(tests, { Q_kJmol, flowStrain });
			if (!zh) return '_Zener–Hollomon regression unavailable._';
			return `slope = **${zh.slope.toFixed(4)}**, intercept = **${zh.intercept.toFixed(4)}**, R² = **${zh.r2.toFixed(4)}** (${zh.points.length} tests).`;
		} catch {
			return '_Zener–Hollomon regression failed._';
		}
	}

	function renderNoteMd(b: Block): string {
		const text = (b.config?.text as string) ?? '';
		if (!text.trim()) return '_(empty note)_';
		// Quote the note as a blockquote for clarity.
		return text
			.split('\n')
			.map((ln) => `> ${ln}`)
			.join('\n');
	}

	function renderDatasetSummaryMd(): string {
		const ds = datasetStore.current;
		if (!ds) return '_No dataset loaded._';
		const lines: string[] = [];
		lines.push(`- **Name**: ${ds.name}`);
		lines.push(`- **Tests**: ${ds.tests.length}`);
		lines.push(`- **Info columns**: ${(ds.info_columns ?? []).join(', ') || '—'}`);
		if (ds.description) lines.push(`- **Description**: ${ds.description}`);
		return lines.join('\n');
	}

	function buildMarkdown(): string {
		const ds = datasetStore.current;
		const dsLine = ds
			? `Dataset: **${ds.name}** (${ds.tests.length} tests)`
			: 'Dataset: _none loaded_';
		const ts = new Date().toLocaleString();
		const out: string[] = [];
		out.push(`# paramaterial report`);
		out.push('');
		out.push(dsLine);
		out.push('');
		out.push(`_Exported ${ts}_`);
		out.push('');

		const list = blocksStore.list;
		list.forEach((b, i) => {
			const idx = i + 1;
			out.push(`## ${titleForBlock(b, idx)}`);
			out.push('');
			switch (b.type) {
				case 'dataset-picker':
					out.push(ds ? `Loaded: **${ds.name}** (${ds.tests.length} tests)` : '_No dataset picked._');
					break;
				case 'stress-strain':
					out.push(renderStressStrainMd(b));
					break;
				case 'foot-correction':
					out.push(renderFootCorrectionMd(b));
					break;
				case 'property-table':
					out.push(renderPropertyTableMd());
					break;
				case 'representative-curves':
					out.push(renderRepresentativeCurvesMd(b));
					break;
				case 'scatter':
					out.push(renderScatterMd(b));
					break;
				case 'ramberg-osgood':
					out.push(renderRambergOsgoodMd());
					break;
				case 'zener-hollomon':
					out.push(renderZenerHollomonMd(b));
					break;
				case 'note':
					out.push(renderNoteMd(b));
					break;
				default:
					// Handle "dataset-summary" or any future types.
					if ((b.type as string) === 'dataset-summary') {
						out.push(renderDatasetSummaryMd());
					} else {
						out.push(`_Block type \`${b.type}\` — no summary renderer._`);
					}
			}
			out.push('');
		});
		return out.join('\n');
	}

	function downloadMarkdown() {
		const md = buildMarkdown();
		const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `paramaterial-report-${timestamp()}.md`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
		open = false;
	}

	// ---------- Shareable link ----------

	interface PersistableBlock {
		id: string;
		type: string;
		title?: string;
		config: Record<string, unknown>;
	}

	function pickPersistable(b: Block): PersistableBlock {
		// Drop createdAt / other transient fields and JSON-round-trip config
		// to strip non-serializable values (functions, DOM nodes, etc.).
		let configCopy: Record<string, unknown> = {};
		try {
			configCopy = JSON.parse(JSON.stringify(b.config ?? {}));
		} catch {
			configCopy = {};
		}
		const out: PersistableBlock = {
			id: b.id,
			type: b.type,
			config: configCopy
		};
		if (b.title) out.title = b.title;
		return out;
	}

	const MAX_URL_LEN = 8000;

	async function copyLink() {
		const payload = {
			v: 1,
			blocks: blocksStore.list.map(pickPersistable),
			datasetId:
				datasetStore.current?.id && datasetStore.current.id !== 'upload'
					? datasetStore.current.id
					: null
		};
		const json = JSON.stringify(payload);
		let encoded: string;
		try {
			encoded = btoa(encodeURIComponent(json));
		} catch {
			showToast('Link encoding failed');
			open = false;
			return;
		}
		const url = `${location.origin}${location.pathname}?state=${encoded}`;
		if (url.length > MAX_URL_LEN) {
			showToast('Report too large to link — use Download JSON');
			open = false;
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			showToast('Link copied');
		} catch {
			// Fallback: stash on a prompt so the user can still copy manually.
			try {
				window.prompt('Copy the shareable link:', url);
				showToast('Link ready');
			} catch {
				showToast('Copy failed');
			}
		}
		open = false;
	}

	function clearAllAction() {
		if (!confirm('Clear the whole report and chat? This cannot be undone.')) return;
		blocksStore.clear();
		chatStore.clear();
		datasetStore.clear();
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="rounded-md border px-2 py-1 text-xs transition-colors"
		style="border-color: var(--border-default); color: var(--text-secondary);"
		aria-expanded={open}
		aria-haspopup="menu"
	>
		Export ▾
	</button>

	{#if open}
		<!-- click-outside overlay -->
		<button
			type="button"
			aria-label="Close menu"
			class="fixed inset-0 z-30 cursor-default bg-transparent"
			onclick={() => (open = false)}
		></button>
		<div
			role="menu"
			class="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border text-xs"
			style="background: var(--surface-card); border-color: var(--border-strong); box-shadow: var(--shadow-md);"
		>
			<button
				type="button"
				role="menuitem"
				onclick={downloadJSON}
				class="block w-full px-3 py-2 text-left transition-colors"
				style="color: var(--text-primary);"
			>
				Download JSON
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={downloadMarkdown}
				class="block w-full px-3 py-2 text-left transition-colors"
				style="color: var(--text-primary);"
			>
				Download Markdown
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={triggerImport}
				class="block w-full px-3 py-2 text-left transition-colors"
				style="color: var(--text-primary);"
			>
				Import JSON…
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={printReady}
				class="block w-full px-3 py-2 text-left transition-colors"
				style="color: var(--text-primary);"
			>
				Print-ready HTML
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={copyLink}
				class="block w-full px-3 py-2 text-left transition-colors"
				style="color: var(--text-primary);"
			>
				Copy link
			</button>
			<div style="border-top: 1px solid var(--border-default);"></div>
			<button
				type="button"
				role="menuitem"
				onclick={clearAllAction}
				class="block w-full px-3 py-2 text-left text-red-400 transition-colors"
			>
				Clear all
			</button>
		</div>
	{/if}

	<input
		bind:this={fileInput}
		type="file"
		accept="application/json,.json"
		class="hidden"
		onchange={handleImport}
	/>

	{#if toast}
		<div
			role="status"
			aria-live="polite"
			class="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs"
			style="background: var(--surface-card); border-color: var(--border-strong); color: var(--text-primary); box-shadow: var(--shadow-md);"
		>
			{toast}
		</div>
	{/if}
</div>
