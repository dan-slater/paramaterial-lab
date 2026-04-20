<script lang="ts">
	import { blocksStore } from '$lib/stores/blocks.svelte';

	interface Props {
		id: string;
		config: Record<string, unknown>;
	}

	let { id, config }: Props = $props();
	let text = $state((config.text as string) ?? '');
</script>

<div>
	<p class="text-xs uppercase tracking-wider text-neutral-500">Note</p>
	<textarea
		bind:value={text}
		rows="3"
		placeholder="Write an observation or annotation for the report…"
		class="mt-2 w-full resize-none rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-plasma-500 focus:outline-none"
	></textarea>
</div>
