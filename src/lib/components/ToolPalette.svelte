<script lang="ts">
	import { blocksStore, TOOLS, type BlockType } from '$lib/stores/blocks.svelte';
	import { tick } from 'svelte';

	async function addAndScroll(type: BlockType) {
		const b = blocksStore.add(type);
		await tick();
		const el = document.getElementById(`block-${b.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<div
	class="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/90 p-2 shadow-xl backdrop-blur"
>
	<span class="shrink-0 self-center pl-2 pr-1 text-[10px] uppercase tracking-wider text-neutral-500"
		>Add block</span
	>
	{#each TOOLS as t}
		<button
			type="button"
			onclick={() => addAndScroll(t.type)}
			title={t.description}
			class="group flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800/70 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-plasma-500 hover:bg-plasma-600 hover:text-white"
		>
			<span class="font-mono text-sm text-plasma-400 group-hover:text-white">{t.icon}</span>
			<span>{t.label}</span>
		</button>
	{/each}
</div>
