<script lang="ts">
	import { goto } from '$app/navigation';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import StressStrainPlot from '$lib/components/StressStrainPlot.svelte';

	let colorBy = $state('temperature');

	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const tests = $derived(datasetStore.current?.tests ?? []);

	// When the loaded dataset's info_columns doesn't include the default colorBy,
	// fall back to the first usable column.
	$effect(() => {
		if (!infoColumns.length) return;
		if (!infoColumns.includes(colorBy)) colorBy = infoColumns[0];
	});
</script>

{#if !datasetStore.current}
	<div class="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
		<p class="text-neutral-400">No dataset loaded.</p>
		<button
			onclick={() => goto('/')}
			class="mt-3 rounded-md bg-plasma-600 px-4 py-2 text-sm font-medium text-white hover:bg-plasma-500"
		>
			Choose a dataset
		</button>
	</div>
{:else}
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-xs uppercase tracking-wider text-neutral-500">Step 1 — Prepare</p>
			<h1 class="text-2xl font-semibold tracking-tight">{datasetStore.current.name}</h1>
			<p class="mt-1 text-sm text-neutral-400">
				{tests.length} tests · {datasetStore.current.description}
			</p>
		</div>
		{#if infoColumns.length}
			<label class="flex items-center gap-2 text-sm">
				<span class="text-neutral-400">Color by</span>
				<select
					bind:value={colorBy}
					class="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
				>
					{#each infoColumns as col}
						<option value={col}>{col}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>

	<div class="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
		<StressStrainPlot {tests} {colorBy} height={520} />
	</div>

	<div class="mt-6 flex justify-end gap-2">
		<button
			onclick={() => goto('/process')}
			class="rounded-md bg-plasma-600 px-4 py-2 text-sm font-medium text-white hover:bg-plasma-500"
		>
			Next: Process →
		</button>
	</div>
{/if}
