<script lang="ts">
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import StressStrainPlot from '$lib/components/StressStrainPlot.svelte';
	import { findUplLpl } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	let colorBy = $state((config.colorBy as string) ?? '');
	let showOffset = $state<boolean>((config.showOffset as boolean) ?? false);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const tests = $derived(datasetStore.current?.tests ?? []);

	$effect(() => {
		if (!infoColumns.length) return;
		if (!colorBy || !infoColumns.includes(colorBy)) {
			colorBy = infoColumns.find((c) => /temp/i.test(c)) ?? infoColumns[0];
		}
	});

	// Compute E from first analyzable test for the offset line
	const offsetE = $derived.by<number | undefined>(() => {
		if (!showOffset) return undefined;
		for (const t of tests) {
			try {
				const foot = findUplLpl({ strain: t.strain, stress: t.stress });
				if (Number.isFinite(foot.E) && foot.E > 0) return foot.E;
			} catch {
				/* try next */
			}
		}
		return undefined;
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
	<div class="flex shrink-0 flex-wrap items-center gap-2 text-xs">
		<label class="flex items-center gap-1">
			<input type="checkbox" bind:checked={showOffset} class="accent-plasma-400" />
			<span class="text-neutral-400">Show 0.2% offset line</span>
		</label>
		{#if infoColumns.length}
			<label class="flex items-center gap-1">
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
</div>

{#if !tests.length}
	<p class="mt-3 text-sm text-neutral-500">Load a dataset above to populate this plot.</p>
{:else}
	<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
		<StressStrainPlot {tests} {colorBy} height={420} {showOffset} offsetStrain={0.002} {offsetE} />
	</div>
	{#if showOffset && offsetE !== undefined}
		<p class="mt-2 text-xs text-neutral-500">
			Offset line: y = <span class="text-plasma-400">{offsetE.toFixed(0)}</span> · (ε − 0.002)
		</p>
	{:else if showOffset}
		<p class="mt-2 text-xs text-neutral-500">Could not compute E for any test.</p>
	{/if}
{/if}
