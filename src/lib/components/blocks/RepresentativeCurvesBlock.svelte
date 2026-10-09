<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { computeRepresentative } from '$lib/processing';
	import { getPlotTheme } from '$lib/plotTheme';
	import { getSeriesLabels } from '$lib/analyzers/registry';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const labels = $derived(getSeriesLabels(datasetStore.current));
	const xLabel = $derived(labels.x);
	const yLabel = $derived(labels.y);
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

		const t = getPlotTheme();
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
					label: xLabel,
					stroke: t.axis,
					grid: { stroke: t.grid, width: 1 },
					ticks: { stroke: t.tick }
				},
				{
					label: yLabel,
					stroke: t.axis,
					grid: { stroke: t.grid, width: 1 },
					ticks: { stroke: t.tick }
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
		<p class="caption-eyebrow">Representative curves</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			Mean per group, shown as single lines
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
			Grouped by
			<span style="color: var(--color-plasma-400); font-style: normal;">{groupBy || '—'}</span>
			· {reps.length} groups.
		</p>
	</div>
	{#if infoColumns.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span style="color: var(--text-muted);">Group by</span>
			<select
				bind:value={groupBy}
				class="rounded-md border px-2 py-1 text-xs"
				style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
			>
				{#each infoColumns.filter((c) => c !== 'test_id') as col}
					<option value={col}>{col}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
	{:else if !reps.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			No groups could be formed from the selected key.
		</p>
	{/if}
</div>
