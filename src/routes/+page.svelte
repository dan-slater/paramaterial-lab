<script lang="ts">
	import { onMount } from 'svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import ChatPane from '$lib/components/ChatPane.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import TemplatePicker from '$lib/components/TemplatePicker.svelte';
	import type { Block } from '$lib/stores/blocks.svelte';

	const THEME_KEY = 'paramaterial:theme:v1';
	let chatOpen = $state(false);
	let theme = $state<'dark' | 'light'>('dark');

	// Show an empty-state hint once a dataset is loaded but the user hasn't
	// added any tool blocks yet.
	const hasDataset = $derived(!!datasetStore.current);
	const onlyDatasetPicker = $derived(
		blocksStore.list.length === 1 && blocksStore.list[0].type === 'dataset-picker'
	);
	const showEmptyHint = $derived(hasDataset && onlyDatasetPicker);

	function applyTheme(t: 'dark' | 'light') {
		theme = t;
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', t);
		}
		try {
			localStorage.setItem(THEME_KEY, t);
		} catch {
			/* ignore */
		}
	}

	function toggleTheme() {
		applyTheme(theme === 'dark' ? 'light' : 'dark');
	}

	// If the URL carries ?state=..., decode it into the blocks store once on mount
	// and rehydrate the referenced dataset, then strip the query param so the
	// shareable-link behavior is a one-shot seed rather than a sticky mode.
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
			// Ignore malformed share links — fall through to the normal load.
		} finally {
			// Strip the query param whether or not decode succeeded; it's single-use.
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
		// Sync local state with the early-applied document attribute.
		const attr = document.documentElement.getAttribute('data-theme');
		theme = attr === 'light' ? 'light' : 'dark';

		consumeShareableState();
		const mq = window.matchMedia('(min-width: 1024px)');

		function handleKey(e: KeyboardEvent) {
			// Desktop-only shortcuts
			if (!mq.matches) return;

			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const isEditable =
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable === true;

			// Esc: blur any editable element. Don't intercept otherwise.
			if (e.key === 'Escape') {
				if (isEditable && target && 'blur' in target) {
					(target as HTMLElement).blur();
					e.preventDefault();
				}
				return;
			}

			const mod = e.metaKey || e.ctrlKey;
			if (!mod) return;

			// Cmd/Ctrl-K: focus tool palette (scroll + focus first tool button)
			if (e.key === 'k' || e.key === 'K') {
				e.preventDefault();
				const palette = document.getElementById('tool-palette');
				const firstBtn = document.getElementById('tool-palette-first');
				palette?.scrollIntoView({ behavior: 'smooth', block: 'end' });
				if (firstBtn) (firstBtn as HTMLButtonElement).focus();
				return;
			}

			// Cmd/Ctrl-/: focus chat textarea
			if (e.key === '/') {
				e.preventDefault();
				chatOpen = true;
				// Allow the aside to mount/become visible before focusing.
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

<header
	class="flex shrink-0 items-center justify-between border-b px-4 py-2.5 backdrop-blur"
	style="background: color-mix(in srgb, var(--surface-raised) 88%, transparent); border-color: var(--border-default);"
>
	<a
		href="/"
		class="flex items-center gap-2 text-base font-semibold tracking-tight"
		style="color: var(--text-primary);"
	>
		<span
			class="inline-block h-5 w-5 rounded"
			style="background: linear-gradient(135deg, var(--color-plasma-400), var(--color-plasma-700));"
			aria-hidden="true"
		></span>
		<span class="font-serif" style="letter-spacing: -0.01em;">paramaterial</span>
	</a>
	<div class="flex items-center gap-2 text-xs" style="color: var(--text-muted);">
		{#if datasetStore.current}
			<span class="hidden sm:inline">
				{datasetStore.current.name} · {datasetStore.current.tests.length} tests
			</span>
		{:else}
			<span class="hidden sm:inline">No dataset loaded</span>
		{/if}
		<TemplatePicker />
		<ExportMenu />
		<button
			type="button"
			onclick={toggleTheme}
			aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
			aria-pressed={theme === 'light'}
			title={theme === 'dark' ? 'Light (paper) theme' : 'Dark theme'}
			class="rounded-md border px-2 py-1 text-xs transition-colors"
			style="border-color: var(--border-default); color: var(--text-secondary); background: transparent;"
		>
			{#if theme === 'dark'}
				<!-- sun -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-3.5 w-3.5"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="4"></circle>
					<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
				</svg>
			{:else}
				<!-- moon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-3.5 w-3.5"
					aria-hidden="true"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (chatOpen = !chatOpen)}
			class="rounded-md border px-2 py-1 text-xs transition-colors lg:hidden"
			style="border-color: var(--border-default); color: var(--text-secondary);"
			aria-pressed={chatOpen}
		>
			{chatOpen ? 'Hide chat' : 'Chat'}
		</button>
	</div>
</header>

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
	<main class="relative flex min-h-0 flex-1 flex-col">
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
						<p class="mt-1 text-xs italic" style="color: var(--text-muted); font-family: var(--font-serif);">
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
	</main>

	<aside
		class="fixed inset-y-0 right-0 z-20 w-full max-w-sm transform shadow-xl transition-transform lg:static lg:w-96 lg:shadow-none
		{chatOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}"
		style="background: var(--surface-page);"
	>
		<ChatPane />
	</aside>
</div>
