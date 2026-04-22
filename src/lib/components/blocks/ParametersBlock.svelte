<script lang="ts">
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { getParameterDefs } from '$lib/analyzers/registry';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);
	const domain = $derived(datasetStore.current?.domain);
	const params = $derived(getParameterDefs(domain));

	let expanded = $state(false);

	const rows = $derived.by(() => {
		return tests.map((t) => {
			const values: Record<string, number | null> = {};
			for (const p of params) {
				values[p.key] = p.extract({ strain: t.strain, stress: t.stress }, t.meta);
			}
			return { test_id: t.test_id, meta: t.meta, values };
		});
	});

	const displayedRows = $derived(expanded ? rows : rows.slice(0, 12));

	function fmt(n: number | null): string {
		if (n === null) return '—';
		const a = Math.abs(n);
		if (a === 0) return '0';
		if (a >= 1000) return n.toFixed(0);
		if (a >= 10) return n.toFixed(1);
		if (a >= 1) return n.toFixed(3);
		if (a >= 0.001) return n.toFixed(4);
		return n.toExponential(2);
	}
</script>

<div class="flex items-start justify-between gap-4 pr-32">
	<div>
		<p class="caption-eyebrow">Parameters</p>
		<h2
			class="block-title mt-1 text-2xl font-semibold"
			style="color: var(--text-primary); letter-spacing: -0.01em;"
		>
			Per-series scalars
		</h2>
		<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
			{params.length} parameters computed for {tests.length} series
			{#if domain}
				· domain <span style="color: var(--color-plasma-400); font-style: normal;">{domain}</span>
			{/if}
		</p>
	</div>
</div>

{#if !tests.length}
	<p class="mt-4 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">
		Load a dataset above.
	</p>
{:else}
	<div
		class="mt-4 overflow-x-auto rounded-md border"
		style="background: var(--surface-sunk); border-color: var(--border-default);"
	>
		<table class="w-full text-xs tabular-nums">
			<thead class="sticky top-0">
				<tr style="background: var(--surface-sunk); color: var(--text-muted);">
					<th class="px-3 py-2 text-left font-mono text-[10px] tracking-wider uppercase">Series</th>
					{#each infoColumns.filter((c) => c !== 'test_id').slice(0, 2) as col}
						<th class="px-3 py-2 text-left font-mono text-[10px] tracking-wider uppercase">{col}</th>
					{/each}
					{#each params as p (p.key)}
						<th class="px-3 py-2 text-right font-mono text-[10px] tracking-wider uppercase">
							{p.label}{#if p.unit}<span class="ml-0.5 opacity-60">({p.unit})</span>{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each displayedRows as row (row.test_id)}
					<tr
						class="border-t"
						style="border-color: var(--border-default); color: var(--text-primary);"
					>
						<td class="px-3 py-1.5 font-mono text-[11px]">{row.test_id}</td>
						{#each infoColumns.filter((c) => c !== 'test_id').slice(0, 2) as col}
							<td class="px-3 py-1.5">{row.meta[col] ?? '—'}</td>
						{/each}
						{#each params as p (p.key)}
							<td class="px-3 py-1.5 text-right">{fmt(row.values[p.key])}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if rows.length > 12}
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="mt-2 text-xs italic"
			style="color: var(--color-plasma-400); font-family: var(--font-serif);"
		>
			{expanded ? 'Show less' : `Show ${rows.length - 12} more →`}
		</button>
	{/if}
{/if}
