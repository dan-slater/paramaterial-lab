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
	name: string;
	description: string;
	tests: number;
	source: string;
	domain?: Domain;
}

export const PRESET_DATASETS: DatasetInfo[] = [
	{
		id: 'basic-usage',
		name: 'Basic Usage — Uniaxial Tension',
		description: 'Room-temp and elevated-temp (20–300°C) uniaxial tension on 9 material lots.',
		tests: 154,
		source: 'dan_msc_basic_usage_0.1.0',
		domain: 'materials'
	},
	{
		id: 'cs1',
		name: 'CS1 — UT Thesis Analysis',
		description: 'Full Ramberg–Osgood model fitting + parameter-vs-temperature scatter.',
		tests: 154,
		source: 'dan_msc_cs1_0.1.0'
	},
	{
		id: 'cs2',
		name: 'CS2 — UT vs PST Comparison',
		description: 'Uniaxial vs plane-strain tension, 20–300°C, lots F–I.',
		tests: 74,
		source: 'dan_msc_cs2_0.1.0'
	},
	{
		id: 'cs3',
		name: 'CS3 — Hot Uniaxial Compression',
		description: 'Baron UC tests, 3 materials × 300–500°C × 1 and 10/s strain rates.',
		tests: 71,
		source: 'dan_msc_cs3_0.1.0'
	},
	{
		id: 'cs4',
		name: 'CS4 — Plane-Strain Compression',
		description: 'Hyde PSC tests on TB, 300–400°C, rates 10/30/100 /s.',
		tests: 40,
		source: 'dan_msc_cs4_0.1.0',
		domain: 'materials'
	},
	{
		id: 'finance',
		name: 'Finance — Daily Stock Returns',
		description: '48 tickers, 8 sectors, 2 years of adjusted closes. Sector-correlated GBM with drawdown events.',
		tests: 48,
		source: 'synthetic',
		domain: 'finance'
	},
	{
		id: 'climate',
		name: 'Climate — Daily Temperature Records',
		description: '40 global stations, 3 years of daily mean temperature, mixed hemispheres and climate zones.',
		tests: 40,
		source: 'synthetic',
		domain: 'climate'
	},
	{
		id: 'battery',
		name: 'Battery — Capacity Fade',
		description: '50 cells across 4 chemistries × C-rates × operating temps, 800 cycles of discharge capacity.',
		tests: 50,
		source: 'synthetic',
		domain: 'battery'
	}
];

export async function loadDataset(fetchFn: typeof fetch, id: string): Promise<Dataset> {
	const res = await fetchFn(`/data/${id}.json`);
	if (!res.ok) throw new Error(`Failed to load dataset ${id}: ${res.status}`);
	return res.json();
}
