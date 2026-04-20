<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const steps = [
		{ href: '/', label: 'Dataset' },
		{ href: '/prepare', label: 'Prepare' },
		{ href: '/process', label: 'Process' },
		{ href: '/aggregate', label: 'Aggregate' },
		{ href: '/fit', label: 'Fit' },
		{ href: '/results', label: 'Results' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>paramaterial</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-100">
	<header class="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
			<a href="/" class="flex items-center gap-2 text-lg font-semibold tracking-tight">
				<span class="inline-block h-6 w-6 rounded bg-gradient-to-br from-plasma-400 to-plasma-700"></span>
				paramaterial
			</a>
			<nav class="hidden gap-1 text-sm sm:flex">
				{#each steps as step, i}
					{@const active = page.url.pathname === step.href
						|| (step.href !== '/' && page.url.pathname.startsWith(step.href))}
					<a
						href={step.href}
						class="rounded-md px-3 py-1.5 transition
							{active ? 'bg-plasma-600 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'}"
					>
						<span class="text-xs opacity-60">{i + 1}.</span>
						{step.label}
					</a>
				{/each}
			</nav>
		</div>
		<nav class="flex gap-1 overflow-x-auto px-4 pb-2 text-sm sm:hidden">
			{#each steps as step, i}
				{@const active = page.url.pathname === step.href
					|| (step.href !== '/' && page.url.pathname.startsWith(step.href))}
				<a
					href={step.href}
					class="shrink-0 rounded-md px-3 py-1.5 transition
						{active ? 'bg-plasma-600 text-white' : 'text-neutral-400 hover:bg-neutral-800'}"
				>
					<span class="text-xs opacity-60">{i + 1}.</span>
					{step.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="mx-auto max-w-6xl px-4 py-6">
		{@render children()}
	</main>
</div>
