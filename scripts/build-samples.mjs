#!/usr/bin/env node
// Writes the CSV import samples in static/samples/ from the shipped preset JSON,
// so the examples on the import panel are real data, not invented numbers.
//
//   node scripts/build-samples.mjs
//
// - tension-single.csv  wide layout, one series per file (one basic-usage test)
// - climate-long.csv    long layout, an id column + 4 GHCN stations, first 365 days

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (id) => JSON.parse(readFileSync(resolve(root, `static/data/${id}.json`), 'utf8'));
const out = resolve(root, 'static/samples');
mkdirSync(out, { recursive: true });

const basic = read('basic-usage');
const t = basic.tests.find((x) => x.meta.temperature === 20) ?? basic.tests[0];
const wide = ['strain,stress_MPa'];
for (let i = 0; i < t.strain.length; i++) wide.push(`${t.strain[i]},${t.stress[i]}`);
writeFileSync(resolve(out, 'tension-single.csv'), wide.join('\n') + '\n');

const climate = read('climate');
const pick = ['CPT-ZAF', 'HEL-FIN', 'SIN-SGP', 'MSP-USA'];
const long = ['station,day,tavg_C,latitude,country'];
for (const id of pick) {
	const s = climate.tests.find((x) => x.test_id === id);
	if (!s) throw new Error(`station ${id} missing from climate.json`);
	for (let i = 0; i < 365; i++) {
		long.push(`${id},${s.strain[i]},${s.stress[i]},${s.meta.latitude},${s.meta.country}`);
	}
}
writeFileSync(resolve(out, 'climate-long.csv'), long.join('\n') + '\n');

console.log(`tension-single.csv: ${t.test_id}, ${t.strain.length} rows`);
console.log(`climate-long.csv: ${pick.length} stations x 365 rows`);
