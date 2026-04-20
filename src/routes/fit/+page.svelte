<script lang="ts">
	import { goto } from '$app/navigation';
	import { datasetStore } from '$lib/stores/dataset.svelte';
</script>

{#if !datasetStore.current}
	<p class="text-neutral-400">No dataset loaded. <a href="/" class="text-plasma-400 underline">Start over</a>.</p>
{:else}
	<p class="text-xs uppercase tracking-wider text-neutral-500">Step 4 — Fit</p>
	<h1 class="text-2xl font-semibold tracking-tight">Fit constitutive model</h1>
	<p class="mt-2 text-neutral-400">Ramberg–Osgood, Voce, Zener–Hollomon — pick a model and fit.</p>
	<div class="mt-6 rounded-lg border border-dashed border-neutral-700 bg-neutral-900/50 p-8 text-center text-neutral-500">
		Fitting step UI — WIP
	</div>
	<div class="mt-6 flex justify-between gap-2">
		<button onclick={() => goto('/aggregate')} class="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800">← Back</button>
		<button onclick={() => goto('/results')} class="rounded-md bg-plasma-600 px-4 py-2 text-sm font-medium text-white hover:bg-plasma-500">Next: Results →</button>
	</div>
{/if}
