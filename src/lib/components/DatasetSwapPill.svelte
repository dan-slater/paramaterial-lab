<script lang="ts">
	/**
	 * Small "dataset: <name> ▾" pill next to the report title. Clicking opens
	 * a popover preset list; selecting one swaps `datasetStore` to the new
	 * preset and calls `onChange(newRef)` so the parent can PATCH the report.
	 */
	import { PRESET_DATASETS } from '$lib/datasets';
	import { datasetStore } from '$lib/stores/dataset.svelte';

	let {
		datasetRef,
		onChange
	}: {
		datasetRef: string | null;
		onChange: (ref: string | null) => void;
	} = $props();

	let open = $state(false);

	function currentName(): string {
		const ds = datasetStore.current;
		if (ds) return ds.name;
		if (datasetRef && datasetRef.startsWith('upload:'))
			return datasetRef.slice('upload:'.length);
		if (datasetRef) {
			const preset = PRESET_DATASETS.find((p) => p.id === datasetRef);
			if (preset) return preset.name;
		}
		return 'No dataset';
	}

	async function pick(id: string) {
		open = false;
		await datasetStore.load(id);
		onChange(id);
	}
</script>

<div class="relative inline-block">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-haspopup="menu"
		class="rounded-full border px-3 py-1 text-xs transition-colors"
		style="border-color: var(--border-default); color: var(--text-secondary); background: var(--surface-chip);"
	>
		<span class="caption-eyebrow mr-1">Dataset</span>
		<span style="color: var(--text-primary); font-family: var(--font-serif);">{currentName()}</span>
		<span aria-hidden="true" class="ml-1">▾</span>
	</button>

	{#if open}
		<button
			type="button"
			aria-label="Close"
			onclick={() => (open = false)}
			class="fixed inset-0 z-30 cursor-default bg-transparent"
		></button>
		<div
			role="menu"
			class="absolute left-0 z-40 mt-1 w-72 overflow-hidden rounded-md border text-xs"
			style="background: var(--surface-card); border-color: var(--border-strong); box-shadow: var(--shadow-md);"
		>
			{#each PRESET_DATASETS as p (p.id)}
				<button
					type="button"
					role="menuitem"
					onclick={() => pick(p.id)}
					class="block w-full border-b px-3 py-2 text-left transition-colors last:border-b-0"
					style="border-color: var(--border-default); color: var(--text-primary);"
				>
					<span class="block" style="font-family: var(--font-serif);">{p.name}</span>
					<span class="block text-[11px]" style="color: var(--text-muted);"
						>{p.tests} tests · {p.description}</span
					>
				</button>
			{/each}
		</div>
	{/if}
</div>
