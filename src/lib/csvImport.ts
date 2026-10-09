/**
 * In-browser CSV import. Turns one or more CSV files into a `Dataset` with the
 * same shape as the shipped presets (`static/data/*.json`), so every block and
 * analyzer works on an upload exactly as it does on a preset. Nothing leaves
 * the browser.
 *
 * Two layouts are accepted:
 *   - wide, one series per file: an x column and a y column; the file name
 *     becomes the series id. Drop several files to get several series.
 *   - long: an id column plus x and y columns; each distinct id is a series.
 *
 * Any other column whose value is constant within a series becomes metadata
 * (numeric when every value parses as a number), which is what the colour-by
 * and parameter-scatter blocks group on.
 */
import type { Dataset, Domain, Test, TestMeta } from '$lib/datasets';

export interface ParsedTable {
	fileName: string;
	headers: string[];
	rows: string[][];
}

export interface ColumnMapping {
	/** Column holding the x axis, or null to use the row index. */
	x: string | null;
	y: string;
	/** Column holding the series id (long format), or null for one series per file. */
	id: string | null;
}

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const X_HINTS = [/^strain/i, /^x$/i, /^cycle/i, /^day/i, /^date/i, /^time/i, /^t$/i, /^step/i, /^index$/i];
const Y_HINTS = [/^stress/i, /^y$/i, /close/i, /^price/i, /capacity/i, /^q_?d/i, /^tavg/i, /temp/i, /^value$/i];
const ID_HINTS = [/^test_?id$/i, /^id$/i, /^series(_?id)?$/i, /^ticker$/i, /^symbol$/i, /^station/i, /^cell(_?id)?$/i, /^specimen/i, /^sample/i];

/** Split CSV text into rows. Handles quoted fields, escaped quotes, CRLF, a BOM,
 *  and comma / semicolon / tab delimiters (picked from the header line). */
export function parseCsv(text: string, fileName = 'upload.csv'): ParsedTable {
	const src = text.replace(/^﻿/, '');
	const firstLine = src.slice(0, src.search(/\r?\n|$/));
	const delim = [',', ';', '\t'].reduce((best, d) =>
		firstLine.split(d).length > firstLine.split(best).length ? d : best
	);

	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (inQuotes) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else inQuotes = false;
			} else field += c;
		} else if (c === '"') inQuotes = true;
		else if (c === delim) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			if (row.some((f) => f.trim() !== '')) rows.push(row);
			row = [];
		} else field += c;
	}
	row.push(field);
	if (row.some((f) => f.trim() !== '')) rows.push(row);

	if (rows.length < 2) throw new Error(`${fileName}: needs a header row and at least one data row.`);
	const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
	return { fileName, headers, rows: rows.slice(1).map((r) => r.map((f) => f.trim())) };
}

function isNumeric(s: string): boolean {
	return s !== '' && Number.isFinite(Number(s));
}

function numericShare(table: ParsedTable, col: number): number {
	const sample = table.rows.slice(0, 200);
	return sample.filter((r) => isNumeric(r[col] ?? '')).length / Math.max(1, sample.length);
}

function isDateColumn(table: ParsedTable, col: number): boolean {
	const sample = table.rows.slice(0, 50).map((r) => r[col] ?? '');
	return sample.length > 0 && sample.every((v) => !isNumeric(v) && !Number.isNaN(Date.parse(v)));
}

function firstMatch(headers: string[], hints: RegExp[], skip: Set<string>): string | null {
	for (const re of hints) {
		const h = headers.find((c) => !skip.has(c) && re.test(c));
		if (h) return h;
	}
	return null;
}

/** Best-guess mapping from headers and value types. The user can override it. */
export function guessMapping(table: ParsedTable): ColumnMapping {
	const { headers } = table;
	const numeric = headers.filter((_, i) => numericShare(table, i) > 0.9);
	const used = new Set<string>();

	let id = firstMatch(headers, ID_HINTS, used);
	// An id column only makes sense if it repeats (long format).
	if (id) {
		const col = headers.indexOf(id);
		const distinct = new Set(table.rows.map((r) => r[col])).size;
		if (distinct === table.rows.length) id = null;
	}
	if (id) used.add(id);

	let x = firstMatch(headers, X_HINTS, used);
	if (x) used.add(x);
	let y = firstMatch(headers, Y_HINTS, used);
	if (y && !numeric.includes(y)) y = null;
	if (!y) y = numeric.find((h) => !used.has(h)) ?? headers.find((h) => !used.has(h)) ?? headers[0];
	used.add(y);
	if (!x) x = numeric.find((h) => !used.has(h)) ?? null;
	return { x, y, id };
}

/** Pick an analyzer domain from header names; falls back to materials. */
export function guessDomain(headers: string[]): Domain {
	const h = headers.join(' ').toLowerCase();
	if (/stress|strain|force|load/.test(h)) return 'materials';
	if (/close|price|ticker|return/.test(h)) return 'finance';
	if (/tavg|tmax|tmin|temperature|station/.test(h)) return 'climate';
	if (/capacity|cycle|qd|soh/.test(h)) return 'battery';
	return 'materials';
}

function stripExt(name: string): string {
	return name.replace(/\.(csv|tsv|txt)$/i, '');
}

/** Build series from one table under a mapping. */
function tableToTests(table: ParsedTable, map: ColumnMapping): Test[] {
	const col = (name: string | null) => (name === null ? -1 : table.headers.indexOf(name));
	const xi = col(map.x);
	const yi = col(map.y);
	const ii = col(map.id);
	if (yi < 0) throw new Error(`${table.fileName}: no column named "${map.y}".`);
	if (map.x !== null && xi < 0) throw new Error(`${table.fileName}: no column named "${map.x}".`);
	if (map.id !== null && ii < 0) throw new Error(`${table.fileName}: no column named "${map.id}".`);

	const xIsDate = xi >= 0 && isDateColumn(table, xi);
	const metaCols = table.headers
		.map((h, i) => ({ h, i }))
		.filter(({ i }) => i !== xi && i !== yi && i !== ii);

	// Group rows by series id, preserving first-seen order.
	const groups = new Map<string, string[][]>();
	for (const r of table.rows) {
		const key = ii >= 0 ? r[ii] || '(blank)' : stripExt(table.fileName);
		let g = groups.get(key);
		if (!g) groups.set(key, (g = []));
		g.push(r);
	}

	const tests: Test[] = [];
	for (const [testId, rows] of groups) {
		let points: Array<[number, number]> = [];
		const t0 = xIsDate ? Math.min(...rows.map((r) => Date.parse(r[xi]))) : 0;
		rows.forEach((r, k) => {
			const y = Number(r[yi]);
			let x: number;
			if (xi < 0) x = k;
			else if (xIsDate) x = (Date.parse(r[xi]) - t0) / 86_400_000;
			else x = r[xi] === '' ? NaN : Number(r[xi]);
			if (r[yi] !== '' && Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
		});
		if (xIsDate) points = points.sort((a, b) => a[0] - b[0]);
		if (points.length < 2) continue;

		const meta: TestMeta = {};
		for (const { h, i } of metaCols) {
			const vals = new Set(rows.map((r) => r[i]));
			if (vals.size !== 1) continue;
			const v = rows[0][i];
			if (v === '') continue;
			meta[h] = isNumeric(v) ? Number(v) : v;
		}
		tests.push({
			test_id: testId,
			meta,
			strain: points.map((p) => p[0]),
			stress: points.map((p) => p[1])
		});
	}
	return tests;
}

/** Turn parsed tables into one Dataset. Series ids are made unique across files. */
export function buildDataset(
	tables: ParsedTable[],
	map: ColumnMapping,
	domain: Domain
): Dataset {
	const tests: Test[] = [];
	const seen = new Map<string, number>();
	for (const t of tables) {
		for (const test of tableToTests(t, map)) {
			const n = seen.get(test.test_id) ?? 0;
			seen.set(test.test_id, n + 1);
			if (n > 0) test.test_id = `${test.test_id}_${n + 1}`;
			if (tables.length > 1 && map.id === null) test.meta.file = t.fileName;
			tests.push(test);
		}
	}
	if (!tests.length) {
		throw new Error('No series with at least two numeric points were found. Check the column mapping.');
	}

	// info_columns: test_id first, then every meta key in first-seen order.
	const metaKeys: string[] = [];
	for (const t of tests) for (const k of Object.keys(t.meta)) if (!metaKeys.includes(k)) metaKeys.push(k);

	const files = tables.map((t) => t.fileName);
	const points = tests.reduce((n, t) => n + t.strain.length, 0);
	return {
		id: 'upload',
		name: files.length === 1 ? stripExt(files[0]) : `${files.length} uploaded files`,
		description: `Imported in the browser from ${files.join(', ')}: ${tests.length} series, ${points.toLocaleString()} points.`,
		info_columns: ['test_id', ...metaKeys],
		tests,
		domain,
		x_label: map.x ?? 'row',
		y_label: map.y
	};
}
