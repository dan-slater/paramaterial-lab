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
	<p class="caption-eyebrow">Properties table</p>
	<h2
		class="block-title mt-1 text-2xl font-semibold"
		style="color: var(--text-primary); letter-spacing: -0.01em;"
	>
		Per-test UTS, E, 0.2% proof stress
	</h2>
	<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
		Computed in-browser from the raw curves — {rows.length} tests analyzed.
	</p>
</div>

{#if !tests.length}
	<p class="mt-3 text-sm italic" style="color: var(--text-muted); font-family: var(--font-serif);">Load a dataset above.</p>
{:else}
	<div class="mt-4 overflow-x-auto rounded-md border" style="border-color: var(--border-default);">
		<table class="w-full text-sm">
			<thead style="background: var(--surface-chip);">
				<tr>
					<th
						class="px-3 py-2 text-left caption-eyebrow"
						style="font-size: 10px; color: var(--text-secondary);"
					>Test ID</th>
					{#each infoColumns.filter((c) => c !== 'test_id') as col}
						<th
							class="px-3 py-2 text-left caption-eyebrow"
							style="font-size: 10px; color: var(--text-secondary); font-weight: 500;"
						>{col}</th>
					{/each}
					<th
						class="px-3 py-2 text-right caption-eyebrow"
						style="font-size: 10px; color: var(--text-secondary);"
					>UTS (MPa)</th>
					<th
						class="px-3 py-2 text-right caption-eyebrow"
						style="font-size: 10px; color: var(--text-secondary);"
					>E (MPa)</th>
					<th
						class="px-3 py-2 text-right caption-eyebrow"
						style="font-size: 10px; color: var(--text-secondary);"
					>PS (MPa)</th>
				</tr>
			</thead>
			<tbody>
				{#each visible as r (r.test_id)}
					<tr
						class="border-t"
						style="border-color: var(--border-default); color: var(--text-primary);"
					>
						<td class="px-3 py-1.5 font-mono text-xs">{r.test_id}</td>
						{#each infoColumns.filter((c) => c !== 'test_id') as col}
							<td class="px-3 py-1.5" style="color: var(--text-secondary);">{r.meta[col] ?? ''}</td>
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
			class="mt-2 text-xs"
			style="color: var(--color-plasma-400);"
		>
			Show {Math.min(24, rows.length - limit)} more →
		</button>
	{/if}
{/if}
