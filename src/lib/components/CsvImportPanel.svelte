<script lang="ts">
	/**
	 * Drop-or-pick CSV import. Files are parsed in the browser (src/lib/csvImport.ts)
	 * into the same Dataset shape the presets use; nothing is uploaded anywhere.
	 */
	import type { Domain } from '$lib/datasets';
	import {
		buildDataset,
		guessDomain,
		guessMapping,
		MAX_IMPORT_BYTES,
		parseCsv,
		type ColumnMapping,
		type ParsedTable
	} from '$lib/csvImport';
	import { datasetStore } from '$lib/stores/dataset.svelte';

	const DOMAINS: Array<{ id: Domain; label: string }> = [
		{ id: 'materials', label: 'Materials (stress–strain)' },
		{ id: 'finance', label: 'Finance (price series)' },
		{ id: 'climate', label: 'Climate (daily temperature)' },
		{ id: 'battery', label: 'Battery (capacity vs cycle, experimental)' }
	];

	const SAMPLES = [
		{ file: 'tension-single.csv', label: 'one tension test (wide)' },
		{ file: 'climate-long.csv', label: '4 climate stations (long)' }
	];

	let tables = $state<ParsedTable[]>([]);
	let mapping = $state<ColumnMapping>({ x: null, y: '', id: null });
	let domain = $state<Domain>('materials');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let dragging = $state(false);

	// Only columns present in every file can be mapped.
	const headers = $derived(
		tables.length
			? tables[0].headers.filter((h) => tables.every((t) => t.headers.includes(h)))
			: []
	);
	const rowCount = $derived(tables.reduce((n, t) => n + t.rows.length, 0));

	async function stage(files: Array<{ name: string; text: () => Promise<string>; size: number }>) {
		error = null;
		if (!files.length) return;
		busy = true;
		try {
			const parsed: ParsedTable[] = [];
			for (const f of files) {
				if (f.size > MAX_IMPORT_BYTES) {
					throw new Error(`${f.name} is ${(f.size / 1e6).toFixed(1)} MB; the limit is ${MAX_IMPORT_BYTES / 1e6} MB.`);
				}
				parsed.push(parseCsv(await f.text(), f.name));
			}
			tables = parsed;
			mapping = guessMapping(parsed[0]);
			domain = guessDomain(parsed[0].headers);
		} catch (e) {
			tables = [];
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function onPick(e: Event) {
		const input = e.target as HTMLInputElement;
		void stage([...(input.files ?? [])]);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		void stage([...(e.dataTransfer?.files ?? [])]);
	}

	async function loadSample(file: string) {
		error = null;
		const res = await fetch(`/samples/${file}`);
		if (!res.ok) {
			error = `Could not fetch sample ${file}: ${res.status}`;
			return;
		}
		const text = await res.text();
		await stage([{ name: file, size: text.length, text: async () => text }]);
	}

	function commit() {
		error = null;
		try {
			datasetStore.set(buildDataset(tables, mapping, domain));
			tables = [];
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
</script>

<section class="mt-4" data-testid="csv-import">
	<p class="caption-eyebrow">Or import your own</p>

	{#if !tables.length}
		<label
			class="mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm transition-colors"
			style="border-color: {dragging ? 'var(--accent-ui-strong)' : 'var(--border-default)'}; color: var(--text-muted);"
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
		>
			<span style="color: var(--text-secondary);">Drop CSV files here, or click to choose</span>
			<span class="text-xs">Parsed in your browser. Nothing is uploaded.</span>
			<input
				type="file"
				accept=".csv,.tsv,.txt,text/csv"
				multiple
				class="hidden"
				onchange={onPick}
				disabled={busy}
				data-testid="csv-input"
			/>
		</label>
		<p class="mt-2 text-xs" style="color: var(--text-muted);">
			Try a sample:
			{#each SAMPLES as s, i}
				{#if i > 0}<span> · </span>{/if}
				<button
					type="button"
					class="underline underline-offset-2"
					style="color: var(--text-secondary);"
					onclick={() => loadSample(s.file)}>{s.label}</button
				>
				<a href="/samples/{s.file}" download class="ml-0.5" style="color: var(--text-subtle);" title="Download {s.file}">↓</a>
			{/each}
		</p>

		<details class="mt-3 text-xs" style="color: var(--text-secondary);">
			<summary class="cursor-pointer" style="color: var(--text-muted);">Expected columns</summary>
			<div class="caption-note mt-2 space-y-2 leading-relaxed">
				<p>
					A header row, then one row per point. Comma, semicolon or tab separated. Two layouts work:
				</p>
				<ul class="list-disc space-y-1 pl-5">
					<li>
						<strong>One series per file</strong>: an x column and a y column, e.g.
						<code>strain,stress_MPa</code>. The file name becomes the series id. Drop several files to
						get several series.
					</li>
					<li>
						<strong>Long format</strong>: an id column plus x and y, e.g.
						<code>station,day,tavg_C,latitude</code>. Each distinct id is one series.
					</li>
				</ul>
				<p>
					Any other column that holds one value per series (temperature, lot, sector, latitude…)
					becomes metadata you can colour by or scatter against. An x column of dates
					(<code>2024-01-31</code>) becomes days since the first date. With no x column, the row
					number is used.
				</p>
				<p>
					The analyzer set follows the domain you pick: materials gives UTS, E and proof stress;
					finance and climate give their own parameters (see the docs); battery is experimental.
				</p>
			</div>
		</details>
	{:else}
		<div
			class="mt-2 rounded-md border p-3 text-sm"
			style="border-color: var(--border-default); background: var(--surface-sunk);"
			data-testid="csv-mapping"
		>
			<p style="color: var(--text-secondary);">
				{tables.map((t) => t.fileName).join(', ')} · {rowCount.toLocaleString()} rows
			</p>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<label class="text-xs" style="color: var(--text-muted);">
					x column
					<select class="mt-1 w-full rounded border px-2 py-1 text-sm" style="border-color: var(--border-default); background: var(--surface-card); color: var(--text-primary);" bind:value={mapping.x} data-testid="map-x">
						<option value={null}>(row number)</option>
						{#each headers as h}<option value={h}>{h}</option>{/each}
					</select>
				</label>
				<label class="text-xs" style="color: var(--text-muted);">
					y column
					<select class="mt-1 w-full rounded border px-2 py-1 text-sm" style="border-color: var(--border-default); background: var(--surface-card); color: var(--text-primary);" bind:value={mapping.y} data-testid="map-y">
						{#each headers as h}<option value={h}>{h}</option>{/each}
					</select>
				</label>
				<label class="text-xs" style="color: var(--text-muted);">
					series id column
					<select class="mt-1 w-full rounded border px-2 py-1 text-sm" style="border-color: var(--border-default); background: var(--surface-card); color: var(--text-primary);" bind:value={mapping.id} data-testid="map-id">
						<option value={null}>(none: one series per file)</option>
						{#each headers as h}<option value={h}>{h}</option>{/each}
					</select>
				</label>
				<label class="text-xs" style="color: var(--text-muted);">
					analyzers
					<select class="mt-1 w-full rounded border px-2 py-1 text-sm" style="border-color: var(--border-default); background: var(--surface-card); color: var(--text-primary);" bind:value={domain} data-testid="map-domain">
						{#each DOMAINS as d}<option value={d.id}>{d.label}</option>{/each}
					</select>
				</label>
			</div>
			<div class="mt-3 flex gap-2">
				<button
					type="button"
					class="rounded-md border px-3 py-1.5 text-xs"
					style="border-color: var(--accent-ui-strong); color: var(--text-primary);"
					onclick={commit}
					data-testid="csv-import-go">Import</button
				>
				<button
					type="button"
					class="rounded-md border px-3 py-1.5 text-xs"
					style="border-color: var(--border-default); color: var(--text-secondary);"
					onclick={() => {
						tables = [];
						error = null;
					}}>Cancel</button
				>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="mt-2 text-xs text-red-400" data-testid="csv-error">{error}</p>
	{/if}
</section>
