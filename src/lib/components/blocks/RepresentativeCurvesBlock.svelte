<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { computeRepresentative } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	let groupBy = $state((config.groupBy as string) ?? '');

	$effect(() => {
		if (!infoColumns.length) return;
		if (!groupBy || !infoColumns.includes(groupBy)) {
			groupBy = infoColumns.find((c) => /temp/i.test(c)) ?? infoColumns[0];
		}
	});

	const reps = $derived.by(() => {
		if (!tests.length || !groupBy) return [];
		try {
			return computeRepresentative(tests, [groupBy], 150);
		} catch {
			return [];
		}
	});

	const palette = ['#6a00a8', '#8f0da4', '#b12a90', '#cc4778', '#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'];

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !reps.length) return;
		plot?.destroy();

		// build common x = first rep's strain grid (they all use the same grid)
		const x = reps[0].strain;
		const data: uPlot.AlignedData = [x];
		const series: uPlot.Series[] = [{ label: 'strain' }];
		let yMin = Infinity, yMax = -Infinity;
		reps.forEach((r, i) => {
			const color = palette[Math.floor((i / Math.max(1, reps.length - 1)) * (palette.length - 1))];
			data.push(r.mean);
			series.push({
				label: `${r.key} (n=${r.n})`,
				stroke: color,
				width: 2,
				points: { show: false }
			});
			for (const v of r.mean) {
				if (Number.isFinite(v)) {
					if (v < yMin) yMin = v;
					if (v > yMax) yMax = v;
				}
			}
			for (const v of r.max) if (Number.isFinite(v) && v > yMax) yMax = v;
			for (const v of r.min) if (Number.isFinite(v) && v < yMin) yMin = v;
		});
		const yPad = (yMax - yMin) * 0.05;

		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 400,
			scales: { x: { time: false }, y: { range: [yMin - yPad, yMax + yPad] } },
			axes: [
				{
					label: 'Strain',
					stroke: '#9ca3af',
					grid: { stroke: '#27272a', width: 1 },
					ticks: { stroke: '#3f3f46' }
				},
				{
					label: 'Stress (MPa)',
					stroke: '#9ca3af',
					grid: { stroke: '#27272a', width: 1 },
					ticks: { stroke: '#3f3f46' }
				}
			],
			legend: { show: true },
			series
		};
		plot = new uPlot(opts, data, container);
	}

	onMount(() => {
		render();
		const ro = new ResizeObserver(() => {
			if (plot && container) plot.setSize({ width: container.clientWidth, height: 400 });
		});
		if (container) ro.observe(container);
		return () => ro.disconnect();
	});
	$effect(() => {
		if (container && !plot) render();
	});
	onDestroy(() => plot?.destroy());
	$effect(() => {
		reps;
		render();
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-xs uppercase tracking-wider text-neutral-500">Representative curves</p>
		<h2 class="mt-0.5 text-xl font-semibold tracking-tight">Mean per group, shown as single lines</h2>
		<p class="mt-1 text-sm text-neutral-400">
			Grouped by <span class="text-plasma-400">{groupBy || '—'}</span> · {reps.length} groups.
		</p>
	</div>
	{#if infoColumns.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span class="text-neutral-500">Group by</span>
			<select
				bind:value={groupBy}
				class="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
			>
				{#each infoColumns.filter((c) => c !== 'test_id') as col}
					<option value={col}>{col}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">Load a dataset above.</p>
	{:else if !reps.length}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">
			No groups could be formed from the selected key.
		</p>
	{/if}
</div>
