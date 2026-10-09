<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { REPORT_TEMPLATES, applyTemplate } from '$lib/templates';

	let open = $state(false);

	function pick(id: string) {
		const current = blocksStore.list;
		const isFresh =
			current.length === 1 && current[0].type === 'dataset-picker';
		if (!isFresh) {
			if (!confirm('Replace current report?')) {
				open = false;
				return;
			}
		}
		applyTemplate(id);
		open = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="rounded-md border px-2 py-1 text-xs transition-colors"
		style="border-color: var(--border-default); color: var(--text-secondary);"
		aria-expanded={open}
		aria-haspopup="menu"
	>
		Template ▾
	</button>

	{#if open}
		<button
			type="button"
			aria-label="Close menu"
			class="fixed inset-0 z-30 cursor-default bg-transparent"
			onclick={() => (open = false)}
		></button>
		<div
			role="menu"
			class="absolute right-0 z-40 mt-1 w-72 overflow-hidden rounded-md border text-xs"
			style="background: var(--surface-card); border-color: var(--border-strong); box-shadow: var(--shadow-md);"
		>
			{#each REPORT_TEMPLATES.filter((t) => !t.experimental) as tpl (tpl.id)}
				<button
					type="button"
					role="menuitem"
					onclick={() => pick(tpl.id)}
					class="block w-full border-b px-3 py-2 text-left last:border-b-0 transition-colors"
					style="border-color: var(--border-default);"
				>
					<div
						class="font-semibold"
						style="font-family: var(--font-serif); color: var(--text-primary); letter-spacing: -0.005em;"
					>
						{tpl.name}
					</div>
					<div
						class="mt-0.5 text-[11px] leading-snug italic"
						style="color: var(--text-secondary); font-family: var(--font-serif);"
					>
						{tpl.description}
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
