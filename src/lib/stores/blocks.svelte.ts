import { loadJSON, saveJSONDebounced, STORAGE_KEYS } from './persistence';

export type BlockType =
	| 'dataset-picker'
	| 'stress-strain'
	| 'foot-correction'
	| 'property-table'
	| 'representative-curves'
	| 'scatter'
	| 'ramberg-osgood'
	| 'zener-hollomon'
	| 'note';

export interface Block {
	id: string;
	type: BlockType;
	title?: string;
	config: Record<string, unknown>;
	createdAt: number;
}

interface PersistedShape {
	v: 1;
	blocks: Block[];
}

const initialBlocks: Block[] = [
	{
		id: 'init-dataset',
		type: 'dataset-picker',
		config: {},
		createdAt: Date.now()
	}
];

function hydrate(): Block[] {
	const saved = loadJSON<PersistedShape>(STORAGE_KEYS.blocks);
	if (saved && saved.v === 1 && Array.isArray(saved.blocks) && saved.blocks.length > 0) {
		// Ensure a dataset-picker is present as the first block.
		const hasPicker = saved.blocks.some((b) => b.type === 'dataset-picker');
		return hasPicker ? saved.blocks : [initialBlocks[0], ...saved.blocks];
	}
	return initialBlocks.slice();
}

const state = $state<{ blocks: Block[] }>({ blocks: hydrate() });

// Autosave on any change. $effect.root lives for the lifetime of the module.
if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			// Read every field we care about so Svelte tracks deep mutations.
			const snapshot = state.blocks.map((b) => ({
				id: b.id,
				type: b.type,
				title: b.title,
				config: { ...b.config },
				createdAt: b.createdAt
			}));
			const payload: PersistedShape = { v: 1, blocks: snapshot };
			saveJSONDebounced(STORAGE_KEYS.blocks, payload, 50);
		});
		return () => {};
	});
}

let counter = 0;
function newId(type: BlockType): string {
	counter += 1;
	return `${type}-${counter}-${Date.now().toString(36)}`;
}

export const blocksStore = {
	get list() {
		return state.blocks;
	},
	add(type: BlockType, config: Record<string, unknown> = {}, title?: string): Block {
		const b: Block = { id: newId(type), type, title, config, createdAt: Date.now() };
		state.blocks.push(b);
		return b;
	},
	update(id: string, patch: Partial<Block>) {
		const i = state.blocks.findIndex((b) => b.id === id);
		if (i >= 0) state.blocks[i] = { ...state.blocks[i], ...patch };
	},
	remove(id: string) {
		const i = state.blocks.findIndex((b) => b.id === id);
		if (i >= 0) state.blocks.splice(i, 1);
	},
	move(id: string, direction: 'up' | 'down') {
		const i = state.blocks.findIndex((b) => b.id === id);
		if (i < 0) return;
		// Don't move the dataset-picker, and don't move anything into its slot.
		// Dataset-picker is expected at index 0; restrict swap range to [1..len-1].
		const isDatasetPicker = state.blocks[i].type === 'dataset-picker';
		if (isDatasetPicker) return;
		const target = direction === 'up' ? i - 1 : i + 1;
		if (target < 0 || target >= state.blocks.length) return;
		if (state.blocks[target].type === 'dataset-picker') return;
		const arr = state.blocks;
		[arr[i], arr[target]] = [arr[target], arr[i]];
	},
	duplicate(id: string): Block | null {
		const i = state.blocks.findIndex((b) => b.id === id);
		if (i < 0) return null;
		const src = state.blocks[i];
		if (src.type === 'dataset-picker') return null;
		// Clone via JSON round-trip to strip any non-serializable values
		// (functions, DOM refs) that block-specific components may have stashed.
		let configCopy: Record<string, unknown> = {};
		try {
			configCopy = JSON.parse(JSON.stringify(src.config ?? {}));
		} catch {
			configCopy = { ...(src.config ?? {}) };
		}
		const copy: Block = {
			id: newId(src.type),
			type: src.type,
			title: src.title,
			config: configCopy,
			createdAt: Date.now()
		};
		state.blocks.splice(i + 1, 0, copy);
		return copy;
	},
	clear() {
		state.blocks = initialBlocks.slice();
	},
	replaceAll(next: Block[]) {
		state.blocks = next.slice();
	}
};

export const TOOLS: Array<{ type: BlockType; label: string; description: string; icon: string }> = [
	{
		type: 'stress-strain',
		label: 'Stress–strain',
		description: 'Plot all tests σ vs ε, color by any metadata field.',
		icon: '∿'
	},
	{
		type: 'foot-correction',
		label: 'Foot correction',
		description: 'Find UPL/LPL, fit E, shift curves to zero-strain.',
		icon: '⊥'
	},
	{
		type: 'property-table',
		label: 'Properties table',
		description: 'Per-test UTS, E, 0.2% proof stress.',
		icon: '▦'
	},
	{
		type: 'representative-curves',
		label: 'Representative curves',
		description: 'Group tests, interpolate, compute mean ± std.',
		icon: '≋'
	},
	{
		type: 'scatter',
		label: 'Parameter scatter',
		description: 'Extracted parameter vs condition (temperature, lot, …).',
		icon: '◦'
	},
	{
		type: 'ramberg-osgood',
		label: 'Ramberg–Osgood',
		description: 'Power-law fit σ = C·ε^n in the plastic region per test.',
		icon: 'σ'
	},
	{
		type: 'zener-hollomon',
		label: 'Zener–Hollomon',
		description: 'Regress ln σ vs ln Z using strain rate and temperature.',
		icon: 'Z'
	},
	{
		type: 'note',
		label: 'Note',
		description: 'Add a free-text annotation.',
		icon: '¶'
	}
];
