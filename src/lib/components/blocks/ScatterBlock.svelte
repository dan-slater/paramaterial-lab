<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import uPlot from 'uplot';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { getParameterDefs } from '$lib/analyzers/registry';
	import { getPlotTheme } from '$lib/plotTheme';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const domain = $derived(datasetStore.current?.domain);
	const params = $derived(getParameterDefs(domain));

	// Both axes can reference either a meta column ("meta:col") or a computed
	// parameter ("param:key"). We use the prefix to disambiguate.
	const metaOptions = $derived(
		infoColumns.filter((c) => c !== 'test_id').map((c) => ({
			id: `meta:${c}`,
			label: c,
			group: 'Metadata'
		}))
	);
	const paramOptions = $derived(
		params.map((p) => ({
			id: `param:${p.key}`,
			label: p.label + (p.unit ? ` (${p.unit})` : ''),
			group: 'Computed'
		}))
	);
	const allOptions = $derived([...paramOptions, ...metaOptions]);

	let xId = $state((config.xId as string) ?? '');
	let yId = $state((config.yId as string) ?? '');

	// Sensible defaults per domain: pick first numeric meta for X, first param for Y.
	$effect(() => {
		if (!allOptions.length) return;
		const valid = new Set(allOptions.map((o) => o.id));
		if (!xId || !valid.has(xId)) {
			const tempCol = metaOptions.find((o) => /temp|rate|lat|beta|c_rate/i.test(o.label));
			xId = tempCol?.id ?? metaOptions[0]?.id ?? allOptions[0].id;
		}
		if (!yId || !valid.has(yId)) {
			yId = paramOptions[0]?.id ?? allOptions[0].id;
		}
	});

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const nextX = xId;
		const nextY = yId;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			blocksStore.update(id, { config: { ...config, xId: nextX, yId: nextY } });
		}, 200);
	});

	function resolve(tok: string, t: { meta: Record<string, unknown>; strain: number[]; stress: number[] }): number | null {
		if (!tok) return null;
		const [kind, key] = tok.split(':');
		if (kind === 'meta') {
			const v = Number(t.meta[key]);
			return Number.isFinite(v) ? v : null;
		}
		if (kind === 'param') {
			const p = params.find((pp) => pp.key === key);
			if (!p) return null;
			return p.extract({ strain: t.strain, stress: t.stress }, t.meta);
		}
		return null;
	}

	const points = $derived.by<Array<{ x: number; y: number }>>(() => {
		if (!xId || !yId) return [];
		const out: Array<{ x: number; y: number }> = [];
		for (const t of tests) {
			const x = resolve(xId, t);
			const y = resolve(yId, t);
			if (x === null || y === null) continue;
			out.push({ x, y });
		}
		return out;
	});

	const xLabel = $derived(allOptions.find((o) => o.id === xId)?.label ?? '');
	const yLabel = $derived(allOptions.find((o) => o.id === yId)?.label ?? '');

	let container: HTMLDivElement;
	let plot: uPlot | null = null;

	function render() {
		if (!container || !points.length) return;
		plot?.destroy();

		const sorted = points.slice().sort((a, b) => a.x - b.x);
		const x = sorted.map((p) => p.x);
		const y = sorted.map((p) => p.y);

		let yMin = Infinity, yMax = -Infinity;
		for (const v of y) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
		const yPad = (yMax - yMin) * 0.08 || 1;

		const t = getPlotTheme();
		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 340,
			scales: { x: { time: false }, y: { range: [yMin - yPad, yMax + yPad] } },
			axes: [
				{ label: xLabel, stroke: t.axis, grid: { stroke: t.grid, width: 1 }, ticks: { stroke: t.tick } },
				{ label: yLabel, stroke: t.axis, grid: { stroke: t.grid, width: 1 }, ticks: { stroke: t.tick } }
			],
			legend: { show: false },
			series: [
				{ label: xLabel },
				{
					label: yLabel,
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

<div class="flex flex-wrap items-start justify-between gap-4 pr-32">
	<div>
		<p class="caption-eyebrow">Parameter scatter</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			{yLabel || '—'} vs {xLabel || '—'}
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">{points.length} points.</p>
	</div>
	<div class="flex shrink-0 items-center gap-2 text-xs">
		<label class="flex items-center gap-1">
			<span style="color: var(--text-muted);">Y</span>
			<select
				bind:value={yId}
				class="max-w-[180px] rounded-md border px-2 py-1 text-xs"
				style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
			>
				<optgroup label="Computed">
					{#each paramOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
				</optgroup>
				<optgroup label="Metadata">
					{#each metaOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
				</optgroup>
			</select>
		</label>
		<label class="flex items-center gap-1">
			<span style="color: var(--text-muted);">X</span>
			<select
				bind:value={xId}
				class="max-w-[160px] rounded-md border px-2 py-1 text-xs"
				style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);"
			>
				<optgroup label="Metadata">
					{#each metaOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
				</optgroup>
				<optgroup label="Computed">
					{#each paramOptions as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
				</optgroup>
			</select>
		</label>
	</div>
</div>

<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
	<div bind:this={container} class="w-full"></div>
	{#if !tests.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
	{:else if !points.length}
		<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			No numeric values for the chosen axes.
		</p>
	{/if}
</div>
