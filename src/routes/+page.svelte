<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import BlockRenderer from '$lib/components/BlockRenderer.svelte';
	import ToolPalette from '$lib/components/ToolPalette.svelte';
	import ChatPane from '$lib/components/ChatPane.svelte';

	let chatOpen = $state(false);
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

<div class="flex min-h-0 flex-1 overflow-hidden">
	<main class="relative flex min-h-0 flex-1 flex-col">
		<div class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
			<div class="mx-auto flex max-w-4xl flex-col gap-5 pb-32">
				{#each blocksStore.list as block, i (block.id)}
					<div id={`block-${block.id}`}>
						<BlockRenderer {block} index={i} />
					</div>
				{/each}
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
