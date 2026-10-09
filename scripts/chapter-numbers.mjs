#!/usr/bin/env node
// Chapter-numbers bench: loads the shipped finance / climate / battery JSON, runs
// the same analyzer functions the app runs, and prints every number the domain
// chapters quote. When static/data is rebuilt, rerun this and update the prose
// from its output instead of hand-editing numbers.
//
//   node scripts/chapter-numbers.mjs          (Node >= 23: imports the .ts analyzers)
//   node scripts/chapter-numbers.mjs --json   (machine-readable)

import { readFileSync } from 'node:fs';
import * as finance from '../src/lib/analyzers/finance.ts';
import * as climate from '../src/lib/analyzers/climate.ts';
import * as battery from '../src/lib/analyzers/battery.ts';

const load = (id) =>
	JSON.parse(readFileSync(new URL(`../static/data/${id}.json`, import.meta.url), 'utf8'));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

function pearson(xs, ys) {
	const pts = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => fin(x) && fin(y));
	const n = pts.length;
	const mx = pts.reduce((s, p) => s + p[0], 0) / n;
	const my = pts.reduce((s, p) => s + p[1], 0) / n;
	let sxy = 0, sxx = 0, syy = 0;
	for (const [x, y] of pts) {
		sxy += (x - mx) * (y - my);
		sxx += (x - mx) ** 2;
		syy += (y - my) ** 2;
	}
	return { r: +(sxy / Math.sqrt(sxx * syy)).toFixed(3), n };
}
const stats = (xs) => {
	const v = xs.filter(fin).sort((a, b) => a - b);
	if (!v.length) return { n: 0 };
	const q = (p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
	return { n: v.length, min: +v[0].toPrecision(4), median: +q(0.5).toPrecision(4), max: +v.at(-1).toPrecision(4) };
};
const safe = (f) => {
	try {
		const v = f();
		return fin(v) ? v : null;
	} catch {
		return null;
	}
};

const out = {};

// --- finance ---------------------------------------------------------------
{
	const d = load('finance');
	const rows = d.tests.map((t) => ({
		id: t.test_id,
		sector: t.meta.sector,
		AnnReturn: safe(() => finance.annualizedReturn(t)),
		AnnVol: safe(() => finance.annualizedVolatility(t)),
		Sharpe: safe(() => finance.sharpeRatio(t)),
		MaxDD: safe(() => finance.maxDrawdown(t).drawdown),
		Skew: safe(() => finance.skewness(t)),
		ExKurt: safe(() => finance.kurtosis(t)),
		VolCluster: safe(() => finance.volClusteringIndex(t))
	}));
	const sectors = [...new Set(rows.map((r) => r.sector))].sort();
	const bySector = Object.fromEntries(
		sectors.map((s) => {
			const g = rows.filter((r) => r.sector === s);
			const mean = (k) => +(g.reduce((a, r) => a + r[k], 0) / g.length).toFixed(3);
			return [s, { n: g.length, AnnVol: mean('AnnVol'), MaxDD: mean('MaxDD'), Sharpe: mean('Sharpe'), VolCluster: mean('VolCluster'), AnnReturn: mean('AnnReturn') }];
		})
	);
	const ewmaLast = d.tests.map((t) => safe(() => finance.ewmaVolatility(t).at(-1)));
	// Off-app beta proxy: OLS slope of each ticker's log returns on the
	// equal-weighted mean log return. Not an analyzer; quoted in the chapter
	// only as an outside-the-tool check.
	const rets = d.tests.map((t) => finance.logReturns(t));
	const T = rets[0].length;
	const mkt = Array.from({ length: T }, (_, i) => rets.reduce((a, r) => a + r[i], 0) / rets.length);
	const beta = rets.map((r) => {
		const mr = r.reduce((a, b) => a + b, 0) / T;
		const mm = mkt.reduce((a, b) => a + b, 0) / T;
		let c = 0, v = 0;
		for (let i = 0; i < T; i++) {
			c += (r[i] - mr) * (mkt[i] - mm);
			v += (mkt[i] - mm) ** 2;
		}
		return c / v;
	});
	const idx = [1];
	for (const m of mkt) idx.push(idx.at(-1) * Math.exp(m));
	const mdd = finance.maxDrawdown({ strain: idx.map((_, i) => i), stress: idx });
	const mean = (xs) => +(xs.filter(fin).reduce((a, b) => a + b, 0) / xs.filter(fin).length).toFixed(3);
	out.finance = {
		tickers: d.tests.length,
		days: d.tests[0].strain.length,
		sectors: sectors.length,
		note: d.generator_note,
		meta_keys: d.info_columns,
		corr_MaxDD_AnnVol: pearson(rows.map((r) => r.AnnVol), rows.map((r) => r.MaxDD)),
		corr_Sharpe_AnnVol: pearson(rows.map((r) => r.AnnVol), rows.map((r) => r.Sharpe)),
		AnnVol: stats(rows.map((r) => r.AnnVol)),
		MaxDD: stats(rows.map((r) => r.MaxDD)),
		Sharpe: stats(rows.map((r) => r.Sharpe)),
		ExKurt: stats(rows.map((r) => r.ExKurt)),
		ExKurt_positive: rows.filter((r) => r.ExKurt > 0).length,
		Skew: stats(rows.map((r) => r.Skew)),
		VolCluster: stats(rows.map((r) => r.VolCluster)),
		VolCluster_positive: rows.filter((r) => r.VolCluster > 0).length,
		ewma_last_daily: stats(ewmaLast),
		VolCluster_mean: mean(rows.map((r) => r.VolCluster)),
		ExKurt_mean: mean(rows.map((r) => r.ExKurt)),
		negative_AnnReturn: rows.filter((r) => r.AnnReturn < 0).map((r) => r.id),
		offapp_beta: stats(beta),
		offapp_corr_MaxDD_beta: pearson(beta, rows.map((r) => r.MaxDD)),
		eqw_index_maxDD: { drawdown: +mdd.drawdown.toFixed(3), peakDay: mdd.peakIdx, troughDay: mdd.troughIdx },
		bySector
	};
}

// --- climate ---------------------------------------------------------------
{
	const d = load('climate');
	const rows = d.tests.map((t) => {
		const h = safe(() => climate.fitHarmonicTrend(t).rSquared);
		return {
			id: t.test_id,
			lat: t.meta.latitude,
			absLat: Math.abs(t.meta.latitude),
			alt: t.meta.altitude_m,
			hemi: t.meta.hemisphere,
			AnnMean: safe(() => climate.annualMean(t)),
			SeasAmp: safe(() => climate.seasonalAmplitude(t)),
			Trend: safe(() => climate.trendPerYear(t)),
			HarmAmp: safe(() => climate.harmonicAmplitude(t)),
			HarmTrend: safe(() => climate.harmonicTrendPerYear(t)),
			HarmR2: h
		};
	});
	const col = (k) => rows.map((r) => r[k]);
	const extreme = (k, dir) =>
		[...rows].sort((a, b) => (dir * (a[k] - b[k])))[0];
	out.climate = {
		stations: d.tests.length,
		days: d.tests[0].strain.length,
		window: d.provenance?.window,
		dropped: d.provenance?.dropped_stations?.length,
		southern: rows.filter((r) => r.hemi === 'S').length,
		countries: new Set(d.tests.map((t) => t.meta.country)).size,
		lat_range: [Math.min(...col('lat')), Math.max(...col('lat'))],
		meta_keys: Object.keys(d.tests[0].meta),
		corr_AnnMean_absLat: pearson(col('absLat'), col('AnnMean')),
		corr_AnnMean_lat: pearson(col('lat'), col('AnnMean')),
		corr_SeasAmp_absLat: pearson(col('absLat'), col('SeasAmp')),
		corr_HarmAmp_absLat: pearson(col('absLat'), col('HarmAmp')),
		corr_Trend_absLat: pearson(col('absLat'), col('Trend')),
		corr_HarmTrend_absLat: pearson(col('absLat'), col('HarmTrend')),
		corr_HarmAmp_SeasAmp: pearson(col('SeasAmp'), col('HarmAmp')),
		// Leakage check: if the harmonic trend tracked amplitude, the |lat| signal would be suspect.
		corr_HarmTrend_HarmAmp: pearson(col('HarmAmp'), col('HarmTrend')),
		corr_Trend_HarmAmp: pearson(col('HarmAmp'), col('Trend')),
		HarmTrend_N: stats(rows.filter((r) => r.hemi === 'N').map((r) => r.HarmTrend)),
		HarmTrend_S: stats(rows.filter((r) => r.hemi === 'S').map((r) => r.HarmTrend)),
		largestTrend: extreme('Trend', -1).id,
		Trend: stats(col('Trend')),
		HarmTrend: stats(col('HarmTrend')),
		HarmR2: stats(col('HarmR2')),
		SeasAmp: stats(col('SeasAmp')),
		HarmAmp: stats(col('HarmAmp')),
		warmest: extreme('AnnMean', -1).id,
		coldest: extreme('AnnMean', 1).id,
		largestSeasAmp: extreme('SeasAmp', -1).id,
		smallestSeasAmp: extreme('SeasAmp', 1).id
	};
}

// --- battery ---------------------------------------------------------------
{
	const d = load('battery');
	const rows = d.tests.map((t) => {
		const fit = safe(() => battery.fitStretchedExp(t).rSquared);
		return {
			id: t.test_id,
			group: t.meta.cell_group,
			crate: t.meta.nominal_c_rate_charge,
			life: t.meta.cycle_life,
			C0: safe(() => battery.initialCapacity(t)),
			Cnow: safe(() => battery.currentCapacity(t)),
			Fade: safe(() => battery.fadePerCycle(t)),
			Cyc80: safe(() => battery.cyclesTo80Pct(t)),
			Knee: safe(() => battery.kneeCycle(t)),
			FadeExp: safe(() => battery.fadeExponent(t)),
			FadeK: safe(() => battery.fadeRateConstant(t)),
			FitR2: fit
		};
	});
	const col = (k) => rows.map((r) => r[k]);
	const groups = [...new Set(col('group'))].sort();
	out.battery = {
		cells: d.tests.length,
		x_range: [d.tests[0].strain[0], d.tests[0].strain.at(-1)],
		points_per_cell: stats(d.tests.map((t) => t.strain.length)),
		y_label: d.y_label,
		meta_keys: Object.keys(d.tests[0].meta),
		groups: Object.fromEntries(groups.map((g) => [g, rows.filter((r) => r.group === g).length])),
		policies: new Set(d.tests.map((t) => t.meta.policy)).size,
		crate: stats(col('crate')),
		cycle_life: stats(col('life')),
		corr_life_crate: pearson(col('crate'), col('life')),
		life_by_group: Object.fromEntries(groups.map((g) => [g, stats(rows.filter((r) => r.group === g).map((r) => r.life))])),
		C0: stats(col('C0')),
		Cnow: stats(col('Cnow')),
		Fade: stats(col('Fade')),
		Cyc80_nonnull: rows.filter((r) => r.Cyc80 !== null).length,
		Ret500_nonnull: d.tests.filter((t) => fin(safe(() => battery.retentionAt(t, 500)))).length,
		Ret90: stats(d.tests.map((t) => safe(() => battery.retentionAt(t, 90)))),
		Knee_nonnull: rows.filter((r) => r.Knee !== null).length,
		FadeExp: stats(col('FadeExp')),
		FadeK: stats(col('FadeK')),
		FitR2: stats(col('FitR2')),
		corr_life_Fade: pearson(col('Fade'), col('life')),
		corr_life_FadeExp: pearson(col('FadeExp'), col('life')),
		corr_life_FadeK: pearson(col('FadeK'), col('life')),
		corr_life_C0: pearson(col('C0'), col('life')),
		worked: ['3.6C(80%)-3.6C', '6C(40%)-3C', '5.3C(54%)-4C', '5.6C(19%)-4.6C'].map((p) => {
			const t = d.tests.filter((x) => x.meta.policy === p);
			return { policy: p, cells: t.length, cycle_life: t.map((x) => x.meta.cycle_life) };
		})
	};
}

if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else
	for (const [k, v] of Object.entries(out)) {
		console.log(`\n=== ${k}`);
		for (const [kk, vv] of Object.entries(v)) console.log(`${kk}: ${JSON.stringify(vv)}`);
	}
