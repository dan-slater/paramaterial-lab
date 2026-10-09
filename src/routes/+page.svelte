<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import LabWorkspace from '$lib/components/LabWorkspace.svelte';
	import { sessionStore } from '$lib/stores/session.svelte';

	$effect(() => {
		if (sessionStore.user) {
			void goto('/projects');
		}
	});
</script>

{#if sessionStore.user}
	<AppHeader />
	<div class="flex min-h-0 flex-1 items-center justify-center" style="color: var(--text-muted);">
		Redirecting…
	</div>
{:else}
	<LabWorkspace />
{/if}
