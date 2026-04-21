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
	class="absolute right-3 top-3 z-[2] flex h-8 items-center gap-1 rounded-md border px-1 backdrop-blur"
	style="background: color-mix(in srgb, var(--surface-raised) 88%, transparent); border-color: var(--border-default); box-shadow: var(--shadow-sm);"
	role="toolbar"
	aria-label="Block controls"
>
	<span
		class="rounded px-1.5 py-0.5 font-mono text-[10px] leading-none"
		style="background: var(--surface-chip); color: var(--text-muted);"
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
			class="inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30"
			style="color: var(--text-muted);"
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
			class="inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30"
			style="color: var(--text-muted);"
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
			class="inline-flex h-6 w-6 items-center justify-center rounded transition-colors"
			style="color: var(--text-muted);"
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
					fill="var(--surface-card)"
				/>
			</svg>
		</button>
		<button
			type="button"
			onclick={() => blocksStore.remove(id)}
			title="Remove"
			aria-label="Remove block"
			class="inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:text-red-400"
			style="color: var(--text-muted);"
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
