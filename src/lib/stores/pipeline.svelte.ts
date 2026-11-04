/**
 * "Dataset as seen by block i": the loaded dataset run through every active
 * processing block above i, in report order. BlockRenderer puts a view of it in
 * context, and blocks read `useBlockDataset().current` instead of the raw store,
 * so blocks above a processing block are untouched and blocks below see its output.
 */

import { getContext, setContext } from 'svelte';
import type { Dataset } from '$lib/datasets';
import { applyStage, isActiveStage, processingApplies, stageKey } from '$lib/pipeline';
import { datasetStore } from './dataset.svelte';
import { blocksStore } from './blocks.svelte';

// Memo of stage outputs, keyed by the chain of stage keys that produced them,
// so every block below a stage shares one computed dataset and a config change
// only recomputes from the changed stage down.
let memoBase: Dataset | null = null;
let memo: Array<{ chain: string; out: Dataset }> = [];

function run(upTo: number): Dataset | null {
	// Reading these inside a $derived (BlockRenderer) makes the view reactive to
	// the dataset, the block order, and each processing block's config.
	const base = datasetStore.current;
	const list = blocksStore.list;
	if (!base) return null;
	if (base !== memoBase) {
		memoBase = base;
		memo = [];
	}
	if (!processingApplies(base)) return base;
	let ds: Dataset = base;
	let chain = '';
	let stage = 0;
	for (let k = 0; k < upTo && k < list.length; k++) {
		const b = list[k];
		if (!isActiveStage(b)) continue;
		chain += `|${b.id}:${stageKey(b)}`;
		const hit = memo[stage];
		if (hit && hit.chain === chain) {
			ds = hit.out;
		} else {
			ds = applyStage(b, ds);
			memo[stage] = { chain, out: ds };
			memo.length = stage + 1;
		}
		stage++;
	}
	return ds;
}

/** The dataset block `index` receives (output of blocks 0 … index-1). */
export function datasetForBlock(index: number): Dataset | null {
	return run(index);
}

/** The dataset block `index` hands to the blocks below it. */
export function datasetAfterBlock(index: number): Dataset | null {
	return run(index + 1);
}

export interface BlockDatasetView {
	/** What this block should analyse. */
	readonly current: Dataset | null;
	/** What this block passes down (differs only for a processing block). */
	readonly output: Dataset | null;
	/** The dataset as loaded, before any processing block. */
	readonly raw: Dataset | null;
	/** How many active processing blocks sit above this one. */
	readonly stagesAbove: number;
}

const KEY = Symbol('block-dataset');

/** Called by BlockRenderer with a getter for its (reactive) index. */
export function provideBlockDataset(getIndex: () => number): void {
	setContext<BlockDatasetView>(KEY, {
		get current() {
			return datasetForBlock(getIndex());
		},
		get output() {
			return datasetAfterBlock(getIndex());
		},
		get raw() {
			return datasetStore.current;
		},
		get stagesAbove() {
			const i = getIndex();
			if (!processingApplies(datasetStore.current)) return 0;
			return blocksStore.list.slice(0, i).filter(isActiveStage).length;
		}
	});
}

const fallback: BlockDatasetView = {
	get current() {
		return datasetStore.current;
	},
	get output() {
		return datasetStore.current;
	},
	get raw() {
		return datasetStore.current;
	},
	stagesAbove: 0
};

/** A block's view of the data. Outside a BlockRenderer it is the raw dataset. */
export function useBlockDataset(): BlockDatasetView {
	return getContext<BlockDatasetView>(KEY) ?? fallback;
}
