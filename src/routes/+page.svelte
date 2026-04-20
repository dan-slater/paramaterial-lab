<script lang="ts">
	import { goto } from '$app/navigation';
	import { PRESET_DATASETS } from '$lib/datasets';
	import { datasetStore } from '$lib/stores/dataset.svelte';

	let uploadError = $state<string | null>(null);
	let uploading = $state(false);

	async function selectPreset(id: string) {
		await datasetStore.load(id);
		if (!datasetStore.error) goto('/prepare');
	}

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = null;
		try {
			const text = await file.text();
			// Simple CSV parse: first row headers, expect Strain + Stress columns
			const lines = text.trim().split(/\r?\n/);
			const headers = lines[0].split(',').map((h) => h.trim());
			const strainIdx = headers.findIndex((h) => /strain/i.test(h));
			const stressIdx = headers.findIndex((h) => /stress/i.test(h));
			if (strainIdx < 0 || stressIdx < 0) {
				throw new Error(`CSV must have Strain and Stress columns. Got: ${headers.join(', ')}`);
			}
			const strain: number[] = [];
			const stress: number[] = [];
			for (let i = 1; i < lines.length; i++) {
				const row = lines[i].split(',');
				const s = parseFloat(row[strainIdx]);
				const y = parseFloat(row[stressIdx]);
				if (Number.isFinite(s) && Number.isFinite(y)) {
					strain.push(s);
					stress.push(y);
				}
			}
			datasetStore.set({
				id: 'upload',
				name: file.name,
				description: `Uploaded ${file.name} (${strain.length} points)`,
				info_columns: [],
				tests: [{ test_id: file.name, meta: {}, strain, stress }]
			});
			goto('/prepare');
		} catch (err) {
			uploadError = err instanceof Error ? err.message : String(err);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="mb-8">
	<h1 class="text-3xl font-semibold tracking-tight">Choose a dataset</h1>
	<p class="mt-2 text-neutral-400">
		Pick one of the preset case studies below to walk through the paramaterial pipeline, or upload
		your own stress–strain CSV.
	</p>
</div>

<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each PRESET_DATASETS as ds}
		<button
			type="button"
			onclick={() => selectPreset(ds.id)}
			class="group flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-left transition hover:border-plasma-500 hover:bg-neutral-800/50"
		>
			<div class="flex items-start justify-between gap-2">
				<h3 class="font-medium">{ds.name}</h3>
				<span class="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
					{ds.tests} tests
				</span>
			</div>
			<p class="text-sm text-neutral-400">{ds.description}</p>
			<p class="mt-auto text-xs text-neutral-500 group-hover:text-plasma-400">Open →</p>
		</button>
	{/each}
</section>

<section class="mt-10">
	<h2 class="mb-3 text-lg font-medium">Or upload your own</h2>
	<label
		class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-900/50 px-6 py-10 text-center transition hover:border-plasma-500 hover:bg-neutral-900"
	>
		<svg class="h-8 w-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
				d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.5-1.5A4.5 4.5 0 1116.5 16M12 12v9m0 0l-3-3m3 3l3-3" />
		</svg>
		<span class="text-sm text-neutral-300">
			Drop a CSV with <code class="text-plasma-400">Strain</code> and
			<code class="text-plasma-400">Stress</code> columns
		</span>
		<span class="text-xs text-neutral-500">click to browse</span>
		<input type="file" accept=".csv" class="hidden" onchange={handleFile} disabled={uploading} />
	</label>
	{#if uploadError}
		<p class="mt-2 text-sm text-red-400">{uploadError}</p>
	{/if}
	{#if datasetStore.loading}
		<p class="mt-2 text-sm text-neutral-400">Loading…</p>
	{/if}
	{#if datasetStore.error}
		<p class="mt-2 text-sm text-red-400">{datasetStore.error}</p>
	{/if}
</section>
