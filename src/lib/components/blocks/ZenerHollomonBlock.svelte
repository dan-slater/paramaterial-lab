<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { computeZH } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);

	let Q_kJmol = $state<number>((config.Q_kJmol as number) ?? 155);
	let flowStrain = $state<number>((config.flowStrain as number) ?? 0.3);

	const hasMeta = $derived.by(() => {
		for (const t of tests) {
			const r = Number(t.meta.rate ?? t.meta.strain_rate);
			const tC = Number(t.meta.temperature ?? t.meta.temp);
			if (Number.isFinite(r) && r > 0 && Number.isFinite(tC)) return true;
		}
		return false;
	});

	const zh = $derived.by(() => {
		if (!tests.length || !hasMeta) return null;
		try {
			return computeZH(tests, { Q_kJmol, flowStrain });
		} catch {
			return null;
		}
	});

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !zh || !zh.points.length) return;
		plot?.destroy();

		// Sort by lnZ so the line series draws monotonic
		const sorted = zh.points.slice().sort((a, b) => a.lnZ - b.lnZ);
		const x = sorted.map((p) => p.lnZ);
		const y = sorted.map((p) => p.lnSigma);

		// Regression line across full x-range
		const xMin = x[0];
		const xMax = x[x.length - 1];
		const lineX = [xMin, xMax];
		const lineY = [zh.slope * xMin + zh.intercept, zh.slope * xMax + zh.intercept];

		// Align both series onto a common x-axis. We create a combined x = points x
		// plus the two endpoints; points get NaN at endpoint positions and vice-versa.
		const allX: number[] = [...x];
		// Ensure endpoints are at the extremes (they already are).
		const pointsY = new Array<number>(allX.length);
		for (let i = 0; i < allX.length; i++) pointsY[i] = y[i];
		const lineYAll = new Array<number>(allX.length);
		for (let i = 0; i < allX.length; i++) {
			lineYAll[i] = zh.slope * allX[i] + zh.intercept;
		}

		let yMin = Infinity, yMax = -Infinity;
		for (const v of y) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
		for (const v of lineY) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
		const yPad = (yMax - yMin) * 0.08 || 0.1;

		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 360,
			scales: { x: { time: false }, y: { range: [yMin - yPad, yMax + yPad] } },
			axes: [
				{ label: 'ln Z', stroke: '#9ca3af', grid: { stroke: '#27272a', width: 1 }, ticks: { stroke: '#3f3f46' } },
				{ label: 'ln σ', stroke: '#9ca3af', grid: { stroke: '#27272a', width: 1 }, ticks: { stroke: '#3f3f46' } }
			],
			legend: { show: false },
			series: [
				{ label: 'lnZ' },
				{
					label: 'points',
					stroke: '#e879f9',
					width: 0,
					points: { show: true, size: 6, stroke: '#e879f9', fill: '#e879f9' }
				},
				{
					label: 'fit',
					stroke: '#f0f921',
					width: 1.8,
					dash: [5, 5],
					points: { show: false }
				}
			]
		};
		plot = new uPlot(opts, [allX, pointsY, lineYAll], container);
	}

	onMount(() => {
		render();
		const ro = new ResizeObserver(() => {
			if (plot && container) plot.setSize({ width: container.clientWidth, height: 360 });
		});
		if (container) ro.observe(container);
		return () => ro.disconnect();
	});
	$effect(() => {
		if (container && !plot) render();
	});
	onDestroy(() => plot?.destroy());
	$effect(() => {
		zh;
		render();
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-xs uppercase tracking-wider text-neutral-500">Zener–Hollomon</p>
		<h2 class="mt-0.5 text-xl font-semibold tracking-tight">ln σ = a · ln Z + b</h2>
		<p class="mt-1 text-sm text-neutral-400">
			Z = ε̇ · exp(Q / (R·T<sub>K</sub>)), flow stress from curve at ε = {flowStrain}.
		</p>
	</div>
	<div class="flex shrink-0 flex-wrap items-center gap-2 text-xs">
		<label class="flex items-center gap-1">
			<span class="text-neutral-500">Q (kJ/mol)</span>
			<input
				type="number"
				bind:value={Q_kJmol}
				step="5"
				class="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
			/>
		</label>
		<label class="flex items-center gap-1">
			<span class="text-neutral-500">ε</span>
			<input
				type="number"
				bind:value={flowStrain}
				step="0.05"
				min="0"
				class="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
			/>
		</label>
	</div>
</div>

{#if zh}
	<div class="mt-3 grid gap-3 sm:grid-cols-3">
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">slope a</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{zh.slope.toFixed(4)}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">intercept b</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{zh.intercept.toFixed(4)}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">R²</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{zh.r2.toFixed(4)}</p>
		</div>
	</div>
	<p class="mt-2 text-xs text-neutral-400">
		ln σ = <span class="text-plasma-400">{zh.slope.toFixed(4)}</span> · ln Z +
		<span class="text-plasma-400">{zh.intercept.toFixed(4)}</span>
		<span class="text-neutral-500"> ({zh.points.length} tests)</span>
	</p>
{/if}

<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">Load a dataset above.</p>
	{:else if !hasMeta}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">
			This dataset lacks <span class="font-mono">rate</span> or <span class="font-mono">temperature</span> metadata — Zener–Hollomon needs both.
		</p>
	{:else if !zh}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">
			No tests reach the chosen flow-strain ε = {flowStrain}. Try lowering it.
		</p>
	{/if}
</div>
