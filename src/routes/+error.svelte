<script lang="ts">
	import { page } from '$app/state';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import { PRESET_DATASETS } from '$lib/datasets';

	const headline = PRESET_DATASETS.filter((d) => d.headline);
</script>

<svelte:head>
	<title>{page.status} · paramaterial lab</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<AppHeader />

<main class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-16">
	<p class="caption-eyebrow">Error {page.status}</p>
	<h1
		class="mt-1 text-3xl font-semibold"
		style="font-family: var(--font-serif); color: var(--text-primary); letter-spacing: -0.01em;"
	>
		{page.status === 404 ? 'No such page' : 'Something went wrong'}
	</h1>
	<p class="caption-note mt-2 text-sm" style="color: var(--text-secondary);">
		{page.status === 404
			? `Nothing lives at ${page.url.pathname}.`
			: (page.error?.message ?? 'The server could not finish this request.')}
	</p>

	<p class="caption-eyebrow mt-10">Open a preset instead</p>
	<ul class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each headline as p (p.slug)}
			<li>
				<a
					href="/lab/{p.slug}"
					class="block rounded-md border p-3"
					style="border-color: var(--border-default); background: var(--surface-sunk);"
				>
					<span class="text-sm font-semibold" style="font-family: var(--font-serif); color: var(--text-primary);">{p.name}</span>
					<span class="mt-1 block text-xs italic" style="color: var(--text-secondary); font-family: var(--font-serif);">/lab/{p.slug}</span>
				</a>
			</li>
		{/each}
	</ul>
	<p class="mt-8 text-sm"><a href="/" class="underline underline-offset-2" style="color: var(--text-secondary);">Back to the lab</a> · <a href="/docs" class="underline underline-offset-2" style="color: var(--text-secondary);">Docs</a></p>
</main>
