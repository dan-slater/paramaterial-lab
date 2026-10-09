#!/usr/bin/env node
// Unit checks for the in-browser CSV importer (src/lib/csvImport.ts) against the
// shipped samples and edge cases. Needs Node >= 23 (native TypeScript stripping).
//   node scripts/test-csv-import.mjs
import { readFileSync } from 'node:fs';
import { parseCsv, guessMapping, guessDomain, buildDataset } from '../src/lib/csvImport.ts';
const S = new URL('../static/samples/', import.meta.url).pathname;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
for (const f of ['tension-single.csv', 'climate-long.csv']) {
  const t = parseCsv(readFileSync(S + f, 'utf8'), f);
  const m = guessMapping(t); const d = guessDomain(t.headers);
  const ds = buildDataset([t], m, d);
  console.log(f, JSON.stringify(m), d, ds.tests.length, ds.info_columns, ds.tests[0].meta, ds.x_label, ds.y_label);
}
const tw = parseCsv(readFileSync(S + 'tension-single.csv', 'utf8'), 'tension-single.csv');
const two = buildDataset([tw, { ...tw, fileName: 'b.csv' }], guessMapping(tw), 'materials');
ok(two.tests.length === 2 && two.tests[1].meta.file === 'b.csv', 'two files -> two series with file meta');
const cl = parseCsv(readFileSync(S + 'climate-long.csv', 'utf8'), 'climate-long.csv');
const cds = buildDataset([cl], guessMapping(cl), 'climate');
ok(cds.tests.length === 4 && cds.tests[0].strain.length === 365 && cds.tests[0].meta.latitude === -33.97, 'long format: 4 x 365, numeric meta');
ok(guessDomain(cl.headers) === 'climate', 'climate domain guessed');
const q = parseCsv('﻿id;date;"close, adj"\nA;2024-01-03;"1,5"\nA;2024-01-02;2\nB;2024-01-02;3\nB;2024-01-05;4\n', 'q.csv');
ok(q.headers.join('|') === 'id|date|close, adj', 'semicolon + BOM + quoted header');
const qm = guessMapping(q); console.log('q mapping', qm);
const qd = buildDataset([q], { x: 'date', y: 'close, adj', id: 'id' }, 'finance');
ok(qd.tests.length === 1 && qd.tests[0].test_id === 'B' && qd.tests[0].strain.join() === '0,3', 'dates -> day offsets; "1,5" non-numeric dropped so A has <2 points');
const ri = buildDataset([parseCsv('v\n1\n2\n3\n', 'r.csv')], { x: null, y: 'v', id: null }, 'materials');
ok(ri.tests[0].strain.join() === '0,1,2' && ri.x_label === 'row', 'row index x');
try { parseCsv('a,b\n', 'e.csv'); ok(false, 'header-only throws'); } catch { ok(true, 'header-only throws'); }
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
