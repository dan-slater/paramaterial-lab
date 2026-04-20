<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { findUplLpl } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	let testId = $state((config.testId as string) ?? '');

	$effect(() => {
		if (!tests.length) return;
		if (!testId || !tests.some((t) => t.test_id === testId)) {
			testId = tests[0].test_id;
		}
	});

	const test = $derived(tests.find((t) => t.test_id === testId));
	const fit = $derived.by(() => {
		if (!test) return null;
		try {
			return findUplLpl({ strain: test.strain, stress: test.stress });
		} catch {
			return null;
		}
	});

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !test || !fit) return;
		plot?.destroy();

		const n = test.strain.length;
		// y of elastic fit line: y = E*x + intercept, clipped where x is between limits
		const sx = test.strain;
		const sy = test.stress;
		const elasticY = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			// Extend the elastic line beyond the fit bounds for visibility
			elasticY[i] = fit.E * sx[i] + fit.intercept;
		}

		// Highlight mask: only inside [LPL, UPL]
		const hiX: number[] = [];
		const hiY: number[] = [];
		for (let i = fit.lplIdx; i <= fit.uplIdx && i < n; i++) {
			hiX.push(sx[i]);
			hiY.push(sy[i]);
		}

		// Align all series to the full strain axis by using NaN outside the window
		const hiAligned = new Array<number>(n).fill(NaN);
		for (let i = fit.lplIdx; i <= fit.uplIdx && i < n; i++) hiAligned[i] = sy[i];

		let yMin = Infinity, yMax = -Infinity;
		for (let i = 0; i < n; i++) {
			if (Number.isFinite(sy[i])) {
				if (sy[i] < yMin) yMin = sy[i];
				if (sy[i] > yMax) yMax = sy[i];
			}
		}
		const yPad = (yMax - yMin) * 0.05;

		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 360,
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
			legend: { show: false },
			series: [
				{ label: 'strain' },
				{ label: 'curve', stroke: '#6b7280', width: 1.2, points: { show: false } },
				{ label: 'elastic fit', stroke: '#f0f921', width: 1.5, dash: [5, 5], points: { show: false } },
				{ label: 'elastic region', stroke: '#e879f9', width: 2.5, points: { show: false } }
			]
		};

		plot = new uPlot(opts, [sx, sy, elasticY, hiAligned], container);
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
		test;
		fit;
		render();
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-xs uppercase tracking-wider text-neutral-500">Foot correction</p>
		<h2 class="mt-0.5 text-xl font-semibold tracking-tight">Elastic region + Young's modulus</h2>
		<p class="mt-1 text-sm text-neutral-400">
			Sliding-window linear fit finds UPL / LPL. E is the slope through the chosen window.
		</p>
	</div>
	{#if tests.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span class="text-neutral-500">Test</span>
			<select
				bind:value={testId}
				class="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs font-mono"
			>
				{#each tests as t (t.test_id)}
					<option value={t.test_id}>{t.test_id}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if fit}
	<div class="mt-3 grid gap-3 sm:grid-cols-3">
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">E</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">
				{fit.E.toFixed(0)} <span class="text-xs font-normal text-neutral-500">MPa</span>
			</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">UPL index</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{fit.uplIdx}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">LPL index</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{fit.lplIdx}</p>
		</div>
	</div>
{/if}
<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">Load a dataset above.</p>
	{:else if !fit}
		<p class="px-2 py-6 text-center text-sm text-red-400">Could not fit elastic region for this test.</p>
	{/if}
</div>
