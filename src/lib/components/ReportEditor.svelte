<script lang="ts">
	/**
	 * The block-scroll report editor — the body of the original +page.svelte.
	 * Works in two modes:
	 *   - Standalone (no report prop): autosaves to localStorage via the store
	 *     effect.roots (unchanged legacy behavior).
	 *   - Server-backed: caller passes `server` with patch()/name/etc and wraps
	 *     this in a lifecycle that hydrates stores + toggles inReportContext.
	 *
	 * Rendering is unchanged from the original flow.
	 */
	import { onMount } from 'svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import ChatPane from '$lib/components/ChatPane.svelte';
	import type { Block } from '$lib/stores/blocks.svelte';

	let { consumeShareState = true }: { consumeShareState?: boolean } = $props();

	let chatOpen = $state(false);

	const hasDataset = $derived(!!datasetStore.current);
	const onlyDatasetPicker = $derived(
		blocksStore.list.length === 1 && blocksStore.list[0].type === 'dataset-picker'
	);
	const showEmptyHint = $derived(hasDataset && onlyDatasetPicker);

	function consumeShareableState() {
		try {
			const params = new URLSearchParams(window.location.search);
			const encoded = params.get('state');
			if (!encoded) return;
			let json: string;
			try {
				json = decodeURIComponent(atob(encoded));
			} catch {
				return;
			}
			const data = JSON.parse(json) as {
				blocks?: Array<Partial<Block>>;
				datasetId?: string | null;
			};
			if (Array.isArray(data.blocks) && data.blocks.length) {
				const hydrated: Block[] = data.blocks.map((b, i) => ({
					id: b.id ?? `shared-${i}-${Date.now().toString(36)}`,
					type: (b.type as Block['type']) ?? 'note',
					title: b.title,
					config: (b.config as Record<string, unknown>) ?? {},
					createdAt: Date.now()
				}));
				blocksStore.replaceAll(hydrated);
			}
			if (typeof data.datasetId === 'string' && data.datasetId.length) {
				void datasetStore.load(data.datasetId);
			}
		} catch {
			/* ignore */
		} finally {
			try {
				const u = new URL(window.location.href);
				if (u.searchParams.has('state')) {
					u.searchParams.delete('state');
					history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
				}
			} catch {
				/* noop */
			}
		}
	}

	onMount(() => {
		if (consumeShareState) consumeShareableState();
		const mq = window.matchMedia('(min-width: 1024px)');
		function handleKey(e: KeyboardEvent) {
			if (!mq.matches) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const isEditable =
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable === true;
			if (e.key === 'Escape') {
				if (isEditable && target && 'blur' in target) {
					(target as HTMLElement).blur();
					e.preventDefault();
				}
				return;
			}
			const mod = e.metaKey || e.ctrlKey;
			if (!mod) return;
			if (e.key === 'k' || e.key === 'K') {
				e.preventDefault();
				const palette = document.getElementById('tool-palette');
				const firstBtn = document.getElementById('tool-palette-first');
				palette?.scrollIntoView({ behavior: 'smooth', block: 'end' });
				if (firstBtn) (firstBtn as HTMLButtonElement).focus();
				return;
			}
			if (e.key === '/') {
				e.preventDefault();
				chatOpen = true;
				requestAnimationFrame(() => {
					const ta = document.querySelector<HTMLTextAreaElement>(
						'textarea[placeholder*="analysis"]'
					);
					ta?.focus();
				});
				return;
			}
		}
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	});
</script>

{#if datasetStore.needsReupload}
	<div
		class="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs"
		style="background: rgb(120 60 10 / 0.22); border-color: rgb(160 100 30 / 0.4); color: #f2c88c;"
	>
		<span
			>Your previous dataset was an uploaded CSV — raw data isn't saved across reloads. Re-upload it
			in the first block to continue.</span
		>
		<button
			type="button"
			onclick={() => datasetStore.dismissReuploadNotice()}
			class="rounded border px-2 py-0.5 text-[11px]"
			style="border-color: rgb(160 100 30 / 0.55);"
		>
			Dismiss
		</button>
	</div>
{/if}

<div class="flex min-h-0 flex-1 overflow-hidden">
	<main class="relative flex min-h-0 min-w-0 flex-1 flex-col">
		<div class="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
			<div class="mx-auto flex max-w-4xl flex-col gap-6 pb-32">
				<div class="report-masthead">
					<p class="caption-eyebrow">Laboratory report</p>
					<h1
						class="report-title mt-1 text-3xl font-semibold"
						style="color: var(--text-primary); font-family: var(--font-serif); letter-spacing: -0.015em;"
					>
						{datasetStore.current?.name ?? 'An interactive materials report'}
					</h1>
					<p
						class="mt-2 text-sm italic"
						style="color: var(--text-secondary); font-family: var(--font-serif);"
					>
						{#if datasetStore.current}
							{datasetStore.current.tests.length} tests · compiled in-browser
						{:else}
							Pick a dataset to begin. Every block below is a figure, table, or note in a live
							engineering notebook.
						{/if}
					</p>
					<hr
						class="mt-4 border-0"
						style="height: 1px; background: linear-gradient(to right, var(--border-strong), transparent);"
					/>
				</div>
				{#each blocksStore.list as block, i (block.id)}
					<div id={`block-${block.id}`}>
						<BlockRenderer {block} index={i} />
					</div>
				{/each}
				{#if showEmptyHint}
					<div
						class="rounded-lg border border-dashed p-6 text-center"
						style="border-color: var(--border-default); background: color-mix(in srgb, var(--surface-card) 70%, transparent);"
					>
						<p class="text-sm" style="color: var(--text-secondary);">
							Pick a tool below, or ask the assistant <span aria-hidden="true">→</span>
						</p>
						<p
							class="mt-1 text-xs italic"
							style="color: var(--text-muted); font-family: var(--font-serif);"
						>
							Try "plot stress strain" or tap a tool in the palette.
						</p>
					</div>
				{/if}
				<p
					class="pt-2 text-center text-xs italic"
					style="color: var(--text-muted); font-family: var(--font-serif);"
				>
					— end of report —
				</p>
			</div>
		</div>

		<div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
			<div class="mx-auto max-w-4xl">
				<ToolPalette />
			</div>
		</div>

		<button
			type="button"
			onclick={() => (chatOpen = true)}
			aria-label="Open chat"
			class="absolute right-3 bottom-20 z-10 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg lg:hidden"
			style="background: var(--surface-raised); border-color: var(--border-strong); color: var(--text-primary);"
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			</svg>
		</button>
	</main>

	<aside
		class="fixed inset-y-0 right-0 z-[60] w-full max-w-sm transform shadow-xl transition-transform lg:static lg:z-auto lg:w-96 lg:shadow-none
		{chatOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}"
		style="background: var(--surface-page);"
	>
		{#if chatOpen}
			<button
				type="button"
				onclick={() => (chatOpen = false)}
				aria-label="Close chat"
				class="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-md lg:hidden"
				style="color: var(--text-secondary);"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		{/if}
		<ChatPane />
	</aside>
</div>
