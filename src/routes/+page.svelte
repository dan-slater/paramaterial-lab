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

	let chatOpen = $state(false);

	// Show an empty-state hint once a dataset is loaded but the user hasn't
	// added any tool blocks yet.
	const hasDataset = $derived(!!datasetStore.current);
	const onlyDatasetPicker = $derived(
		blocksStore.list.length === 1 && blocksStore.list[0].type === 'dataset-picker'
	);
	const showEmptyHint = $derived(hasDataset && onlyDatasetPicker);

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
	class="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/70 px-4 py-2.5 backdrop-blur"
>
	<a href="/" class="flex items-center gap-2 text-base font-semibold tracking-tight">
		<span class="inline-block h-5 w-5 rounded bg-gradient-to-br from-plasma-400 to-plasma-700"></span>
		paramaterial
	</a>
	<div class="flex items-center gap-2 text-xs text-neutral-500">
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
			onclick={() => (chatOpen = !chatOpen)}
			class="rounded-md border border-neutral-800 px-2 py-1 text-xs hover:bg-neutral-800 lg:hidden"
			aria-pressed={chatOpen}
		>
			{chatOpen ? 'Hide chat' : 'Chat'}
		</button>
	</div>
</header>

{#if datasetStore.needsReupload}
	<div class="flex items-center justify-between gap-3 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
		<span>Your previous dataset was an uploaded CSV — raw data isn't saved across reloads. Re-upload it in the first block to continue.</span>
		<button
			type="button"
			onclick={() => datasetStore.dismissReuploadNotice()}
			class="rounded border border-amber-800/60 px-2 py-0.5 text-[11px] hover:bg-amber-900/40"
		>
			Dismiss
		</button>
	</div>
{/if}

<div class="flex min-h-0 flex-1 overflow-hidden">
	<main class="relative flex min-h-0 flex-1 flex-col">
		<div class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
			<div class="mx-auto flex max-w-4xl flex-col gap-5 pb-32">
				{#each blocksStore.list as block, i (block.id)}
					<div id={`block-${block.id}`}>
						<BlockRenderer {block} index={i} />
					</div>
				{/each}
				{#if showEmptyHint}
					<div
						class="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 p-5 text-center"
					>
						<p class="text-sm text-neutral-400">
							Pick a tool below, or ask the assistant <span aria-hidden="true">→</span>
						</p>
						<p class="mt-1 text-xs text-neutral-600">
							Try "plot stress strain" or tap a tool in the palette.
						</p>
					</div>
				{/if}
				<p class="pt-2 text-center text-xs text-neutral-600">
					End of report · add a block below or ask the assistant
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
		class="fixed inset-y-0 right-0 z-20 w-full max-w-sm transform bg-neutral-950 shadow-xl transition-transform lg:static lg:w-96 lg:shadow-none
		{chatOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}"
	>
		<ChatPane />
	</aside>
</div>
