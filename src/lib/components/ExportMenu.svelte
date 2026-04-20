<script lang="ts">
	import { blocksStore, type Block } from '$lib/stores/blocks.svelte';
	import { chatStore, type ChatMessage } from '$lib/stores/chat.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';

	let open = $state(false);
	let fileInput: HTMLInputElement;

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
		// Strip hover-only controls, then replace canvases with <img> data-URLs and
		// serialize the rest. Tables are kept as-is so they render without JS.
		const clone = article.cloneNode(true) as HTMLElement;
		// Remove the floating #N / Remove overlay (not useful in a static export).
		clone.querySelectorAll('.opacity-0').forEach((el) => el.remove());
		// Replace clone canvases with images sourced from the *live* canvas.
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
		// Replace textareas with their rendered text (note blocks).
		clone.querySelectorAll('textarea').forEach((ta, i) => {
			const liveTa = article.querySelectorAll('textarea')[i] as HTMLTextAreaElement | undefined;
			const val = liveTa?.value ?? (ta as HTMLTextAreaElement).value ?? '';
			const p = document.createElement('p');
			p.textContent = val;
			p.style.whiteSpace = 'pre-wrap';
			ta.replaceWith(p);
		});
		// Remove buttons/selects since the static doc can't act on them.
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
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, system-ui, sans-serif; background: #fafafa; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  .block { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 16px; position: relative; }
  .n { position: absolute; top: 8px; right: 12px; font-size: 11px; color: #999; }
  article { all: unset; display: block; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
  th { background: #f3f3f3; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 4px 0; }
  img { display: block; }
  @media print { body { background: #fff; } .block { break-inside: avoid; border-color: #ccc; } }
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
		class="rounded-md border border-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
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
			class="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 text-xs shadow-xl"
		>
			<button
				type="button"
				role="menuitem"
				onclick={downloadJSON}
				class="block w-full px-3 py-2 text-left text-neutral-200 hover:bg-neutral-800"
			>
				Download JSON
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={triggerImport}
				class="block w-full px-3 py-2 text-left text-neutral-200 hover:bg-neutral-800"
			>
				Import JSON…
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={printReady}
				class="block w-full px-3 py-2 text-left text-neutral-200 hover:bg-neutral-800"
			>
				Print-ready HTML
			</button>
			<div class="border-t border-neutral-800"></div>
			<button
				type="button"
				role="menuitem"
				onclick={clearAllAction}
				class="block w-full px-3 py-2 text-left text-red-300 hover:bg-red-900/40"
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
</div>
