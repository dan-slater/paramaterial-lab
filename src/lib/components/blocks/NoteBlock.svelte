<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();
	let text = $state((config.text as string) ?? '');

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	function handleInput(e: Event) {
		text = (e.target as HTMLTextAreaElement).value;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			blocksStore.update(id, { config: { ...config, text } });
		}, 200);
	}
</script>

<div>
	<p class="caption-eyebrow">Note</p>
	<h2
		class="block-title mt-1 text-xl font-semibold"
		style="color: var(--text-primary); letter-spacing: -0.005em;"
	>
		Observation
	</h2>
	<textarea
		value={text}
		oninput={handleInput}
		rows="3"
		placeholder="Write an observation or annotation for the report…"
		class="mt-3 w-full resize-none rounded-md border p-3 text-sm focus:outline-none"
		style="background: var(--surface-sunk); border-color: var(--border-default); color: var(--text-primary); font-family: var(--font-serif);"
	></textarea>
</div>
