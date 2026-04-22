<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { findUplLpl } from '$lib/processing';
	import { getPlotTheme } from '$lib/plotTheme';

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

		const t = getPlotTheme();
		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 360,
			scales: { x: { time: false }, y: { range: [yMin - yPad, yMax + yPad] } },
			axes: [
				{
					label: 'Strain',
					stroke: t.axis,
					grid: { stroke: t.grid, width: 1 },
					ticks: { stroke: t.tick }
				},
				{
					label: 'Stress (MPa)',
					stroke: t.axis,
					grid: { stroke: t.grid, width: 1 },
					ticks: { stroke: t.tick }
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
		<p class="caption-eyebrow">Foot correction</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			Elastic region + Young's modulus
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
			Sliding-window linear fit finds UPL / LPL. E is the slope through the chosen window.
		</p>
	</div>
	{#if tests.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span style="color: var(--text-muted);">Test</span>
			<select
				bind:value={testId}
				class="rounded-md border px-2 py-1 text-xs font-mono"
				style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
			>
				{#each tests as t (t.test_id)}
					<option value={t.test_id}>{t.test_id}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if fit}
	<div class="mt-4 grid gap-3 sm:grid-cols-3">
		<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
			<p class="caption-eyebrow" style="font-size: 10px;">E</p>
			<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">
				{fit.E.toFixed(0)} <span class="text-xs font-normal" style="color: var(--text-muted);">MPa</span>
			</p>
		</div>
		<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
			<p class="caption-eyebrow" style="font-size: 10px;">UPL index</p>
			<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">{fit.uplIdx}</p>
		</div>
		<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
			<p class="caption-eyebrow" style="font-size: 10px;">LPL index</p>
			<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">{fit.lplIdx}</p>
		</div>
	</div>
{/if}
<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
	{:else if !fit}
		<p class="px-2 py-6 text-center text-sm text-red-400">Could not fit elastic region for this test.</p>
	{/if}
</div>
