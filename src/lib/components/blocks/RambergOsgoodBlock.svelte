<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { fitRambergOsgood, type RambergOsgoodFit } from '$lib/processing';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	let previewTestId = $state((config.previewTestId as string) ?? '');

	$effect(() => {
		if (!tests.length) return;
		if (!previewTestId || !tests.some((t) => t.test_id === previewTestId)) {
			previewTestId = tests[0].test_id;
		}
	});

	// Per-test fits
	const fits = $derived.by<Array<{ testId: string; fit: RambergOsgoodFit }>>(() => {
		const out: Array<{ testId: string; fit: RambergOsgoodFit }> = [];
		for (const t of tests) {
			try {
				const f = fitRambergOsgood({ strain: t.strain, stress: t.stress });
				out.push({ testId: t.test_id, fit: f });
			} catch {
				/* skip */
			}
		}
		return out;
	});

	const previewTest = $derived(tests.find((t) => t.test_id === previewTestId));
	const previewFit = $derived(fits.find((f) => f.testId === previewTestId)?.fit ?? null);

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !previewTest || !previewFit) return;
		plot?.destroy();

		const sx = previewTest.strain;
		const sy = previewTest.stress;
		const n = sx.length;

		// Fitted curve: σ = C · ε^n  (over positive strain range, clipped to data bounds)
		const fitY = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			const e = sx[i];
			fitY[i] = e > 0 && Number.isFinite(previewFit.n) && Number.isFinite(previewFit.C)
				? previewFit.C * Math.pow(e, previewFit.n)
				: NaN;
		}

		let yMin = Infinity, yMax = -Infinity;
		for (let i = 0; i < n; i++) {
			if (Number.isFinite(sy[i])) {
				if (sy[i] < yMin) yMin = sy[i];
				if (sy[i] > yMax) yMax = sy[i];
			}
		}
		const yPad = (yMax - yMin) * 0.05 || 1;

		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 340,
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
				{ label: 'raw', stroke: '#6b7280', width: 1.2, points: { show: false } },
				{ label: 'C·ε^n fit', stroke: '#f0f921', width: 1.8, dash: [5, 5], points: { show: false } }
			]
		};
		plot = new uPlot(opts, [sx, sy, fitY], container);
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
		previewTest;
		previewFit;
		render();
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-xs uppercase tracking-wider text-neutral-500">Ramberg–Osgood</p>
		<h2 class="mt-0.5 text-xl font-semibold tracking-tight">Power-law fit σ = C·ε<sup>n</sup></h2>
		<p class="mt-1 text-sm text-neutral-400">
			Log-log OLS on plastic region (0.2% proof → UTS). {fits.length} tests fit.
		</p>
	</div>
	{#if tests.length}
		<label class="flex shrink-0 items-center gap-2 text-xs">
			<span class="text-neutral-500">Preview</span>
			<select
				bind:value={previewTestId}
				class="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs font-mono"
			>
				{#each tests as t (t.test_id)}
					<option value={t.test_id}>{t.test_id}</option>
				{/each}
			</select>
		</label>
	{/if}
</div>

{#if previewFit && Number.isFinite(previewFit.n)}
	<div class="mt-3 grid gap-3 sm:grid-cols-3">
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">C</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{previewFit.C.toFixed(2)}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">n</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{previewFit.n.toFixed(4)}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
			<p class="text-xs text-neutral-500">R²</p>
			<p class="text-lg font-semibold tabular-nums text-neutral-100">{previewFit.r2.toFixed(4)}</p>
		</div>
	</div>
{/if}

<div class="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm text-neutral-500">Load a dataset above.</p>
	{:else if !previewFit || !Number.isFinite(previewFit.n)}
		<p class="px-2 py-6 text-center text-sm text-red-400">Could not fit this test (insufficient plastic-region points).</p>
	{/if}
</div>

{#if fits.length}
	<div class="mt-3 max-h-72 overflow-auto rounded-md border border-neutral-800">
		<table class="w-full text-xs">
			<thead class="sticky top-0 bg-neutral-900 text-neutral-400">
				<tr>
					<th class="px-3 py-1.5 text-left font-medium">test_id</th>
					<th class="px-3 py-1.5 text-right font-medium">C</th>
					<th class="px-3 py-1.5 text-right font-medium">n</th>
					<th class="px-3 py-1.5 text-right font-medium">R²</th>
				</tr>
			</thead>
			<tbody class="tabular-nums">
				{#each fits as row (row.testId)}
					<tr class="border-t border-neutral-800">
						<td class="px-3 py-1 font-mono text-neutral-300">{row.testId}</td>
						<td class="px-3 py-1 text-right">{Number.isFinite(row.fit.C) ? row.fit.C.toFixed(2) : '—'}</td>
						<td class="px-3 py-1 text-right">{Number.isFinite(row.fit.n) ? row.fit.n.toFixed(4) : '—'}</td>
						<td class="px-3 py-1 text-right">{Number.isFinite(row.fit.r2) ? row.fit.r2.toFixed(4) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
