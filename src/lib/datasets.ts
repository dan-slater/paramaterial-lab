export type TestMeta = Record<string, string | number | boolean | null>;

export interface Test {
	test_id: string;
	meta: TestMeta;
	strain: number[];
	stress: number[];
}

export interface Dataset {
	id: string;
	name: string;
	description: string;
	info_columns: string[];
	tests: Test[];
}

export interface DatasetInfo {
	id: string;
	name: string;
	description: string;
	tests: number;
	source: string;
}

export const PRESET_DATASETS: DatasetInfo[] = [
	{
		id: 'basic-usage',
		name: 'Basic Usage — Uniaxial Tension',
		description: 'Room-temp and elevated-temp (20–300°C) uniaxial tension on 9 material lots.',
		tests: 154,
		source: 'dan_msc_basic_usage_0.1.0'
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
		source: 'dan_msc_cs4_0.1.0'
	}
];

export async function loadDataset(fetchFn: typeof fetch, id: string): Promise<Dataset> {
	const res = await fetchFn(`/data/${id}.json`);
	if (!res.ok) throw new Error(`Failed to load dataset ${id}: ${res.status}`);
	return res.json();
}
