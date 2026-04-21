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
			<p class="caption-eyebrow">Dataset</p>
			<h2
				class="block-title mt-1 text-2xl font-semibold"
				style="color: var(--text-primary); letter-spacing: -0.01em;"
			>
				{datasetStore.current.name}
			</h2>
			<p
				class="caption-note mt-1 text-sm"
				style="color: var(--text-secondary);"
			>
				{datasetStore.current.tests.length} tests · {datasetStore.current.description}
			</p>
		</div>
		<button
			onclick={() => datasetStore.clear()}
			class="shrink-0 rounded-md border px-3 py-1.5 text-xs transition-colors"
			style="border-color: var(--border-default); color: var(--text-secondary);"
		>
			Change
		</button>
	</div>
{:else}
	<p class="caption-eyebrow">Start here</p>
	<h2
		class="block-title mt-1 text-2xl font-semibold"
		style="color: var(--text-primary); letter-spacing: -0.01em;"
	>
		Choose a dataset
	</h2>
	<p class="caption-note mt-1 text-sm" style="color: var(--text-secondary);">
		Pick a preset or upload a stress–strain CSV. Subsequent blocks will draw from this dataset.
	</p>

	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each PRESET_DATASETS as ds}
			<button
				type="button"
				onclick={() => selectPreset(ds.id)}
				class="group rounded-md border p-3 text-left transition-colors"
				style="border-color: var(--border-default); background: var(--surface-sunk);"
				onmouseenter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-ui-strong)'; }}
				onmouseleave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'; }}
			>
				<div class="flex items-start justify-between gap-2">
					<h3
						class="text-sm font-semibold"
						style="font-family: var(--font-serif); color: var(--text-primary);"
					>
						{ds.name}
					</h3>
					<span
						class="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
						style="background: var(--surface-chip); color: var(--text-muted);"
					>
						{ds.tests}
					</span>
				</div>
				<p
					class="mt-1 text-xs line-clamp-2 italic"
					style="color: var(--text-secondary); font-family: var(--font-serif);"
				>
					{ds.description}
				</p>
			</button>
		{/each}
	</div>

	<label
		class="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 py-4 text-sm transition-colors"
		style="border-color: var(--border-default); color: var(--text-muted);"
	>
		<span>Upload CSV (Strain, Stress columns)</span>
		<input type="file" accept=".csv" class="hidden" onchange={handleFile} disabled={uploading} />
	</label>
	{#if uploadError}
		<p class="mt-2 text-xs text-red-400">{uploadError}</p>
	{/if}
	{#if datasetStore.loading}
		<p class="mt-2 text-xs" style="color: var(--text-muted);">Loading…</p>
	{/if}
	{#if datasetStore.error}
		<p class="mt-2 text-xs text-red-400">{datasetStore.error}</p>
	{/if}
{/if}
