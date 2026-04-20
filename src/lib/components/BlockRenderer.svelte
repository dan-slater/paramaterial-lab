<script lang="ts">
	import type { Block } from '$lib/stores/blocks.svelte';
	import { blocksStore } from '$lib/stores/blocks.svelte';
	import DatasetPickerBlock from './blocks/DatasetPickerBlock.svelte';
	import StressStrainBlock from './blocks/StressStrainBlock.svelte';
	import FootCorrectionBlock from './blocks/FootCorrectionBlock.svelte';
	import PropertyTableBlock from './blocks/PropertyTableBlock.svelte';
	import RepresentativeCurvesBlock from './blocks/RepresentativeCurvesBlock.svelte';
	import ScatterBlock from './blocks/ScatterBlock.svelte';
	import RambergOsgoodBlock from './blocks/RambergOsgoodBlock.svelte';
	import ZenerHollomonBlock from './blocks/ZenerHollomonBlock.svelte';
	import NoteBlock from './blocks/NoteBlock.svelte';

	interface Props {
		block: Block;
		index: number;
	}

	let { block, index }: Props = $props();

	const removable = $derived(block.type !== 'dataset-picker');
</script>

<article class="group relative rounded-lg border border-neutral-800 bg-neutral-900 p-5">
	<div class="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
		<span class="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">#{index + 1}</span>
		{#if removable}
			<button
				type="button"
				onclick={() => blocksStore.remove(block.id)}
				title="Remove"
				class="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 hover:bg-red-900/70 hover:text-red-200"
			>
				Remove
			</button>
		{/if}
	</div>
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
	{:else if block.type === 'ramberg-osgood'}
		<RambergOsgoodBlock id={block.id} config={block.config} />
	{:else if block.type === 'zener-hollomon'}
		<ZenerHollomonBlock id={block.id} config={block.config} />
	{:else if block.type === 'note'}
		<NoteBlock id={block.id} config={block.config} />
	{/if}
</article>
