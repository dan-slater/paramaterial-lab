<script lang="ts">
	import { PRESET_DATASETS } from '$lib/datasets';
	import { datasetStore } from '$lib/stores/dataset.svelte';

	let uploadError = $state<string | null>(null);
	let uploading = $state(false);

	async function selectPreset(id: string) {
		await datasetStore.load(id);
	}

	async function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = null;
		try {
			const text = await file.text();
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
		} catch (err) {
			uploadError = err instanceof Error ? err.message : String(err);
		} finally {
			uploading = false;
		}
	}
</script>

{#if datasetStore.current}
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-xs uppercase tracking-wider text-neutral-500">Dataset</p>
			<h2 class="mt-0.5 text-xl font-semibold tracking-tight">{datasetStore.current.name}</h2>
			<p class="mt-1 text-sm text-neutral-400">
				{datasetStore.current.tests.length} tests · {datasetStore.current.description}
			</p>
		</div>
		<button
			onclick={() => datasetStore.clear()}
			class="shrink-0 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
		>
			Change
		</button>
	</div>
{:else}
	<p class="text-xs uppercase tracking-wider text-neutral-500">Start here</p>
	<h2 class="mt-0.5 text-xl font-semibold tracking-tight">Choose a dataset</h2>
	<p class="mt-1 text-sm text-neutral-400">
		Pick a preset or upload a stress–strain CSV. Subsequent blocks will draw from this dataset.
	</p>

	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each PRESET_DATASETS as ds}
			<button
				type="button"
				onclick={() => selectPreset(ds.id)}
				class="group rounded-md border border-neutral-800 bg-neutral-950 p-3 text-left transition hover:border-plasma-500 hover:bg-neutral-900"
			>
				<div class="flex items-start justify-between gap-2">
					<h3 class="text-sm font-medium">{ds.name}</h3>
					<span class="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">
						{ds.tests}
					</span>
				</div>
				<p class="mt-1 text-xs text-neutral-400 line-clamp-2">{ds.description}</p>
			</button>
		{/each}
	</div>

	<label
		class="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-neutral-700 bg-neutral-950/60 px-4 py-4 text-sm text-neutral-400 transition hover:border-plasma-500 hover:text-neutral-200"
	>
		<span>Upload CSV (Strain, Stress columns)</span>
		<input type="file" accept=".csv" class="hidden" onchange={handleFile} disabled={uploading} />
	</label>
	{#if uploadError}
		<p class="mt-2 text-xs text-red-400">{uploadError}</p>
	{/if}
	{#if datasetStore.loading}
		<p class="mt-2 text-xs text-neutral-500">Loading…</p>
	{/if}
	{#if datasetStore.error}
		<p class="mt-2 text-xs text-red-400">{datasetStore.error}</p>
	{/if}
{/if}
