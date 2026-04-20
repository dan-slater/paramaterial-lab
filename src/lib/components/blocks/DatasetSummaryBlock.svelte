<script lang="ts">
	import { datasetStore } from '$lib/stores/dataset.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const ds = $derived(datasetStore.current);
	const tests = $derived(ds?.tests ?? []);
	const infoColumns = $derived(ds?.info_columns ?? []);

	interface ColumnSummary {
		column: string;
		numeric: boolean;
		unique: number;
		missing: number;
		min?: number;
		max?: number;
		mean?: number;
		std?: number;
		topValues: Array<{ value: string; count: number }>;
	}

	const columnSummaries = $derived.by<ColumnSummary[]>(() => {
		if (!tests.length) return [];
		return infoColumns.map((col) => {
			const values = tests.map((t) => t.meta[col]);
			const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
			const missing = values.length - nonNull.length;
			const counts = new Map<string, number>();
			for (const v of nonNull) {
				const key = String(v);
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
			const nums = nonNull.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
			const numeric = nums.length === nonNull.length && nums.length > 0;
			let min: number | undefined;
			let max: number | undefined;
			let mean: number | undefined;
			let std: number | undefined;
			if (numeric) {
				min = Math.min(...nums);
				max = Math.max(...nums);
				mean = nums.reduce((a, b) => a + b, 0) / nums.length;
				const variance = nums.reduce((a, b) => a + (b - (mean as number)) ** 2, 0) / nums.length;
				std = Math.sqrt(variance);
			}
			const topValues = Array.from(counts.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([value, count]) => ({ value, count }));
			return {
				column: col,
				numeric,
				unique: counts.size,
				missing,
				min,
				max,
				mean,
				std,
				topValues
			};
		});
	});

	interface Ranges {
		minStrain: number;
		maxStrain: number;
		minStress: number;
		maxStress: number;
		totalSamples: number;
	}

	const ranges = $derived.by<Ranges | null>(() => {
		if (!tests.length) return null;
		let minStrain = Infinity, maxStrain = -Infinity;
		let minStress = Infinity, maxStress = -Infinity;
		let totalSamples = 0;
		for (const t of tests) {
			for (const v of t.strain) {
				if (Number.isFinite(v)) {
					if (v < minStrain) minStrain = v;
					if (v > maxStrain) maxStrain = v;
				}
			}
			for (const v of t.stress) {
				if (Number.isFinite(v)) {
					if (v < minStress) minStress = v;
					if (v > maxStress) maxStress = v;
				}
			}
			totalSamples += t.strain.length;
		}
		return { minStrain, maxStrain, minStress, maxStress, totalSamples };
	});

	function fmt(n: number | undefined): string {
		if (n === undefined || !Number.isFinite(n)) return '—';
		if (Math.abs(n) >= 1000) return n.toFixed(0);
		if (Math.abs(n) >= 1) return n.toFixed(3);
		return n.toPrecision(4);
	}
</script>

<div>
	<p class="text-xs uppercase tracking-wider text-neutral-500">Dataset summary</p>
	<h2 class="mt-0.5 text-xl font-semibold tracking-tight">
		{ds?.name ?? 'Loaded dataset'}
	</h2>
	{#if ds?.description}
		<p class="mt-1 text-sm text-neutral-400">{ds.description}</p>
	{/if}
</div>

{#if !tests.length}
	<p class="mt-3 text-sm text-neutral-500">Load a dataset above.</p>
{:else}
	<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-md border border-neutral-800 bg-neutral-950 p-3">
			<p class="text-[11px] uppercase tracking-wider text-neutral-500">Tests</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{tests.length}</p>
		</div>
		<div class="rounded-md border border-neutral-800 bg-neutral-950 p-3">
			<p class="text-[11px] uppercase tracking-wider text-neutral-500">Info columns</p>
			<p class="mt-1 text-lg font-semibold tabular-nums">{infoColumns.length}</p>
		</div>
		{#if ranges}
			<div class="rounded-md border border-neutral-800 bg-neutral-950 p-3">
				<p class="text-[11px] uppercase tracking-wider text-neutral-500">Strain range</p>
				<p class="mt-1 text-sm font-semibold tabular-nums">
					{fmt(ranges.minStrain)} → {fmt(ranges.maxStrain)}
				</p>
			</div>
			<div class="rounded-md border border-neutral-800 bg-neutral-950 p-3">
				<p class="text-[11px] uppercase tracking-wider text-neutral-500">Stress range (MPa)</p>
				<p class="mt-1 text-sm font-semibold tabular-nums">
					{fmt(ranges.minStress)} → {fmt(ranges.maxStress)}
				</p>
			</div>
		{/if}
	</div>

	{#if columnSummaries.length}
		<div class="mt-4 overflow-x-auto rounded-md border border-neutral-800">
			<table class="w-full text-sm">
				<thead class="bg-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
					<tr>
						<th class="px-3 py-2 text-left">Column</th>
						<th class="px-3 py-2 text-right">Unique</th>
						<th class="px-3 py-2 text-right">Missing</th>
						<th class="px-3 py-2 text-right">Min</th>
						<th class="px-3 py-2 text-right">Max</th>
						<th class="px-3 py-2 text-right">Mean</th>
						<th class="px-3 py-2 text-right">Std</th>
						<th class="px-3 py-2 text-left">Top values</th>
					</tr>
				</thead>
				<tbody>
					{#each columnSummaries as c (c.column)}
						<tr class="border-t border-neutral-800/70 text-neutral-300 align-top">
							<td class="px-3 py-1.5 font-mono text-xs">
								{c.column}
								{#if c.numeric}
									<span class="ml-1 text-[10px] text-neutral-500">num</span>
								{/if}
							</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.unique}</td>
							<td class="px-3 py-1.5 text-right tabular-nums text-neutral-500">{c.missing}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.numeric ? fmt(c.min) : '—'}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.numeric ? fmt(c.max) : '—'}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.numeric ? fmt(c.mean) : '—'}</td>
							<td class="px-3 py-1.5 text-right tabular-nums">{c.numeric ? fmt(c.std) : '—'}</td>
							<td class="px-3 py-1.5">
								<div class="flex flex-wrap gap-1">
									{#each c.topValues as tv (tv.value)}
										<span
											class="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[11px] text-neutral-400"
										>
											{tv.value}
											<span class="text-neutral-600">· {tv.count}</span>
										</span>
									{/each}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if ranges}
		<p class="mt-2 text-[11px] text-neutral-500">
			Total samples across all curves: <span class="tabular-nums text-neutral-400">{ranges.totalSamples.toLocaleString()}</span>.
		</p>
	{/if}
{/if}
