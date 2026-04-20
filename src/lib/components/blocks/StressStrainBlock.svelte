<script lang="ts">
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import StressStrainPlot from '$lib/components/StressStrainPlot.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	let colorBy = $state((config.colorBy as string) ?? '');
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const tests = $derived(datasetStore.current?.tests ?? []);

	$effect(() => {
		if (!infoColumns.length) return;
		if (!colorBy || !infoColumns.includes(colorBy)) {
			colorBy = infoColumns.find((c) => /temp/i.test(c)) ?? infoColumns[0];
		}
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-xs uppercase tracking-wider text-neutral-500">Stress–strain</p>
		<h2 class="mt-0.5 text-xl font-semibold tracking-tight">
			All tests: stress vs strain
		</h2>
		<p class="mt-1 text-sm text-neutral-400">
			{tests.length} curves, color-mapped by <span class="text-plasma-400">{colorBy || '—'}</span>.
		</p>
	</div>
	{#if infoColumns.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span class="text-neutral-500">Color by</span>
			<select
				bind:value={colorBy}
				class="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
			>
				{#each infoColumns as col}
					<option value={col}>{col}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if !tests.length}
	<p class="mt-3 text-sm text-neutral-500">Load a dataset above to populate this plot.</p>
{:else}
	<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
		<StressStrainPlot {tests} {colorBy} height={420} />
	</div>
{/if}
