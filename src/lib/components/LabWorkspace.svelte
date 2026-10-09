<script lang="ts">
	/** The anonymous lab: header with dataset status, template picker and export,
	 *  over the block-scroll report editor. Shared by / and /lab/<preset>. */
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import TemplatePicker from '$lib/components/TemplatePicker.svelte';
	import ReportEditor from '$lib/components/ReportEditor.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { PRESET_DATASETS } from '$lib/datasets';

	const experimental = $derived(
		PRESET_DATASETS.find((d) => d.id === datasetStore.current?.id && d.experimental)
	);
</script>

<AppHeader>
	{#snippet rightSlot()}
		{#if datasetStore.current}
			<span class="hidden sm:inline">
				{datasetStore.current.name} · {datasetStore.current.tests.length} tests
			</span>
		{:else}
			<span class="hidden sm:inline">No dataset loaded</span>
		{/if}
		<TemplatePicker />
		<ExportMenu />
	{/snippet}
</AppHeader>

{#if experimental}
	<div
		class="shrink-0 border-b px-4 py-2 text-xs"
		style="background: rgb(200 120 20 / 0.18); border-color: rgb(160 100 30 / 0.45); color: var(--text-primary);"
		role="note"
		data-testid="experimental-banner"
	>
		<strong>Experimental.</strong> The {experimental.slug} preset is not part of the v0.2 release: it covers
		only each cell's first 100 cycles, so most of its fade parameters are empty or unreliable. See
		ROADMAP.md (v0.4) for the full-life rebuild.
	</div>
{/if}

<ReportEditor />
