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
	id="tool-palette"
	class="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-xl border p-2 backdrop-blur"
	style="background: color-mix(in srgb, var(--surface-raised) 92%, transparent); border-color: var(--border-default); box-shadow: var(--shadow-md);"
>
	<span
		class="caption-eyebrow shrink-0 self-center pl-2 pr-1"
		style="font-size: 10px;">Add block</span
	>
	{#each TOOLS as t, i}
		<button
			type="button"
			id={i === 0 ? 'tool-palette-first' : undefined}
			onclick={() => addAndScroll(t.type)}
			title={t.description}
			class="group flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors focus:outline-none"
			style="background: var(--surface-chip); border-color: var(--border-default); color: var(--text-secondary);"
			onmouseenter={(e) => {
				const el = e.currentTarget as HTMLButtonElement;
				el.style.borderColor = 'var(--accent-ui-strong)';
				el.style.background = 'var(--surface-card-hover)';
				el.style.color = 'var(--text-primary)';
			}}
			onmouseleave={(e) => {
				const el = e.currentTarget as HTMLButtonElement;
				el.style.borderColor = 'var(--border-default)';
				el.style.background = 'var(--surface-chip)';
				el.style.color = 'var(--text-secondary)';
			}}
			onfocus={(e) => {
				const el = e.currentTarget as HTMLButtonElement;
				el.style.boxShadow = '0 0 0 2px var(--accent-ui-strong)';
			}}
			onblur={(e) => {
				(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
			}}
		>
			<span class="font-mono text-sm" style="color: var(--accent-ui-strong);">{t.icon}</span>
			<span>{t.label}</span>
		</button>
	{/each}
</div>
