export type BlockType =
	| 'dataset-picker'
	| 'stress-strain'
	| 'foot-correction'
	| 'property-table'
	| 'representative-curves'
	| 'scatter'
	| 'note';

export interface Block {
	id: string;
	type: BlockType;
	title?: string;
	config: Record<string, unknown>;
	createdAt: number;
}

const initialBlocks: Block[] = [
	{
		id: 'init-dataset',
		type: 'dataset-picker',
		config: {},
		createdAt: Date.now()
	}
];

const state = $state<{ blocks: Block[] }>({ blocks: initialBlocks });

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
	clear() {
		state.blocks = initialBlocks.slice();
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
		type: 'note',
		label: 'Note',
		description: 'Add a free-text annotation.',
		icon: '¶'
	}
];
