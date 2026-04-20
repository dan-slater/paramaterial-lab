<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { Block } from '$lib/stores/blocks.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import BlockToolbar from './BlockToolbar.svelte';
	import DatasetPickerBlock from './blocks/DatasetPickerBlock.svelte';
	import StressStrainBlock from './blocks/StressStrainBlock.svelte';
	import FootCorrectionBlock from './blocks/FootCorrectionBlock.svelte';
	import PropertyTableBlock from './blocks/PropertyTableBlock.svelte';
	import RepresentativeCurvesBlock from './blocks/RepresentativeCurvesBlock.svelte';
	import ScatterBlock from './blocks/ScatterBlock.svelte';
	import NoteBlock from './blocks/NoteBlock.svelte';

	interface Props {
		block: Block;
		index: number;
	}

	let { block, index }: Props = $props();

	const isDatasetPicker = $derived(block.type === 'dataset-picker');
	const total = $derived(blocksStore.list.length);
</script>

<article
	class="relative rounded-lg border border-neutral-800 bg-neutral-900 p-5 pt-11"
	in:fly|global={{ y: 8, duration: 180 }}
>
	<BlockToolbar
		id={block.id}
		{index}
		{total}
		variant={isDatasetPicker ? 'index-only' : 'full'}
	/>
	{#if block.type === 'dataset-picker'}
		<DatasetPickerBlock />
	{:else if block.type === 'stress-strain'}
		<StressStrainBlock id={block.id} config={block.config} />
	{:else if block.type === 'foot-correction'}
		<FootCorrectionBlock id={block.id} config={block.config} />
	{:else if block.type === 'property-table'}
		<PropertyTableBlock id={block.id} config={block.config} />
	{:else if block.type === 'representative-curves'}
		<RepresentativeCurvesBlock id={block.id} config={block.config} />
	{:else if block.type === 'scatter'}
		<ScatterBlock id={block.id} config={block.config} />
	{:else if block.type === 'note'}
		<NoteBlock id={block.id} config={block.config} />
	{/if}
</article>
