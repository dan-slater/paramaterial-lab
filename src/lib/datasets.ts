export type TestMeta = Record<string, string | number | boolean | null>;

export interface Test {
	test_id: string;
	meta: TestMeta;
	strain: number[];
	stress: number[];
}

export type Domain = 'materials' | 'finance' | 'climate' | 'battery' | 'generic';

export interface Dataset {
	id: string;
	name: string;
	description: string;
	info_columns: string[];
	tests: Test[];
	domain?: Domain;
	x_label?: string;
	y_label?: string;
}

export interface DatasetInfo {
	id: string;
	/** URL segment for the shareable route, e.g. /lab/materials. */
	slug: string;
	name: string;
	description: string;
	tests: number;
	source: string;
	domain?: Domain;
	/** One of the four headline presets (materials, finance, climate, battery). */
	headline?: boolean;
	/** Report template applied when the preset is opened from its route. */
	template?: string;
}

// Counts and ranges below are read from static/data/*.json as shipped; keep them
// in step with the JSON when it is rebuilt.
export const PRESET_DATASETS: DatasetInfo[] = [
	{
		id: 'basic-usage',
		slug: 'materials',
		name: 'Materials — Uniaxial Tension',
		description: '154 tension tests on 9 aluminium lots at 20–300 °C, from the paramaterial thesis data.',
		tests: 154,
		source: 'dan_msc_basic_usage_0.1.0',
		domain: 'materials',
		headline: true,
		template: 'tension-quick-look'
	},
	{
		id: 'finance',
		slug: 'finance',
		name: 'Finance — Daily Adjusted Closes',
		description: '40 US large-cap tickers across 8 sectors, 504 trading days (Apr 2024 – Apr 2026).',
		tests: 40,
		source: 'yahoo / stooq',
		domain: 'finance',
		headline: true,
		template: 'finance-overview'
	},
	{
		id: 'climate',
		slug: 'climate',
		name: 'Climate — GHCN-Daily Temperatures',
		description: '30 NOAA GHCN-Daily stations in 19 countries, 1,095 days of daily mean temperature (Aug 2022 – Aug 2025).',
		tests: 30,
		source: 'NOAA GHCN-Daily',
		domain: 'climate',
		headline: true,
		template: 'climate-overview'
	},
	{
		id: 'battery',
		slug: 'battery',
		name: 'Battery — Severson 2019 LFP Cycling',
		description: '124 LFP/graphite cells, early-life discharge capacity (cycles 2–100), fast-charge C-rates 3.6–8 C.',
		tests: 124,
		source: 'Severson et al. 2019',
		domain: 'battery',
		headline: true,
		template: 'battery-overview'
	},
	{
		id: 'cs1',
		slug: 'cs1',
		name: 'CS1 — Foot-Correction Screening',
		description: 'Prepared uniaxial tension curves (154 tests) used for foot-correction screening.',
		tests: 154,
		source: 'dan_msc_cs1_0.1.0',
		domain: 'materials',
		template: 'foot-correction-sweep'
	},
	{
		id: 'cs2',
		slug: 'cs2',
		name: 'CS2 — Representative Curves',
		description: 'The same 154 tension tests, grouped for representative-curve generation.',
		tests: 154,
		source: 'dan_msc_cs2_0.1.0',
		domain: 'materials',
		template: 'tension-quick-look'
	},
	{
		id: 'cs3',
		slug: 'cs3',
		name: 'CS3 — Hot Uniaxial Compression',
		description: 'Baron UC tests, 3 materials, 300–500 °C, strain rates 1 and 10 /s.',
		tests: 71,
		source: 'dan_msc_cs3_0.1.0',
		domain: 'materials',
		template: 'hot-deformation'
	},
	{
		id: 'cs4',
		slug: 'cs4',
		name: 'CS4 — Plane-Strain Compression',
		description: 'Hyde PSC tests on TB, 300–400 °C, rates 10/30/100 /s.',
		tests: 40,
		source: 'dan_msc_cs4_0.1.0',
		domain: 'materials',
		template: 'hot-deformation'
	}
];

export function presetBySlug(slug: string): DatasetInfo | undefined {
	return PRESET_DATASETS.find((d) => d.slug === slug);
}

export async function loadDataset(fetchFn: typeof fetch, id: string): Promise<Dataset> {
	const res = await fetchFn(`/data/${id}.json`);
	if (!res.ok) throw new Error(`Failed to load dataset ${id}: ${res.status}`);
	return res.json();
}
