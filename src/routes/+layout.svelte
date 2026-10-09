<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { sessionStore } from '$lib/stores/session.svelte';

	let { children, data } = $props();

	// Seed the session store with the server-provided user so the UI renders
	// the correct state on the first paint (avoids a flash of "signed out").
	$effect(() => {
		sessionStore.setUser(data.user ?? null);
		sessionStore.setAllowSignup(data.allowSignup ?? true);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>paramaterial</title>
</svelte:head>

<div
	class="flex h-screen flex-col overflow-hidden"
	style="background: var(--surface-page); color: var(--text-primary);"
>
	{@render children()}
</div>
