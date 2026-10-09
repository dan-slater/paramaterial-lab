<script lang="ts">
	/** The anonymous lab: header with dataset status, template picker and export,
	 *  over the block-scroll report editor. Shared by / and /lab/<preset>. */
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import TemplatePicker from '$lib/components/TemplatePicker.svelte';
	import ReportEditor from '$lib/components/ReportEditor.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
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

<ReportEditor />
