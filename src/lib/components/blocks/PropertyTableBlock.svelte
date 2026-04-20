<script lang="ts">
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { findUTS, findUplLpl, findE, findProofStress } from '$lib/processing';
	import type { Test } from '$lib/datasets';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();

	const tests = $derived(datasetStore.current?.tests ?? []);
	const infoColumns = $derived(datasetStore.current?.info_columns ?? []);

	interface Row {
		test_id: string;
		UTS: number;
		E: number;
		PS: number;
		meta: Record<string, unknown>;
	}

	const rows = $derived.by<Row[]>(() => {
		const out: Row[] = [];
		for (const t of tests) {
			try {
				const foot = findUplLpl({ strain: t.strain, stress: t.stress });
				const uts = findUTS({ strain: t.strain, stress: t.stress });
				const ps = findProofStress({ strain: t.strain, stress: t.stress }, foot.E);
				out.push({
					test_id: t.test_id,
					UTS: uts.UTS,
					E: foot.E,
					PS: ps.proofStress,
					meta: t.meta
				});
			} catch {
				// swallow: this test couldn't be analyzed (e.g., too short)
			}
		}
		return out;
	});

	let limit = $state(12);
	const visible = $derived(rows.slice(0, limit));
</script>

<div>
	<p class="text-xs uppercase tracking-wider text-neutral-500">Properties table</p>
	<h2 class="mt-0.5 text-xl font-semibold tracking-tight">Per-test UTS, E, 0.2% proof stress</h2>
	<p class="mt-1 text-sm text-neutral-400">
		Computed in-browser from the raw curves — {rows.length} tests analyzed.
	</p>
</div>

{#if !tests.length}
	<p class="mt-3 text-sm text-neutral-500">Load a dataset above.</p>
{:else}
	<div class="mt-3 overflow-x-auto rounded-md border border-neutral-800">
		<table class="w-full text-sm">
			<thead class="bg-neutral-900 text-xs uppercase tracking-wider text-neutral-400">
				<tr>
					<th class="px-3 py-2 text-left">Test ID</th>
					{#each infoColumns.filter((c) => c !== 'test_id') as col}
						<th class="px-3 py-2 text-left font-normal">{col}</th>
					{/each}
					<th class="px-3 py-2 text-right">UTS (MPa)</th>
					<th class="px-3 py-2 text-right">E (MPa)</th>
					<th class="px-3 py-2 text-right">PS (MPa)</th>
				</tr>
			</thead>
			<tbody>
				{#each visible as r (r.test_id)}
					<tr class="border-t border-neutral-800/70 text-neutral-300 hover:bg-neutral-900/40">
						<td class="px-3 py-1.5 font-mono text-xs">{r.test_id}</td>
						{#each infoColumns.filter((c) => c !== 'test_id') as col}
							<td class="px-3 py-1.5 text-neutral-400">{r.meta[col] ?? ''}</td>
						{/each}
						<td class="px-3 py-1.5 text-right tabular-nums">{r.UTS.toFixed(1)}</td>
						<td class="px-3 py-1.5 text-right tabular-nums">{r.E.toFixed(0)}</td>
						<td class="px-3 py-1.5 text-right tabular-nums">{r.PS.toFixed(1)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if rows.length > limit}
		<button
			onclick={() => (limit += 24)}
			class="mt-2 text-xs text-plasma-400 hover:text-plasma-300"
		>
			Show {Math.min(24, rows.length - limit)} more →
		</button>
	{/if}
{/if}
