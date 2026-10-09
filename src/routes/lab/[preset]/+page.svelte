<script lang="ts">
	/**
	 * Shareable preset route, e.g. /lab/materials. Opens the preset with its
	 * report template. If the visitor's saved report is already on this preset,
	 * their blocks are kept, so a reload does not throw work away.
	 * Signed-in visitors can use it too (/ sends them to /projects).
	 */
	import { onMount } from 'svelte';
	import LabWorkspace from '$lib/components/LabWorkspace.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import { datasetStore } from '$lib/stores/dataset.svelte';
	import { applyTemplate } from '$lib/templates';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const preset = $derived(data.preset);

	function open(p: typeof preset) {
		const picker = blocksStore.list.find((b) => b.type === 'dataset-picker');
		if (picker?.config?.id !== p.id && p.template) applyTemplate(p.template);
		if (datasetStore.current?.id !== p.id) void datasetStore.load(p.id);
	}

	onMount(() => open(preset));

	// Client-side navigation between presets reuses this component.
	let last = '';
	$effect(() => {
		if (last && last !== preset.slug) open(preset);
		last = preset.slug;
	});
</script>

<svelte:head>
	<title>{preset.name} · paramaterial lab</title>
	<meta name="description" content={preset.description} />
	<meta property="og:title" content="{preset.name} · paramaterial lab" />
	<meta property="og:description" content={preset.description} />
</svelte:head>

<LabWorkspace />
