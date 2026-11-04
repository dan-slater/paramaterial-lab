<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { useBlockDataset } from '$lib/stores/pipeline.svelte';
	import { modulusOf, processingApplies, proofStressOf, screenFlags, screenRejected } from '$lib/pipeline';
	import { getSeriesLabels } from '$lib/analyzers/registry';
	import { plasmaColorFor } from '$lib/plotTheme';
	import CurveCanvas, { type CurveLayer } from '$lib/components/CurveCanvas.svelte';
	import type { Test } from '$lib/datasets';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const data = useBlockDataset();
	const input = $derived(data.current);
	const applies = $derived(processingApplies(input));
	const labels = $derived(getSeriesLabels(input));
	const tests = $derived(input?.tests ?? []);

	// Rejected ids live in the block config, so a saved report or a reload keeps them.
	const rejected = $derived(new Set(screenRejected(config)));
	const flags = $derived(applies ? screenFlags(tests) : new Map<string, string[]>());
	const rejectedHere = $derived(tests.filter((t) => rejected.has(t.test_id)).length);
	const flaggedOpen = $derived(tests.filter((t) => flags.has(t.test_id) && !rejected.has(t.test_id)));

	function save(next: Set<string>) {
		blocksStore.update(id, { config: { ...config, rejected: [...next].sort() } });
	}
	function toggle(testId: string) {
		const next = new Set(rejected);
		if (next.has(testId)) next.delete(testId);
		else next.add(testId);
		save(next);
	}
	function rejectFlagged() {
		const next = new Set(rejected);
		for (const t of flaggedOpen) next.add(t.test_id);
		save(next);
	}
	function clearAll() {
		save(new Set());
	}

	let filter = $state<'all' | 'flagged' | 'rejected'>('all');
	const shown = $derived(
		filter === 'flagged'
			? tests.filter((t) => flags.has(t.test_id))
			: filter === 'rejected'
				? tests.filter((t) => rejected.has(t.test_id))
				: tests
	);

	const colorKey = $derived(
		input?.info_columns.find((c) => /temp/i.test(c)) ?? input?.info_columns.find((c) => c !== 'test_id') ?? ''
	);
	const allColorVals = $derived(tests.map((t) => t.meta[colorKey]));

	// Label each card with the metadata a reader screens by.
	const metaKeys = $derived(
		(input?.info_columns ?? []).filter((c) => c !== 'test_id' && /temp|lot|type|rate|material/i.test(c)).slice(0, 3)
	);

	interface Card {
		test: Test;
		color: string;
		layers: CurveLayer[];
		lines: Array<{ x0: number; y0: number; slope: number; color: string; dash?: number[] }>;
		markers: Array<{ x: number; y: number; color: string }>;
		ps: number;
	}

	// Per-test small multiple: the curve, its elastic line, the 0.2 % offset line
	// and the proof-stress point, so a bad fit is visible at a glance.
	function card(t: Test): Card {
		const color = plasmaColorFor(t.meta[colorKey], allColorVals);
		let E = NaN, ps = NaN, psX = NaN;
		try {
			E = modulusOf(t, t.meta);
			ps = proofStressOf(t, t.meta);
			psX = ps / E + 0.002;
		} catch {
			/* drawn without fit lines */
		}
		const ok = Number.isFinite(E) && E > 0;
		return {
			test: t,
			color,
			ps,
			layers: [{ curves: [{ x: t.strain, y: t.stress, color }], width: 1.4 }],
			lines: ok
				? [
						{ x0: 0, y0: 0, slope: E, color: 'var(--text-subtle)', dash: [3, 3] },
						{ x0: 0.002, y0: 0, slope: E, color: 'var(--text-muted)', dash: [2, 3] }
					]
				: [],
			markers: Number.isFinite(ps) && Number.isFinite(psX) ? [{ x: psX, y: ps, color }] : []
		};
	}
	const cards = $derived(applies ? shown.map(card) : []);

	// Small multiples share axes so a stray curve stands out.
	const ranges = $derived.by(() => {
		let x0 = 0, x1 = -Infinity, y1 = -Infinity, y0 = 0;
		for (const t of tests) {
			for (let i = 0; i < t.strain.length; i++) {
				const x = t.strain[i], y = t.stress[i];
				if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y > y1) y1 = y;
				if (y < y0) y0 = y;
			}
		}
		if (!Number.isFinite(x1)) return { x: null, y: null };
		return { x: [x0, x1] as [number, number], y: [y0, y1 * 1.05] as [number, number] };
	});

	function metaText(t: Test): string {
		return metaKeys
			.map((k) => {
				const v = t.meta[k];
				return /temp/i.test(k) ? `${v} °C` : /lot/i.test(k) ? `lot ${v}` : String(v);
			})
			.join(' · ');
	}

	const chip = (active: boolean) =>
		`border-color: ${active ? 'var(--accent-ui-strong)' : 'var(--border-default)'}; color: ${active ? 'var(--text-primary)' : 'var(--text-secondary)'}; background: ${active ? 'var(--surface-card-hover)' : 'var(--surface-chip)'};`;
</script>

<div class="pr-32">
	<p class="caption-eyebrow">Screen · processing</p>
	<h2 class="block-title mt-1 text-2xl font-semibold" style="color: var(--text-primary); letter-spacing: -0.01em;">
		{tests.length - rejectedHere} of {tests.length} tests kept
	</h2>
	<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
		The screening PDF, in the browser: one plot per test with its elastic line, 0.2% offset line and proof stress.
		Tap a test to reject it; rejected tests are left out of every block below. Flags are suggestions only.
	</p>
</div>

{#if input && !applies}
	<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
		Screening acts on stress–strain data; this {labels.noun} dataset passes through unchanged.
	</p>
{:else if input}
	<div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
		<div class="flex gap-1" role="group" aria-label="Show">
			{#each [['all', `All ${tests.length}`], ['flagged', `Flagged ${flags.size}`], ['rejected', `Rejected ${rejectedHere}`]] as [k, label] (k)}
				<button
					type="button"
					data-testid={`screen-filter-${k}`}
					aria-pressed={filter === k}
					onclick={() => (filter = k as typeof filter)}
					class="rounded-md border px-2.5 py-1 transition-colors"
					style={chip(filter === k)}>{label}</button
				>
			{/each}
		</div>
		<span class="grow"></span>
		<button
			type="button"
			data-testid="screen-reject-flagged"
			disabled={!flaggedOpen.length}
			onclick={rejectFlagged}
			class="rounded-md border px-2.5 py-1 transition-colors disabled:opacity-40"
			style={chip(false)}>Reject flagged ({flaggedOpen.length})</button
		>
		<button
			type="button"
			disabled={!rejected.size}
			onclick={clearAll}
			class="rounded-md border px-2.5 py-1 transition-colors disabled:opacity-40"
			style={chip(false)}>Clear rejections</button
		>
	</div>

	<div class="screen-grid mt-3" data-testid="screen-grid">
		{#each cards as c (c.test.test_id)}
			{@const isRej = rejected.has(c.test.test_id)}
			{@const why = flags.get(c.test.test_id)}
			<button
				type="button"
				class="screen-card"
				class:rejected={isRej}
				data-testid="screen-card"
				data-test-id={c.test.test_id}
				aria-pressed={isRej}
				title={isRej ? 'Rejected: tap to keep' : 'Tap to reject'}
				onclick={() => toggle(c.test.test_id)}
			>
				<div class="flex items-baseline justify-between gap-2 px-2 pt-1.5">
					<span class="truncate font-mono text-[11px]" style="color: var(--text-primary);">{c.test.test_id}</span>
					<span class="shrink-0 text-[10px] tabular-nums" style="color: var(--text-muted);">
						{Number.isFinite(c.ps) ? `${c.ps.toFixed(0)} MPa` : 'no PS'}
					</span>
				</div>
				<div class="plot">
					<CurveCanvas
						layers={c.layers}
						lines={c.lines}
						markers={c.markers}
						xRange={ranges.x}
						yRange={ranges.y}
						axes={false}
						height={92}
						ariaLabel={`${c.test.test_id} stress–strain`}
					/>
				</div>
				<div class="flex min-h-[1.5rem] flex-wrap items-center gap-1 px-2 pb-1.5">
					<span class="mr-auto truncate text-[10px]" style="color: var(--text-muted);">{metaText(c.test)}</span>
					{#if isRej}
						<span class="badge rejected-badge">Rejected</span>
					{:else if why}
						{#each why as r (r)}<span class="badge flag-badge">{r}</span>{/each}
					{/if}
				</div>
			</button>
		{/each}
	</div>
	{#if !cards.length}
		<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
			{filter === 'flagged' ? 'No tests flagged.' : filter === 'rejected' ? 'No tests rejected.' : 'No tests.'}
		</p>
	{/if}
{:else}
	<p class="mt-4 px-2 py-6 text-center text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
{/if}

<style>
	.screen-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.5rem;
	}
	@media (max-width: 480px) {
		.screen-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	.screen-card {
		position: relative;
		display: flex;
		flex-direction: column;
		text-align: left;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunk);
		transition: border-color 120ms ease, opacity 120ms ease;
		min-width: 0;
	}
	.screen-card:hover {
		border-color: var(--border-strong);
	}
	.screen-card:focus-visible {
		outline: 2px solid var(--accent-ui-strong);
		outline-offset: 1px;
	}
	.screen-card .plot {
		padding: 0 0.25rem;
	}
	.screen-card.rejected {
		border-color: var(--accent-ui-strong);
		background: var(--surface-raised);
	}
	.screen-card.rejected .plot {
		opacity: 0.35;
		filter: grayscale(1);
	}
	.badge {
		border-radius: var(--radius-sm);
		padding: 0 0.3rem;
		font-size: 10px;
		line-height: 1rem;
		white-space: nowrap;
	}
	.flag-badge {
		color: var(--color-plasma-700);
		background: color-mix(in srgb, var(--color-plasma-400) 14%, transparent);
	}
	:global([data-theme='dark']) .flag-badge {
		color: var(--color-plasma-300);
	}
	.rejected-badge {
		color: var(--surface-card);
		background: var(--accent-ui-strong);
		font-weight: 600;
	}
</style>
