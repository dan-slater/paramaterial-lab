<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import TemplatePicker from '$lib/components/TemplatePicker.svelte';
	import ReportEditor from '$lib/components/ReportEditor.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { sessionStore } from '$lib/stores/session.svelte';

	$effect(() => {
		if (sessionStore.user) {
			void goto('/projects');
		}
	});
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

{#if sessionStore.user}
	<div class="flex min-h-0 flex-1 items-center justify-center" style="color: var(--text-muted);">
		Redirecting…
	</div>
{:else}
	<ReportEditor />
{/if}
