<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';

	interface Props {
		id: string;
		index: number;
		total: number;
		variant?: 'full' | 'index-only';
	}

	let { id, index, total, variant = 'full' }: Props = $props();

	// Dataset-picker is assumed at index 0; non-dataset blocks can move within [1..total-1].
	const canMoveUp = $derived(variant === 'full' && index > 1);
	const canMoveDown = $derived(variant === 'full' && index < total - 1);
</script>

<div
	class="absolute right-2 top-2 z-[2] flex h-8 items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900/90 px-1 shadow-sm backdrop-blur"
	role="toolbar"
	aria-label="Block controls"
>
	<span
		class="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] leading-none text-neutral-400"
		title="Block index"
	>
		#{index + 1}
	</span>

	{#if variant === 'full'}
		<button
			type="button"
			onclick={() => blocksStore.move(id, 'up')}
			disabled={!canMoveUp}
			title="Move up"
			aria-label="Move block up"
			class="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-800 hover:text-plasma-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path
					d="M3 7.5L6 4.5L9 7.5"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		<button
			type="button"
			onclick={() => blocksStore.move(id, 'down')}
			disabled={!canMoveDown}
			title="Move down"
			aria-label="Move block down"
			class="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-800 hover:text-plasma-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path
					d="M3 4.5L6 7.5L9 4.5"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
		<button
			type="button"
			onclick={() => blocksStore.duplicate(id)}
			title="Duplicate"
			aria-label="Duplicate block"
			class="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition hover:bg-neutral-800 hover:text-plasma-300"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<rect
					x="2"
					y="2"
					width="6"
					height="6"
					rx="1"
					stroke="currentColor"
					stroke-width="1.5"
				/>
				<rect
					x="4"
					y="4"
					width="6"
					height="6"
					rx="1"
					stroke="currentColor"
					stroke-width="1.5"
					fill="rgb(23 23 23)"
				/>
			</svg>
		</button>
		<button
			type="button"
			onclick={() => blocksStore.remove(id)}
			title="Remove"
			aria-label="Remove block"
			class="inline-flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition hover:bg-red-900/70 hover:text-red-200"
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path
					d="M3 3L9 9M9 3L3 9"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	{/if}
</div>
