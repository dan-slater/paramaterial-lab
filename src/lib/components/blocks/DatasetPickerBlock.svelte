<script lang="ts">
	import { PRESET_DATASETS } from '$lib/datasets';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import CsvImportPanel from '$lib/components/CsvImportPanel.svelte';

	async function selectPreset(id: string) {
		await datasetStore.load(id);
	}

	const groups = [
		{ label: null, items: PRESET_DATASETS.filter((d) => d.headline) },
		{ label: 'Thesis case studies', items: PRESET_DATASETS.filter((d) => !d.headline) }
	];
	const currentPreset = $derived(PRESET_DATASETS.find((d) => d.id === datasetStore.current?.id));
</script>

{#if datasetStore.current}
	<div class="pr-32">
		<p class="caption-eyebrow">Dataset</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			{datasetStore.current.name}
		</h2>
		<p
			class="caption-note mt-1 text-sm"
			style="color: var(--text-secondary);"
		>
			{datasetStore.current.tests.length} tests · {datasetStore.current.description}
		</p>
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<button
				onclick={() => datasetStore.clear()}
				class="rounded-md border px-3 py-1.5 text-xs transition-colors"
				style="border-color: var(--border-default); color: var(--text-secondary);"
			>
				Change dataset
			</button>
			{#if currentPreset}
				<a
					href="/lab/{currentPreset.slug}"
					class="text-xs underline underline-offset-2"
					style="color: var(--text-muted);"
					data-testid="preset-link">Link to this preset: /lab/{currentPreset.slug}</a
				>
			{/if}
		</div>
	</div>
{:else}
	<p class="caption-eyebrow">Start here</p>
	<h2
		class="block-title mt-1 text-2xl font-semibold"
		style="color: var(--text-primary); letter-spacing: -0.01em;"
	>
		Choose a dataset
	</h2>
	<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
		Pick a preset or import your own CSV. Subsequent blocks will draw from this dataset.
	</p>

	{#each groups as g}
	{#if g.label}<p class="caption-eyebrow mt-4">{g.label}</p>{/if}
	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each g.items as ds (ds.id)}
			<button
				type="button"
				onclick={() => selectPreset(ds.id)}
				class="group rounded-md border p-3 text-left transition-colors"
				style="border-color: var(--border-default); background: var(--surface-sunk);"
				onmouseenter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-ui-strong)'; }}
				onmouseleave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; }}
			>
				<div class="flex items-start justify-between gap-2">
					<h3
						class="text-sm font-semibold"
						style="font-family: var(--font-serif); color: var(--text-primary);"
					>
						{ds.name}
					</h3>
					<span
						class="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
						style="background: var(--surface-chip); color: var(--text-muted);"
					>
						{ds.tests}
					</span>
				</div>
				<p
					class="mt-1 text-xs line-clamp-2 italic"
					style="color: var(--text-secondary); font-family: var(--font-serif);"
				>
					{ds.description}
				</p>
			</button>
		{/each}
	</div>
	{/each}

	<CsvImportPanel />
	{#if datasetStore.loading}
		<p class="mt-2 text-xs" style="color: var(--text-muted);">Loading…</p>
	{/if}
	{#if datasetStore.error}
		<p class="mt-2 text-xs text-red-400">{datasetStore.error}</p>
	{/if}
{/if}
