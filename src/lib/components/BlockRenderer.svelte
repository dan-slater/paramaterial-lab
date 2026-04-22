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
	import RambergOsgoodBlock from './blocks/RambergOsgoodBlock.svelte';
	import ZenerHollomonBlock from './blocks/ZenerHollomonBlock.svelte';
	import DatasetSummaryBlock from './blocks/DatasetSummaryBlock.svelte';
	import ParametersBlock from './blocks/ParametersBlock.svelte';
	import NoteBlock from './blocks/NoteBlock.svelte';

	interface Props {
		block: Block;
		index: number;
	}

	let { block, index }: Props = $props();

	const isDatasetPicker = $derived(block.type === 'dataset-picker');
	const total = $derived(blocksStore.list.length);

	// Categorize block types into figure / table / note / header for numbering.
	function categoryOf(t: Block['type']): 'figure' | 'table' | 'note' | 'header' {
		switch (t) {
			case 'stress-strain':
			case 'foot-correction':
			case 'representative-curves':
			case 'scatter':
			case 'ramberg-osgood':
			case 'zener-hollomon':
				return 'figure';
			case 'property-table':
			case 'dataset-summary':
			case 'parameters':
				return 'table';
			case 'note':
				return 'note';
			default:
				return 'header';
		}
	}

	// Count how many same-category blocks come at or before this index.
	const captionInfo = $derived.by<{ label: string; kind: string } | null>(() => {
		const list = blocksStore.list;
		const cat = categoryOf(block.type);
		if (cat === 'header') return null;
		let n = 0;
		for (let k = 0; k <= index && k < list.length; k++) {
			if (categoryOf(list[k].type) === cat) n++;
		}
		const word = cat === 'figure' ? 'Figure' : cat === 'table' ? 'Table' : 'Note';
		return { label: `${word} ${n}`, kind: cat };
	});
</script>

<article
	class="relative report-card overflow-hidden"
	style="background: var(--surface-card); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 1.5rem 1.5rem 1.25rem; box-shadow: var(--shadow-card);"
	in:fly|global={{ y: 8, duration: 180 }}
>
	<BlockToolbar
		id={block.id}
		{index}
		{total}
		variant={isDatasetPicker ? 'index-only' : 'full'}
	/>
	{#if captionInfo}
		<p
			class="caption-eyebrow mb-1"
			data-caption-kind={captionInfo.kind}
			style="margin-top: -0.25rem;"
		>
			{captionInfo.label}
		</p>
	{/if}
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
	{:else if block.type === 'parameters'}
		<ParametersBlock id={block.id} config={block.config} />
	{:else if block.type === 'dataset-summary'}
		<DatasetSummaryBlock id={block.id} config={block.config} />
	{:else if block.type === 'note'}
		<NoteBlock id={block.id} config={block.config} />
	{/if}
</article>

<style>
	/* Subtle top highlight + hover glow; kept outside the @theme block since it
	   uses a pseudo approach: ::before for the top highlight won't interfere. */
	.report-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
	}
	.report-card {
		transition: border-color 140ms ease, box-shadow 180ms ease;
	}
	.report-card:hover {
		border-color: var(--border-strong);
	}
	/* Padding a bit more on top to accommodate the floating toolbar. */
	:global([data-theme='light']) .report-card::before {
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6);
	}
	article.report-card {
		padding-top: 2.75rem;
	}
</style>
