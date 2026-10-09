<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import Markdown from '$lib/components/Markdown.svelte';

	// Import all markdown sections as raw strings; Vite bundles them at build time.
	import overview from '$lib/docs/00-overview.md?raw';
	import methodology from '$lib/docs/10-methodology.md?raw';
	import materials from '$lib/docs/20-materials.md?raw';
	import finance from '$lib/docs/30-finance.md?raw';
	import climate from '$lib/docs/40-climate.md?raw';
	// 50-battery.md is held back while the battery preset is experimental (ROADMAP v0.4).
	import reproducibility from '$lib/docs/60-reproducibility.md?raw';
	import glossary from '$lib/docs/99-glossary.md?raw';

	interface Section {
		slug: string;
		title: string;
		source: string;
	}

	function parseMeta(src: string): { slug: string; title: string } {
		const m = src.match(/^---\s*\n([\s\S]*?)\n---/);
		if (!m) return { slug: 'section', title: 'Section' };
		const obj: Record<string, string> = {};
		for (const line of m[1].split('\n')) {
			const mm = line.match(/^(\w+):\s*(.*)$/);
			if (mm) obj[mm[1]] = mm[2].trim();
		}
		return { slug: obj.slug ?? 'section', title: obj.title ?? 'Section' };
	}

	const sources: string[] = [overview, methodology, materials, finance, climate, reproducibility, glossary];
	const sections: Section[] = sources.map((s) => ({ ...parseMeta(s), source: s }));

	let activeSlug = $state(sections[0].slug);

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (e.isIntersecting) {
						activeSlug = (e.target as HTMLElement).id;
					}
				}
			},
			{ rootMargin: '-20% 0px -70% 0px' }
		);
		for (const s of sections) {
			const el = document.getElementById(s.slug);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	});

	function jump(slug: string) {
		const el = document.getElementById(slug);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<AppHeader>
	{#snippet rightSlot()}
		<a
			href="/"
			class="rounded-md border px-2 py-1 text-xs transition-colors"
			style="border-color: var(--border-default); color: var(--text-secondary);"
		>
			← Editor
		</a>
	{/snippet}
</AppHeader>

<div class="flex min-h-0 flex-1 overflow-hidden">
	<aside
		class="hidden shrink-0 overflow-y-auto border-r lg:block lg:w-64"
		style="background: var(--surface-raised); border-color: var(--border-default);"
	>
		<nav class="px-4 py-6">
			<p class="caption-eyebrow mb-3">Documentation</p>
			<ul class="space-y-1">
				{#each sections as s (s.slug)}
					<li>
						<button
							type="button"
							onclick={() => jump(s.slug)}
							class="w-full rounded px-2 py-1.5 text-left text-sm transition-colors"
							style={`color: ${activeSlug === s.slug ? 'var(--text-primary)' : 'var(--text-secondary)'}; background: ${activeSlug === s.slug ? 'var(--surface-sunk)' : 'transparent'}; font-family: var(--font-serif);`}
						>
							{s.title}
						</button>
					</li>
				{/each}
			</ul>
			<p class="mt-6 text-[11px] italic" style="color: var(--text-muted);">
				These pages cover the research workflow the tool encodes. The materials
				sections mirror the notebooks in the <code>paramaterial-examples</code> repo; other
				domains are documented at the same depth.
			</p>
		</nav>
	</aside>

	<main class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
		<div class="flex-1 overflow-y-auto px-5 py-8 sm:px-10 lg:px-14">
			<div class="mx-auto max-w-4xl">
				{#each sections as s, i (s.slug)}
					<section id={s.slug} class="scroll-mt-16">
						<Markdown source={s.source} />
						{#if i < sections.length - 1}
							<hr
								class="my-12 border-0 border-t"
								style="border-color: var(--border-default);"
							/>
						{/if}
					</section>
				{/each}
				<p class="mt-16 text-center text-xs italic" style="color: var(--text-muted);">
					— end of documentation —
				</p>
			</div>
		</div>
	</main>
</div>
