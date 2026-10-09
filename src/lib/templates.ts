/**
 * Report templates — one-click seed sets of analysis blocks for common workflows.
 *
 * Each template definition lists block types + partial configs. `applyTemplate`
 * materializes them into fresh Block objects (with unique ids + timestamps) and
 * hands the array to `blocksStore.replaceAll`.
 */

import { blocksStore, type Block, type BlockType } from './stores/blocks.svelte';

export interface TemplateBlockSpec {
	type: BlockType;
	config?: Record<string, unknown>;
}

export interface ReportTemplate {
	id: string;
	name: string;
	description: string;
	blocks: TemplateBlockSpec[];
	/** Left off the template picker; still applied by its preset route. */
	experimental?: boolean;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
	{
		id: 'tension-quick-look',
		name: 'Tension quick-look',
		description:
			'Pick a dataset, plot stress–strain, fit foot correction on one test, list properties, scatter UTS vs temperature.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'stress-strain', config: { colorBy: 'temperature' } },
			{ type: 'foot-correction' },
			{ type: 'property-table' },
			{ type: 'scatter', config: { xId: 'meta:temperature', yId: 'param:UTS' } }
		]
	},
	{
		id: 'hot-deformation',
		name: 'Hot deformation',
		description:
			'Pick a dataset, plot curves, compute representative curves grouped by temperature, run Zener–Hollomon.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'stress-strain', config: { colorBy: 'temperature' } },
			{ type: 'representative-curves', config: { groupBy: 'temperature' } },
			{ type: 'zener-hollomon', config: { Q_kJmol: 155, flowStrain: 0.3 } }
		]
	},
	{
		id: 'foot-correction-sweep',
		name: 'Foot-correction sweep',
		description:
			'Pick a dataset, inspect elastic-region fits, list per-test properties, scatter E vs lot.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'foot-correction' },
			{ type: 'property-table' },
			{ type: 'scatter', config: { xId: 'meta:lot', yId: 'param:E' } }
		]
	},
	{
		id: 'finance-overview',
		name: 'Finance overview',
		description:
			'Price series coloured by sector, per-ticker parameters, scatter max drawdown vs annualized volatility.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'stress-strain', config: { colorBy: 'sector' } },
			{ type: 'parameters' },
			{ type: 'scatter', config: { xId: 'param:AnnVol', yId: 'param:MaxDD' } }
		]
	},
	{
		id: 'climate-overview',
		name: 'Climate overview',
		description:
			'Daily temperature coloured by hemisphere, per-station parameters, scatter annual mean vs latitude.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'stress-strain', config: { colorBy: 'hemisphere' } },
			{ type: 'parameters' },
			{ type: 'scatter', config: { xId: 'meta:latitude', yId: 'param:AnnMean' } }
		]
	},
	{
		id: 'battery-overview',
		name: 'Battery overview',
		experimental: true,
		description:
			'Capacity fade coloured by batch, per-cell fade parameters, scatter cycle life vs charge C-rate.',
		blocks: [
			{ type: 'dataset-picker' },
			{ type: 'stress-strain', config: { colorBy: 'cell_group' } },
			{ type: 'parameters' },
			{ type: 'scatter', config: { xId: 'meta:nominal_c_rate_charge', yId: 'meta:cycle_life' } }
		]
	}
];

let seeded = 0;

/** Unique-ish id generator matching the existing newId pattern in blocks.svelte.ts. */
function templateBlockId(type: BlockType): string {
	seeded += 1;
	return `tpl-${type}-${seeded}-${Date.now().toString(36)}`;
}

/** Materialize a template spec into a concrete Block. */
function hydrateBlock(spec: TemplateBlockSpec): Block {
	return {
		id: templateBlockId(spec.type),
		type: spec.type,
		config: { ...(spec.config ?? {}) },
		createdAt: Date.now()
	};
}

/** Replace the current blocks list with a hydrated copy of the named template.
 *  Preserves the currently-loaded dataset (picker's config.id / uploaded flag)
 *  so applying a template doesn't kick the user back to the empty picker. */
export function applyTemplate(id: string): boolean {
	const tpl = REPORT_TEMPLATES.find((t) => t.id === id);
	if (!tpl) return false;
	const existingPicker = blocksStore.list.find((b) => b.type === 'dataset-picker');
	const carryConfig =
		existingPicker && (existingPicker.config?.id || existingPicker.config?.uploaded)
			? { ...existingPicker.config }
			: null;
	const blocks = tpl.blocks.map((spec, i) => {
		const b = hydrateBlock(spec);
		if (i === 0 && spec.type === 'dataset-picker' && carryConfig) {
			b.config = { ...b.config, ...carryConfig };
		}
		return b;
	});
	blocksStore.replaceAll(blocks);
	return true;
}
