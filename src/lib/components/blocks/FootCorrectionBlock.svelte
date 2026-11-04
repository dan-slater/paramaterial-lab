<script lang="ts">
	import { untrack } from 'svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { useBlockDataset } from '$lib/stores/pipeline.svelte';
	import { FOOT_DEFAULT_PRELOAD, PM, footPreload, processingApplies } from '$lib/pipeline';
	import { findUplLplPreload } from '$lib/processing';
	import { getSeriesLabels } from '$lib/analyzers/registry';
	import { plasmaColorFor } from '$lib/plotTheme';
	import CurveCanvas, { type CurveLayer } from '$lib/components/CurveCanvas.svelte';
	import FootDiagnostic from './FootDiagnostic.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const data = useBlockDataset();
	const input = $derived(data.current);
	const output = $derived(data.output);
	// Palette-added blocks apply the shift; template-seeded ones (no `apply` key)
	// keep the single-test diagnostic until the reader switches it on.
	const apply = $derived(config.apply === true);
	const applies = $derived(processingApplies(input));
	const labels = $derived(getSeriesLabels(input));
	const preload = $derived(footPreload(config));

	function patch(p: Record<string, unknown>) {
		blocksStore.update(id, { config: { ...config, ...p } });
	}

	let preloadVal = $state(FOOT_DEFAULT_PRELOAD);
	$effect(() => {
		preloadVal = preload;
	});

	const colorKey = $derived(
		input?.info_columns.find((c) => /temp/i.test(c)) ?? input?.info_columns.find((c) => c !== 'test_id') ?? ''
	);
	const colorOf = $derived.by(() => {
		const all = (input?.tests ?? []).map((t) => t.meta[colorKey]);
		return (t: { meta: Record<string, unknown> }) => plasmaColorFor(t.meta[colorKey], all);
	});

	function median(v: number[]): number {
		if (!v.length) return NaN;
		const s = v.slice().sort((a, b) => a - b);
		const m = s.length >> 1;
		return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
	}

	const stats = $derived.by(() => {
		if (!output) return null;
		const shifts: number[] = [];
		const Es: number[] = [];
		let failed = 0;
		for (const t of output.tests) {
			if (t.meta[PM.footFailed]) failed++;
			const s = t.meta[PM.footShift];
			const E = t.meta[PM.E];
			if (typeof s === 'number') shifts.push(s);
			if (typeof E === 'number') Es.push(E);
		}
		return { n: output.tests.length, corrected: shifts.length, failed, shift: median(shifts), E: median(Es) };
	});

	// Overlay zoomed on the toe region, where the shift is visible.
	const xRange = $derived.by<[number, number] | null>(() => {
		if (!input || !output) return null;
		let lo = 0, hi = -Infinity;
		for (const d of [input, output])
			for (const t of d.tests)
				for (const e of t.strain) {
					if (e < lo) lo = e;
					if (e > hi) hi = e;
				}
		if (!Number.isFinite(hi)) return null;
		return [Math.max(lo, -0.004), Math.min(hi, 0.012)];
	});

	const layers = $derived.by<CurveLayer[]>(() => {
		if (!input || !output) return [];
		return [
			{ curves: input.tests.map((t) => ({ x: t.strain, y: t.stress, color: colorOf(t) })), alpha: 0.14, width: 1 },
			{ curves: output.tests.map((t) => ({ x: t.strain, y: t.stress, color: colorOf(t) })), alpha: 0.85, width: 1.2 }
		];
	});

	// ---- per-test inspector --------------------------------------------------
	let testId = $state(untrack(() => (config.testId as string) ?? ''));
	$effect(() => {
		const tests = input?.tests ?? [];
		if (tests.length && !tests.some((t) => t.test_id === testId)) testId = tests[0].test_id;
	});
	function pickTest(next: string) {
		testId = next;
		patch({ testId: next });
	}
	const before = $derived(input?.tests.find((t) => t.test_id === testId));
	const after = $derived(output?.tests.find((t) => t.test_id === testId));
	const fit = $derived(before ? findUplLplPreload(before, preload) : null);

	const one = $derived.by(() => {
		if (!before || !after || !fit) return null;
		const sh = fit.strainShift;
		const UPL = { x: fit.UPL[0] - sh, y: fit.UPL[1] };
		const LPL = { x: fit.LPL[0] - sh, y: fit.LPL[1] };
		const color = colorOf(before);
		let hi = -Infinity;
		for (const e of after.strain) if (e > hi) hi = e;
		// Show up to a little past the UPL so the fit window is readable.
		const xr: [number, number] = [Math.min(0, ...before.strain.slice(0, 1)), Math.min(hi, Math.max(0.006, UPL.x * 3))];
		return {
			UPL,
			LPL,
			xr,
			layers: [
				{ curves: [{ x: before.strain, y: before.stress, color }], alpha: 0.3, width: 1.2 },
				{ curves: [{ x: after.strain, y: after.stress, color }], alpha: 1, width: 1.6 }
			] as CurveLayer[],
			lines: [{ x0: UPL.x, y0: UPL.y, slope: fit.E, color, dash: [5, 4] }],
			markers: [
				{ ...UPL, color, label: 'UPL' },
				{ ...LPL, color, label: 'LPL' }
			]
		};
	});

	const fmtShift = (v: number) => (Number.isFinite(v) ? (v * 100).toFixed(3) + ' %' : '—');
	const fmtE = (v: number) => (Number.isFinite(v) ? (v / 1000).toFixed(1) : '—');
	const tileStyle = 'background: var(--surface-sunk); border-color: var(--border-default);';
	const inputStyle = 'background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);';
</script>

{#if !apply}
	<FootDiagnostic {id} {config} />
	{#if applies}
		<div
			class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
			style="border-color: var(--border-default); color: var(--text-secondary); background: var(--surface-raised);"
		>
			<span>Diagnostic only: the curves below are not shifted.</span>
			<button
				type="button"
				data-testid="foot-apply"
				onclick={() => patch({ apply: true })}
				class="rounded-md border px-2 py-1 text-xs transition-colors"
				style="border-color: var(--border-strong); color: var(--text-primary); background: var(--surface-chip);"
			>
				Apply to blocks below
			</button>
		</div>
	{/if}
{:else}
	<div class="pr-32">
		<p class="caption-eyebrow">Foot correction · processing</p>
		<h2 class="block-title mt-1 text-2xl font-semibold" style="color: var(--text-primary); letter-spacing: -0.01em;">
			Curves shifted so the elastic line meets the origin
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
			From the preload, UPL and LPL bound the straightest run of points; E is the slope between them. Every test is
			shifted by the strain where that line crosses zero stress, and the blocks below use this E.
		</p>
	</div>

	{#if input && !applies}
		<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			Foot correction acts on stress–strain data; this {labels.noun} dataset passes through unchanged.
		</p>
	{:else if input}
		<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style="color: var(--text-secondary);">
			<label class="flex items-center gap-2">
				<span>Preload</span>
				<input
					type="number"
					step="1"
					min="0"
					data-testid="foot-preload"
					class="w-20 rounded-md border px-2 py-1 text-xs tabular-nums"
					style={inputStyle}
					bind:value={preloadVal}
					onchange={() => Number.isFinite(preloadVal) && patch({ preload: preloadVal })}
				/>
				<span style="color: var(--text-muted);">MPa</span>
			</label>
			<label class="flex items-center gap-2">
				<input type="checkbox" checked={apply} onchange={(e) => patch({ apply: e.currentTarget.checked })} />
				<span>Apply to blocks below</span>
			</label>
		</div>

		{#if stats}
			<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">Corrected</p>
					<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);" data-testid="foot-corrected">
						{stats.corrected}<span class="text-xs font-normal" style="color: var(--text-muted);">&nbsp;of {stats.n}</span>
					</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">Median shift</p>
					<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">{fmtShift(stats.shift)}</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">Median E</p>
					<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">
						{fmtE(stats.E)} <span class="text-xs font-normal" style="color: var(--text-muted);">GPa</span>
					</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">No fit</p>
					<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">{stats.failed}</p>
				</div>
			</div>
		{/if}

		<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
			<CurveCanvas {layers} {xRange} height={320} xLabel={labels.x} yLabel={labels.y} ariaLabel="Toe region before (faint) and after the foot correction" />
			<p class="px-1 pt-1 text-[11px]" style="color: var(--text-muted);">
				Toe region, all tests. Faint: before. Solid: shifted, as the blocks below receive them.
			</p>
		</div>

		<div class="mt-5 flex flex-wrap items-end justify-between gap-3">
			<div>
				<p class="caption-eyebrow" style="font-size: 10px;">Per-test fit</p>
				<p class="caption-note text-sm">Dashed: the elastic line through LPL and UPL.</p>
			</div>
			<label class="flex items-center gap-2 text-xs">
				<span style="color: var(--text-muted);">Test</span>
				<select
					value={testId}
					data-testid="foot-test"
					onchange={(e) => pickTest(e.currentTarget.value)}
					class="rounded-md border px-2 py-1 font-mono text-xs"
					style={inputStyle}
				>
					{#each input.tests as t (t.test_id)}
						<option value={t.test_id}>{t.test_id}</option>
					{/each}
				</select>
			</label>
		</div>
		{#if one && fit}
			<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">E</p>
					<p class="mt-1 text-base font-semibold tabular-nums" style="color: var(--text-primary);">
						{fit.E.toFixed(0)} <span class="text-xs font-normal" style="color: var(--text-muted);">MPa</span>
					</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">Shift</p>
					<p class="mt-1 text-base font-semibold tabular-nums" style="color: var(--text-primary);">{fmtShift(-fit.strainShift)}</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">UPL stress</p>
					<p class="mt-1 text-base font-semibold tabular-nums" style="color: var(--text-primary);">
						{one.UPL.y.toFixed(1)} <span class="text-xs font-normal" style="color: var(--text-muted);">MPa</span>
					</p>
				</div>
				<div class="rounded-md border px-3 py-2" style={tileStyle}>
					<p class="caption-eyebrow" style="font-size: 10px;">LPL stress</p>
					<p class="mt-1 text-base font-semibold tabular-nums" style="color: var(--text-primary);">
						{one.LPL.y.toFixed(1)} <span class="text-xs font-normal" style="color: var(--text-muted);">MPa</span>
					</p>
				</div>
			</div>
			<div class="mt-3 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
				<CurveCanvas
					layers={one.layers}
					lines={one.lines}
					markers={one.markers}
					xRange={one.xr}
					height={280}
					xLabel={labels.x}
					yLabel={labels.y}
					ariaLabel={`Foot-correction fit for ${testId}`}
				/>
			</div>
		{:else if before}
			<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
				No elastic fit above the {preload} MPa preload for {testId}; it passes through unshifted.
			</p>
		{/if}
	{:else}
		<p class="mt-4 px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
	{/if}
{/if}
