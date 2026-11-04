<script lang="ts">
	import { untrack } from 'svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { useBlockDataset } from '$lib/stores/pipeline.svelte';
	import { processingApplies, trimConfig } from '$lib/pipeline';
	import { getSeriesLabels } from '$lib/analyzers/registry';
	import { plasmaColorFor } from '$lib/plotTheme';
	import CurveCanvas, { type CurveLayer } from '$lib/components/CurveCanvas.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const data = useBlockDataset();
	const input = $derived(data.current);
	const output = $derived(data.output);
	const applies = $derived(processingApplies(input));
	const opts = $derived(trimConfig(config));
	const labels = $derived(getSeriesLabels(input));

	function patch(p: Record<string, unknown>) {
		blocksStore.update(id, { config: { ...config, ...p } });
	}

	// Each condition has an on/off switch and a value; off is stored as null so a
	// saved report reads exactly what was applied.
	const upperOn = $derived(opts.maxStrain !== null);
	const lowerOn = $derived(opts.minStrain !== null);
	const floorOn = $derived(opts.stressFloor !== null);
	const last = (k: string, d: number) => untrack(() => (typeof config[k] === 'number' ? (config[k] as number) : d));
	let upperVal = $state(last('lastMaxStrain', 0.01));
	let lowerVal = $state(last('lastMinStrain', 0));
	let floorVal = $state(last('lastStressFloor', 0));
	$effect(() => {
		if (opts.maxStrain !== null) upperVal = opts.maxStrain;
		if (opts.minStrain !== null) lowerVal = opts.minStrain;
		if (opts.stressFloor !== null) floorVal = opts.stressFloor;
	});

	function setNum(key: 'maxStrain' | 'minStrain' | 'stressFloor', on: boolean, v: number) {
		const last = { maxStrain: 'lastMaxStrain', minStrain: 'lastMinStrain', stressFloor: 'lastStressFloor' }[key];
		patch({ [key]: on && Number.isFinite(v) ? v : null, [last]: v });
	}

	const stats = $derived.by(() => {
		if (!input || !output) return null;
		let before = 0, after = 0, emptied = 0;
		for (const t of input.tests) before += t.strain.length;
		for (const t of output.tests) {
			after += t.strain.length;
			if (t.strain.length === 0) emptied++;
		}
		return { before, after, emptied, tests: output.tests.length };
	});

	const colorKey = $derived(
		input?.info_columns.find((c) => /temp/i.test(c)) ?? input?.info_columns.find((c) => c !== 'test_id') ?? ''
	);

	const layers = $derived.by<CurveLayer[]>(() => {
		if (!input || !output) return [];
		const all = input.tests.map((t) => t.meta[colorKey]);
		const col = (t: { meta: Record<string, unknown> }) => plasmaColorFor(t.meta[colorKey], all);
		return [
			{
				curves: input.tests.map((t) => ({ x: t.strain, y: t.stress, color: col(t) })),
				alpha: 0.14,
				width: 1
			},
			{
				curves: output.tests.map((t) => ({ x: t.strain, y: t.stress, color: col(t) })),
				alpha: 0.85,
				width: 1.3
			}
		];
	});

	// Zoom on what is kept (the faint curves beyond it show what was cut); the
	// full range is a toggle. View state only, not part of the trim.
	let fullRange = $state(false);
	const xRange = $derived.by<[number, number] | null>(() => {
		if (fullRange || !input || !output) return null;
		let lo = Infinity, hi = -Infinity, all = -Infinity;
		for (const t of output.tests) for (const e of t.strain) { if (e < lo) lo = e; if (e > hi) hi = e; }
		for (const t of input.tests) for (const e of t.strain) if (e > all) all = e;
		if (!Number.isFinite(hi) || hi >= all * 0.7) return null;
		const pad = (hi - lo) * 0.5;
		return [lo, Math.min(all, hi + pad)];
	});

	const title = $derived.by(() => {
		const parts: string[] = [];
		if (opts.minStrain !== null && opts.maxStrain !== null) parts.push(`${opts.minStrain} ≤ ε < ${opts.maxStrain}`);
		else if (opts.maxStrain !== null) parts.push(`ε < ${opts.maxStrain}`);
		else if (opts.minStrain !== null) parts.push(`ε ≥ ${opts.minStrain}`);
		if (opts.stressFloor !== null) parts.push(`σ ≥ ${opts.stressFloor} MPa`);
		if (opts.cut === 'uts') parts.push('up to UTS');
		if (opts.cut === 'fracture') parts.push('up to fracture');
		return parts.length ? `Keep ${parts.join(', ')}` : 'No trim set';
	});

	const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
	const inputCls =
		'w-24 rounded-md border px-2 py-1 text-xs tabular-nums disabled:opacity-40';
	const inputStyle =
		'background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary);';
</script>

<div class="pr-32">
	<p class="caption-eyebrow">Trim · processing</p>
	<h2 class="block-title mt-1 text-2xl font-semibold" style="color: var(--text-primary); letter-spacing: -0.01em;">
		{title}
	</h2>
	<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
		Every block below sees the trimmed curves. UTS and fracture strain are measured before the trim and carried
		down, as the thesis notebook does.
	</p>
</div>

{#if input && !applies}
	<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
		Trim acts on stress–strain data; this {labels.noun} dataset passes through unchanged.
	</p>
{:else}
	<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style="color: var(--text-secondary);">
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				data-testid="trim-upper-on"
				checked={upperOn}
				onchange={(e) => setNum('maxStrain', e.currentTarget.checked, upperVal)}
			/>
			<span>Strain below</span>
			<input
				type="number"
				step="0.001"
				data-testid="trim-upper"
				class={inputCls}
				style={inputStyle}
				disabled={!upperOn}
				bind:value={upperVal}
				onchange={() => setNum('maxStrain', true, upperVal)}
			/>
		</label>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={lowerOn}
				onchange={(e) => setNum('minStrain', e.currentTarget.checked, lowerVal)}
			/>
			<span>Strain from</span>
			<input
				type="number"
				step="0.001"
				class={inputCls}
				style={inputStyle}
				disabled={!lowerOn}
				bind:value={lowerVal}
				onchange={() => setNum('minStrain', true, lowerVal)}
			/>
		</label>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={floorOn}
				onchange={(e) => setNum('stressFloor', e.currentTarget.checked, floorVal)}
			/>
			<span>Stress floor</span>
			<input
				type="number"
				step="1"
				class={inputCls}
				style={inputStyle}
				disabled={!floorOn}
				bind:value={floorVal}
				onchange={() => setNum('stressFloor', true, floorVal)}
			/>
			<span style="color: var(--text-muted);">MPa</span>
		</label>
		<label class="flex items-center gap-2">
			<span>Cut</span>
			<select
				class="rounded-md border px-2 py-1 text-xs"
				style={inputStyle}
				value={opts.cut}
				onchange={(e) => patch({ cut: e.currentTarget.value })}
			>
				<option value="none">none</option>
				<option value="uts">after UTS</option>
				<option value="fracture">at fracture</option>
			</select>
		</label>
	</div>

	{#if stats}
		<div class="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
			<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
				<p class="caption-eyebrow" style="font-size: 10px;">Points kept</p>
				<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);" data-testid="trim-kept">
					{stats.after.toLocaleString()}
					<span class="text-xs font-normal" style="color: var(--text-muted);">of {stats.before.toLocaleString()}</span>
				</p>
			</div>
			<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
				<p class="caption-eyebrow" style="font-size: 10px;">Share kept</p>
				<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">{pct(stats.after, stats.before)}</p>
			</div>
			<div class="rounded-md border px-3 py-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
				<p class="caption-eyebrow" style="font-size: 10px;">Tests</p>
				<p class="mt-1 text-lg font-semibold tabular-nums" style="color: var(--text-primary);">
					{stats.tests}
					{#if stats.emptied}
						<span class="text-xs font-normal" style="color: var(--text-muted);">· {stats.emptied} left empty</span>
					{/if}
				</p>
			</div>
		</div>
	{/if}

	<div class="mt-4 rounded-md border p-2" style="background: var(--surface-sunk); border-color: var(--border-default);">
		{#if input}
			<CurveCanvas {layers} {xRange} height={340} xLabel={labels.x} yLabel={labels.y} ariaLabel="Curves before (faint) and after the trim" />
			<div class="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-[11px]" style="color: var(--text-muted);">
				<span>Faint: before the trim. Solid: what the blocks below receive.</span>
				<label class="flex items-center gap-1.5">
					<input type="checkbox" bind:checked={fullRange} />
					<span>Full strain range</span>
				</label>
			</div>
		{:else}
			<p class="px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
		{/if}
	</div>
{/if}
