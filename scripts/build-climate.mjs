#!/usr/bin/env node
// Builds static/data/climate.json from NOAA GHCN-Daily.
// Fetches ~35 hand-picked stations, extracts the last 3 years of daily mean
// temperature (TAVG; fallback to (TMAX+TMIN)/2), linearly interpolates short
// gaps, and assembles a Dataset JSON matching the shared schema used by the
// materials/finance/battery presets (strain=day-index, stress=°C).

import { writeFileSync, statSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../static/data/climate.json');
const CACHE = resolve(__dirname, '../.cache/ghcn');
if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });

const DAYS_PER_YEAR = 365;
const YEARS = 3;
const N = YEARS * DAYS_PER_YEAR; // 1095
const MAX_GAP = 7;              // max interpolable gap
const MIN_COVERAGE = 0.95;      // required post-interp coverage
const FETCH_DELAY_MS = 300;

// Hand-picked station list (GHCN-Daily ID, short label, country).
// Some IDs may have been retired; build log will flag any that error out.
// GHCN IDs verified against the ghcnd-stations index.
const PICKS = [
	['USW00023174', 'LAX',    'USA'],
	['USW00094728', 'NYC',    'USA'],
	['USW00023234', 'SFO',    'USA'],
	['USW00012842', 'TPA',    'USA'],
	['USW00023183', 'PHX',    'USA'],
	['USW00014922', 'MSP',    'USA'],
	['USW00026451', 'ANC',    'USA'],   // Anchorage
	['CA001108395', 'YVR',    'CAN'],
	['CA007025250', 'YUL',    'CAN'],   // Montreal Pierre-Elliott-Trudeau (Quebec prov.)
	['MXM00076680', 'MEX',    'MEX'],
	['UKM00003772', 'LHR',    'GBR'],
	['UK000003005', 'LWK',    'GBR'],   // Lerwick (UK, not UKM)
	['SWM00002485', 'STO',    'SWE'],
	['NOM00001492', 'OSL',    'NOR'],   // Oslo Blindern
	['GME00111445', 'BER',    'DEU'],   // Berlin-Tempelhof
	['FRM00007156', 'PAR',    'FRA'],   // Paris Montsouris
	['SPE00120287', 'MAD',    'ESP'],
	['IT000016239', 'ROM',    'ITA'],   // Roma Ciampino
	['RSM00027612', 'MSC',    'RUS'],
	['RSM00024959', 'YKS',    'RUS'],   // Yakutsk
	['IN022021900', 'DEL',    'IND'],   // New Delhi Safdarjung
	['IN020040900', 'MAA',    'IND'],   // Madras/Chennai
	['CHM00054511', 'PEK',    'CHN'],
	['CHM00059287', 'CAN',    'CHN'],
	['JA000047662', 'TYO',    'JPN'],
	['SNM00048698', 'SIN',    'SGP'],
	['ASN00066037', 'SYD',    'AUS'],   // Sydney Obs Hill
	['ASN00086282', 'MEL',    'AUS'],   // Melbourne Airport (86071 retired 2015)
	['BRM00082331', 'MAO',    'BRA'],   // Manaus
	['BRM00082915', 'RBR',    'BRA'],   // Rio Branco (83743 retired 1988)
	['AR000875850', 'BUE',    'ARG'],   // Buenos Aires Observatorio
	['ARM00087938', 'USH',    'ARG'],   // Ushuaia Malvinas Argentinas
	['SFM00068816', 'CPT',    'ZAF'],
	['KEM00063741', 'NBO',    'KEN'],   // Nairobi Dagoretti
	['EGM00062378', 'CAI',    'EGY'],   // Helwan (Cairo)
	['AYW00090001', 'SPO',    'ATA'],   // Amundsen-Scott
	['IDM00096741', 'JKT',    'IDN'],   // Jakarta Tanjung Priok
	['ID000096745', 'JK2',    'IDN'],   // Jakarta Observatory (backup)
	['ICM00004130', 'REK',    'ISL'],   // Reykjavik
	['FIE00142080', 'HEL',    'FIN'],   // Vantaa Helsinki
	['BRM00083377', 'BSB',    'BRA']    // Brasilia
];

const STATIONS_URL = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt';
const BY_STATION_URL = (id) => `https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/${id}.csv.gz`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- fetchers with on-disk cache ----
async function fetchText(url, cacheName) {
	const cachePath = resolve(CACHE, cacheName);
	if (existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
	const r = await fetch(url);
	if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
	const text = await r.text();
	writeFileSync(cachePath, text);
	return text;
}
async function fetchGzCsv(url, cacheName) {
	const cachePath = resolve(CACHE, cacheName);
	let buf;
	if (existsSync(cachePath)) {
		buf = readFileSync(cachePath);
	} else {
		const r = await fetch(url);
		if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
		buf = Buffer.from(await r.arrayBuffer());
		writeFileSync(cachePath, buf);
	}
	return gunzipSync(buf).toString('utf8');
}

// ---- parse ghcnd-stations.txt (fixed-width) ----
// Format:
//   0-10  ID (11 chars)
//   12-19 LAT
//   21-29 LON
//   31-36 ELEV
//   38-39 STATE
//   41-71 NAME
function parseStations(text) {
	const idx = new Map();
	for (const line of text.split('\n')) {
		if (line.length < 40) continue;
		const id = line.slice(0, 11).trim();
		const lat = parseFloat(line.slice(12, 20));
		const lon = parseFloat(line.slice(21, 30));
		const elev = parseFloat(line.slice(31, 37));
		const name = line.slice(41, 71).trim();
		if (!id || Number.isNaN(lat) || Number.isNaN(lon)) continue;
		idx.set(id, { id, lat, lon, elev: Number.isFinite(elev) ? elev : null, name });
	}
	return idx;
}

// ---- parse one station CSV ----
// Columns: STATION,DATE,ELEMENT,VALUE,M_FLAG,Q_FLAG,S_FLAG,TIME
// DATE is YYYYMMDD; VALUE is in tenths of °C for TAVG/TMAX/TMIN.
function parseStationCsv(text, endDate, startDate) {
	const tavg = new Map();
	const tmax = new Map();
	const tmin = new Map();
	const lines = text.split('\n');
	// Skip header if present.
	let start = 0;
	if (lines[0] && lines[0].startsWith('STATION')) start = 1;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const parts = line.split(',');
		if (parts.length < 7) continue;
		const element = parts[2];
		if (element !== 'TAVG' && element !== 'TMAX' && element !== 'TMIN') continue;
		const date = parts[1];
		if (date < startDate || date > endDate) continue;
		const qflag = parts[5];
		if (qflag && qflag.trim() !== '') continue; // any QC failure flag set
		const rawV = parseInt(parts[3], 10);
		if (!Number.isFinite(rawV)) continue;
		if (rawV === -9999) continue;
		const v = rawV / 10; // tenths °C -> °C
		if (element === 'TAVG') tavg.set(date, v);
		else if (element === 'TMAX') tmax.set(date, v);
		else tmin.set(date, v);
	}
	return { tavg, tmax, tmin };
}

// ---- build a 1095-day series ending at endDate ----
function dateAddDays(yyyymmdd, delta) {
	const y = parseInt(yyyymmdd.slice(0, 4), 10);
	const m = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
	const d = parseInt(yyyymmdd.slice(6, 8), 10);
	const dt = new Date(Date.UTC(y, m, d));
	dt.setUTCDate(dt.getUTCDate() + delta);
	const yy = dt.getUTCFullYear();
	const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(dt.getUTCDate()).padStart(2, '0');
	return `${yy}${mm}${dd}`;
}

function assembleSeries(maps, endDate) {
	const series = new Array(N).fill(null);
	const startDate = dateAddDays(endDate, -(N - 1));
	let rawCount = 0;
	let tavgMeasured = 0;
	let tavgDerived = 0;
	for (let i = 0; i < N; i++) {
		const d = dateAddDays(startDate, i);
		let v = maps.tavg.get(d);
		if (v !== undefined) {
			series[i] = v;
			rawCount++;
			tavgMeasured++;
			continue;
		}
		const mx = maps.tmax.get(d);
		const mn = maps.tmin.get(d);
		if (mx !== undefined && mn !== undefined) {
			series[i] = (mx + mn) / 2;
			rawCount++;
			tavgDerived++;
		}
	}
	return { series, rawCount, tavgMeasured, tavgDerived, startDate, endDate };
}

// Linearly interpolate across gaps of length <= MAX_GAP. Returns filled count.
function interpolate(series) {
	let i = 0;
	while (i < N) {
		if (series[i] !== null) { i++; continue; }
		// find gap [i, j)
		let j = i;
		while (j < N && series[j] === null) j++;
		const gapLen = j - i;
		const left = i > 0 ? series[i - 1] : null;
		const right = j < N ? series[j] : null;
		if (gapLen <= MAX_GAP && left !== null && right !== null) {
			for (let k = i; k < j; k++) {
				const t = (k - (i - 1)) / (j - (i - 1));
				series[k] = left + (right - left) * t;
			}
		}
		i = j;
	}
	let filled = 0;
	for (let k = 0; k < N; k++) if (series[k] !== null) filled++;
	return filled;
}

function hemisphereOf(lat) { return lat >= 0 ? 'N' : 'S'; }

// ---- main ----
async function main() {
	console.log('fetching ghcnd-stations.txt …');
	const stationsText = await fetchText(STATIONS_URL, 'ghcnd-stations.txt');
	const meta = parseStations(stationsText);
	console.log(`  indexed ${meta.size} stations`);

	// End date: NOAA's by_station archive for international stations lags by
	// several months. Anchor to a date that most non-US stations still cover so
	// all stations share one comparable 3-year window. Override with
	// CLIMATE_END=YYYYMMDD if you want a different window.
	const endDate = process.env.CLIMATE_END || '20250820';
	const startDate = dateAddDays(endDate, -(N - 1));
	console.log(`window: ${startDate} → ${endDate} (${N} days)\n`);

	const tests = [];
	const dropped = [];

	for (let i = 0; i < PICKS.length; i++) {
		const [ghcn, tag, country] = PICKS[i];
		const testId = `${tag}-${country}`;
		const m = meta.get(ghcn);
		if (!m) {
			console.log(`${testId}: dropped (not in ghcnd-stations index)`);
			dropped.push({ testId, ghcn, reason: 'unknown-id' });
			continue;
		}
		try {
			const csv = await fetchGzCsv(BY_STATION_URL(ghcn), `${ghcn}.csv.gz`);
			const maps = parseStationCsv(csv, endDate, startDate);
			const { series, rawCount, tavgMeasured, tavgDerived } = assembleSeries(maps, endDate);
			const rawPct = (100 * rawCount) / N;
			const filled = interpolate(series);
			const cov = filled / N;
			if (cov < MIN_COVERAGE) {
				console.log(`${testId}: ${rawCount}/${N} raw (${rawPct.toFixed(1)}%), coverage ${(cov * 100).toFixed(1)}% → DROPPED`);
				dropped.push({ testId, ghcn, reason: 'low-coverage', coverage: cov });
				await sleep(FETCH_DELAY_MS);
				continue;
			}
			// any remaining nulls: fill with nearest non-null (rare; cov >= 95%).
			for (let k = 0; k < N; k++) {
				if (series[k] === null) {
					// walk outward
					let left = k, right = k;
					while (left >= 0 && series[left] === null) left--;
					while (right < N && series[right] === null) right++;
					series[k] = left >= 0 ? series[left] : series[right];
				}
			}
			// round to 0.1 °C
			const stress = series.map((v) => Math.round(v * 10) / 10);
			const strain = Array.from({ length: N }, (_, k) => k);

			const missingPct = 100 - rawPct;
			const derivedPct = (100 * tavgDerived) / (tavgMeasured + tavgDerived);
			console.log(`${testId}: ${rawCount}/${N} raw (${missingPct.toFixed(1)}% missing), tavg-derived=${derivedPct.toFixed(0)}% → ${filled} filled`);

			tests.push({
				test_id: testId,
				meta: {
					ghcn_id: ghcn,
					name: m.name,
					latitude: Math.round(m.lat * 100) / 100,
					longitude: Math.round(m.lon * 100) / 100,
					altitude_m: m.elev === null ? null : Math.round(m.elev),
					country,
					hemisphere: hemisphereOf(m.lat),
					coverage_pct: Math.round(rawPct * 10) / 10,
					tavg_derived_pct: Math.round(derivedPct * 10) / 10
				},
				strain,
				stress
			});
		} catch (err) {
			console.log(`${testId}: fetch error (${err.message}) → DROPPED`);
			dropped.push({ testId, ghcn, reason: `error: ${err.message}` });
		}
		await sleep(FETCH_DELAY_MS);
	}

	const dataset = {
		id: 'climate',
		name: 'Climate — GHCN-Daily Temperature Records',
		description:
			`Daily mean temperatures from ${tests.length} globally-distributed NOAA GHCN-Daily stations, ${YEARS} years ending ${endDate}. ` +
			'TAVG where available; otherwise (TMAX+TMIN)/2. Short gaps (<=7 days) linearly interpolated.',
		domain: 'climate',
		x_label: 'day of record',
		y_label: 'Daily mean temperature (°C)',
		info_columns: ['test_id', 'latitude', 'longitude', 'altitude_m', 'country', 'hemisphere'],
		provenance: {
			source: 'NOAA GHCN-Daily',
			citation:
				'Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E., & Houston, T. G. (2012). ' +
				'An overview of the Global Historical Climatology Network-Daily database. ' +
				'Journal of Atmospheric and Oceanic Technology, 29(7), 897-910. ' +
				'DOI: 10.1175/JTECH-D-11-00103.1',
			licence: 'Public domain (US federal data)',
			fetched_at: new Date().toISOString(),
			window: { start: startDate, end: endDate, days: N },
			dropped_stations: dropped
		},
		tests
	};

	writeFileSync(OUT, JSON.stringify(dataset));
	const sz = statSync(OUT).size;
	console.log(`\nwrote ${OUT} (${(sz / 1024 / 1024).toFixed(2)} MB)`);
	console.log(`retained ${tests.length} stations; dropped ${dropped.length}`);
	if (sz > 3 * 1024 * 1024) {
		console.error(`WARNING: file exceeds 3 MB target (${sz} bytes)`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
