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
	let hiddenGroups = $state<Set<string>>(new Set());
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const tests = $derived(datasetStore.current?.tests ?? []);

	$effect(() => {
		if (!infoColumns.length) return;
		if (!colorBy || !infoColumns.includes(colorBy)) {
			colorBy = infoColumns.find((c) => /temp/i.test(c)) ?? infoColumns[0];
		}
	});

	// Reset isolation + hidden groups if colorBy changes.
	$effect(() => {
		colorBy;
		hiddenGroups = new Set();
	});

	// Palette must mirror StressStrainPlot's palette for legend swatches.
	const palette = [
		'#6a00a8', '#8f0da4', '#b12a90', '#cc4778',
		'#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'
	];

	function swatchFor(value: unknown, all: unknown[]): string {
		const nums = all.map(Number).filter((v) => !Number.isNaN(v));
		if (nums.length && !Number.isNaN(Number(value))) {
			const min = Math.min(...nums);
			const max = Math.max(...nums);
			const t = max === min ? 0.5 : (Number(value) - min) / (max - min);
			const idx = Math.min(palette.length - 1, Math.max(0, Math.floor(t * (palette.length - 1))));
			return palette[idx];
		}
		const unique = Array.from(new Set(all.map(String)));
		const idx = unique.indexOf(String(value));
		return palette[idx % palette.length];
	}

	interface LegendItem {
		value: string;
		color: string;
		count: number;
	}

	const legendItems = $derived.by<LegendItem[]>(() => {
		if (!tests.length || !colorBy) return [];
		const allVals = tests.map((t) => t.meta[colorBy]);
		const counts = new Map<string, number>();
		for (const v of allVals) {
			const key = String(v ?? '');
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		const seenValues: unknown[] = [];
		const seen = new Set<string>();
		for (const v of allVals) {
			const key = String(v ?? '');
			if (!seen.has(key)) {
				seen.add(key);
				seenValues.push(v);
			}
		}
		// Sort numeric-ish values ascending, else alpha
		const asNums = seenValues.map((v) => Number(v));
		const allNumeric = asNums.every((n) => !Number.isNaN(n));
		if (allNumeric) {
			seenValues.sort((a, b) => Number(a) - Number(b));
		} else {
			seenValues.sort((a, b) => String(a).localeCompare(String(b)));
		}
		return seenValues.map((v) => ({
			value: String(v ?? ''),
			color: swatchFor(v, allVals),
			count: counts.get(String(v ?? '')) ?? 0
		}));
	});

	function toggleGroup(value: string) {
		const next = new Set(hiddenGroups);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		hiddenGroups = next;
	}

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
		<StressStrainPlot
			{tests}
			{colorBy}
			height={420}
			{showOffset}
			offsetStrain={0.002}
			{offsetE}
			{hiddenGroups}
		/>
	</div>
	<p class="mt-2 text-[11px] text-neutral-500">
		Hover a curve for details · click to isolate · click the background to reset.
	</p>
	{#if legendItems.length}
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each legendItems as item (item.value)}
				{@const hidden = hiddenGroups.has(item.value)}
				<button
					type="button"
					onclick={() => toggleGroup(item.value)}
					class="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] transition hover:border-neutral-700 {hidden
						? 'opacity-40'
						: ''}"
					title="Toggle {colorBy} = {item.value}"
				>
					<span
						class="inline-block h-2.5 w-2.5 rounded-sm"
						style="background: {item.color}; {hidden ? 'filter: grayscale(1);' : ''}"
					></span>
					<span class="tabular-nums text-neutral-300">{item.value || '—'}</span>
					<span class="text-neutral-500">({item.count})</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if showOffset && offsetE !== undefined}
		<p class="mt-2 text-xs text-neutral-500">
			Offset line: y = <span class="text-plasma-400">{offsetE.toFixed(0)}</span> · (ε − 0.002)
		</p>
	{:else if showOffset}
		<p class="mt-2 text-xs text-neutral-500">Could not compute E for any test.</p>
	{/if}
{/if}
