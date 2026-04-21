<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
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
