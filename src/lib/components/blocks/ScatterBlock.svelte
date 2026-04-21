<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { findUTS, findUplLpl, findProofStress } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	let xKey = $state((config.xKey as string) ?? '');
	let yProperty = $state<'UTS' | 'E' | 'PS'>((config.yProperty as 'UTS' | 'E' | 'PS') ?? 'UTS');

	$effect(() => {
		if (!infoColumns.length) return;
		if (!xKey || !infoColumns.includes(xKey)) {
			xKey = infoColumns.find((c) => /temp/i.test(c)) ?? infoColumns[0];
		}
	});

	const points = $derived.by<Array<{ x: number; y: number }>>(() => {
		const out: Array<{ x: number; y: number }> = [];
		for (const t of tests) {
			const xv = Number(t.meta[xKey]);
			if (!Number.isFinite(xv)) continue;
			try {
				if (yProperty === 'UTS') {
					out.push({ x: xv, y: findUTS({ strain: t.strain, stress: t.stress }).UTS });
				} else if (yProperty === 'E') {
					out.push({ x: xv, y: findUplLpl({ strain: t.strain, stress: t.stress }).E });
				} else {
					const foot = findUplLpl({ strain: t.strain, stress: t.stress });
					out.push({ x: xv, y: findProofStress({ strain: t.strain, stress: t.stress }, foot.E).proofStress });
				}
			} catch {
				/* skip */
			}
		}
		return out;
	});

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !points.length) return;
		plot?.destroy();

		// sort by x so we can use a line-capable x-axis; disable lines, show points
		const sorted = points.slice().sort((a, b) => a.x - b.x);
		const x = sorted.map((p) => p.x);
		const y = sorted.map((p) => p.y);

		let yMin = Infinity, yMax = -Infinity;
		for (const v of y) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
		const yPad = (yMax - yMin) * 0.08 || 1;

		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 340,
			scales: { x: { time: false }, y: { range: [yMin - yPad, yMax + yPad] } },
			axes: [
				{ label: xKey, stroke: '#9ca3af', grid: { stroke: '#27272a', width: 1 }, ticks: { stroke: '#3f3f46' } },
				{ label: `${yProperty} (MPa)`, stroke: '#9ca3af', grid: { stroke: '#27272a', width: 1 }, ticks: { stroke: '#3f3f46' } }
			],
			legend: { show: false },
			series: [
				{ label: xKey },
				{
					label: yProperty,
					stroke: '#e879f9',
					width: 0,
					points: { show: true, size: 6, stroke: '#e879f9', fill: '#e879f9' }
				}
			]
		};
		plot = new uPlot(opts, [x, y], container);
	}

	onMount(() => {
		render();
		const ro = new ResizeObserver(() => {
			if (plot && container) plot.setSize({ width: container.clientWidth, height: 340 });
		});
		if (container) ro.observe(container);
		return () => ro.disconnect();
	});
	$effect(() => {
		if (container && !plot) render();
	});
	onDestroy(() => plot?.destroy());
	$effect(() => {
		points;
		render();
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="caption-eyebrow">Parameter scatter</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			{yProperty} vs {xKey || '—'}
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">{points.length} points.</p>
	</div>
	<div class="flex shrink-0 items-center gap-2 text-xs">
		<label class="flex items-center gap-1">
			<span style="color: var(--text-muted);">Y</span>
			<select
				bind:value={yProperty}
				class="rounded-md border px-2 py-1 text-xs"
				style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
			>
				<option value="UTS">UTS</option>
				<option value="E">E</option>
				<option value="PS">Proof stress</option>
			</select>
		</label>
		{#if infoColumns.length}
			<label class="flex items-center gap-1">
				<span style="color: var(--text-muted);">X</span>
				<select
					bind:value={xKey}
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
</div>

<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
	{:else if !points.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			No numeric values for the chosen X key.
		</p>
	{/if}
</div>
