<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		source: string;
	}

	let { source }: Props = $props();

	// Strip leading YAML frontmatter (--- ... ---) so we can colocate metadata with content.
	function stripFrontmatter(src: string): string {
		if (!src.startsWith('---')) return src;
		const end = src.indexOf('\n---', 3);
		if (end < 0) return src;
		return src.slice(end + 4).replace(/^\n+/, '');
	}

	const html = $derived(marked.parse(stripFrontmatter(source)) as string);
</script>

<div class="prose-doc">
	{@html html}
</div>

<style>
	.prose-doc {
		color: var(--text-primary);
		font-family: var(--font-serif);
		line-height: 1.65;
		font-size: 15px;
		max-width: 72ch;
	}
	.prose-doc :global(h1) {
		font-size: 2.1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin: 0 0 0.5rem;
		font-family: var(--font-serif);
	}
	.prose-doc :global(h2) {
		font-size: 1.4rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 2rem 0 0.5rem;
		font-family: var(--font-serif);
		color: var(--text-primary);
	}
	.prose-doc :global(h3) {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 1.5rem 0 0.4rem;
		font-family: var(--font-serif);
	}
	.prose-doc :global(h4) {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 1.1rem 0 0.3rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
		font-family: var(--font-sans);
	}
	.prose-doc :global(p) {
		margin: 0.8rem 0;
	}
	.prose-doc :global(a) {
		color: var(--color-plasma-400);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}
	.prose-doc :global(ul),
	.prose-doc :global(ol) {
		padding-left: 1.4rem;
		margin: 0.8rem 0;
	}
	.prose-doc :global(li) {
		margin: 0.3rem 0;
	}
	.prose-doc :global(code) {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
		font-size: 0.85em;
		background: var(--surface-sunk);
		padding: 0.1em 0.4em;
		border-radius: 4px;
		color: var(--text-primary);
	}
	.prose-doc :global(pre) {
		background: var(--surface-sunk);
		border: 1px solid var(--border-default);
		border-radius: 8px;
		padding: 1rem;
		overflow-x: auto;
		font-size: 13px;
		line-height: 1.55;
		margin: 1rem 0;
	}
	.prose-doc :global(pre code) {
		background: transparent;
		padding: 0;
		font-size: inherit;
	}
	.prose-doc :global(blockquote) {
		border-left: 3px solid var(--color-plasma-500);
		padding: 0.5rem 0 0.5rem 1rem;
		margin: 1rem 0;
		color: var(--text-secondary);
		font-style: italic;
		background: color-mix(in srgb, var(--color-plasma-500) 6%, transparent);
		border-radius: 0 6px 6px 0;
	}
	.prose-doc :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1rem 0;
		font-size: 0.9em;
	}
	.prose-doc :global(th),
	.prose-doc :global(td) {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid var(--border-default);
		text-align: left;
	}
	.prose-doc :global(th) {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.prose-doc :global(img) {
		max-width: 100%;
		border: 1px solid var(--border-default);
		border-radius: 8px;
		margin: 1rem 0;
		display: block;
	}
	.prose-doc :global(hr) {
		border: 0;
		border-top: 1px solid var(--border-default);
		margin: 2rem 0;
	}
	.prose-doc :global(strong) {
		color: var(--text-primary);
		font-weight: 600;
	}
	.prose-doc :global(em) {
		font-style: italic;
	}
</style>
