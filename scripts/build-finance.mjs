#!/usr/bin/env node
// Build finance.json from real daily adjusted-close prices.
//
// Preferred source: Stooq (https://stooq.com) per-ticker daily CSV.
//   URL: https://stooq.com/q/d/l/?s=<ticker>.us&i=d[&apikey=<key>]
//   Stooq now gates CSV downloads behind a free per-user apikey; set
//   STOOQ_APIKEY in the environment to use Stooq. Adjusted close is applied
//   server-side for US equities, so the CSV Close column is adjusted.
//
// Fallback source: Yahoo finance chart API (no auth, rate-limited).
//   URL: https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?range=3y&interval=1d
//   The indicators.adjclose[0].adjclose series is split/dividend adjusted.
//
// Usage: `node scripts/build-finance.mjs` from web/.
// No npm deps (Node >= 20 global fetch).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../static/data/finance.json');

const TARGET_DAYS = 504;
const FETCH_DELAY_MS = 250;
const STOOQ_APIKEY = process.env.STOOQ_APIKEY || '';
const FORCE_SOURCE = process.env.FINANCE_SOURCE || ''; // 'stooq' | 'yahoo' | ''

// Ticker universe: 40 tickers across 8 sectors. Sector buckets match the
// v0.1 synthetic preset so chapter prose about sector clustering still reads.
const SECTORS = {
  Technology:  ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'ORCL', 'ADBE'],
  Energy:      ['XOM', 'CVX', 'COP', 'SLB', 'EOG'],
  Healthcare:  ['JNJ', 'PFE', 'UNH', 'LLY', 'MRK', 'ABBV'],
  Financials:  ['JPM', 'BAC', 'GS', 'MS', 'WFC'],
  Consumer:    ['AMZN', 'WMT', 'KO', 'PG', 'MCD'],
  Industrials: ['BA', 'CAT', 'GE', 'HON', 'UPS'],
  Utilities:   ['NEE', 'DUK', 'SO'],
  Materials:   ['LIN', 'FCX', 'APD', 'NEM']
};

// Short industry-group label per ticker (not load-bearing).
const INDUSTRY_GROUP = {
  AAPL: 'Consumer Electronics', MSFT: 'Software', NVDA: 'Semiconductors',
  GOOGL: 'Interactive Media', META: 'Interactive Media', ORCL: 'Software',
  ADBE: 'Software',
  XOM: 'Integrated Oil & Gas', CVX: 'Integrated Oil & Gas',
  COP: 'Oil & Gas E&P', SLB: 'Oil & Gas Services', EOG: 'Oil & Gas E&P',
  JNJ: 'Pharmaceuticals', PFE: 'Pharmaceuticals', UNH: 'Managed Care',
  LLY: 'Pharmaceuticals', MRK: 'Pharmaceuticals', ABBV: 'Pharmaceuticals',
  JPM: 'Banks', BAC: 'Banks', GS: 'Capital Markets',
  MS: 'Capital Markets', WFC: 'Banks',
  AMZN: 'Broadline Retail', WMT: 'Consumer Staples Retail',
  KO: 'Beverages', PG: 'Household Products', MCD: 'Restaurants',
  BA: 'Aerospace & Defense', CAT: 'Machinery', GE: 'Industrial Conglomerates',
  HON: 'Industrial Conglomerates', UPS: 'Air Freight & Logistics',
  NEE: 'Electric Utilities', DUK: 'Electric Utilities', SO: 'Electric Utilities',
  LIN: 'Industrial Gases', FCX: 'Copper Mining',
  APD: 'Industrial Gases', NEM: 'Gold Mining'
};

const UA = 'Mozilla/5.0 (compatible; paramaterial-build/0.2)';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchRetry(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { status: res.status, body: await res.text(), ok: false };
      return { status: res.status, body: await res.text(), ok: true };
    } catch (e) {
      lastErr = e;
      await sleep(400);
    }
  }
  throw lastErr;
}

// Stooq CSV parser: headers are Date,Open,High,Low,Close,Volume
// Returns [{date: 'YYYY-MM-DD', close: number}, ...] sorted ascending.
function parseStooqCSV(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const iDate = header.indexOf('date');
  const iClose = header.indexOf('close');
  if (iDate < 0 || iClose < 0) return [];
  const rows = [];
  for (let k = 1; k < lines.length; k++) {
    const cols = lines[k].split(',');
    const d = cols[iDate];
    const c = parseFloat(cols[iClose]);
    if (d && isFinite(c)) rows.push({ date: d, close: c });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

async function fetchStooq(ticker) {
  const q = ticker.toLowerCase();
  const apikeyPart = STOOQ_APIKEY ? `&apikey=${encodeURIComponent(STOOQ_APIKEY)}` : '';
  const url = `https://stooq.com/q/d/l/?s=${q}.us&i=d${apikeyPart}`;
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error(`Stooq ${ticker} HTTP ${r.status}`);
  // Stooq returns a plain-text "Get your apikey..." body when no key.
  if (!/^date,/i.test(r.body)) {
    throw new Error(`Stooq ${ticker} non-CSV response (apikey required?)`);
  }
  const rows = parseStooqCSV(r.body);
  if (rows.length < 50) throw new Error(`Stooq ${ticker} only ${rows.length} rows`);
  return rows;
}

async function fetchYahoo(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=3y&interval=1d`;
  const r = await fetchRetry(url);
  if (!r.ok) throw new Error(`Yahoo ${ticker} HTTP ${r.status}`);
  let j;
  try { j = JSON.parse(r.body); } catch { throw new Error(`Yahoo ${ticker} bad JSON`); }
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(`Yahoo ${ticker} empty result`);
  const ts = res.timestamp || [];
  const adj = res.indicators?.adjclose?.[0]?.adjclose || [];
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const c = adj[i];
    if (c == null || !isFinite(c)) continue;
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    rows.push({ date, close: Math.round(c * 10000) / 10000 });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rows.length < 50) throw new Error(`Yahoo ${ticker} only ${rows.length} rows`);
  return rows;
}

async function fetchTicker(ticker, source) {
  if (source === 'stooq') return fetchStooq(ticker);
  if (source === 'yahoo') return fetchYahoo(ticker);
  throw new Error(`unknown source ${source}`);
}

async function pickSource() {
  if (FORCE_SOURCE === 'stooq' || FORCE_SOURCE === 'yahoo') return FORCE_SOURCE;
  // Try Stooq on a single probe ticker; if it yields a CSV, use Stooq.
  try {
    await fetchStooq('AAPL');
    return 'stooq';
  } catch (e) {
    console.warn(`[probe] Stooq unavailable (${e.message}); falling back to Yahoo`);
    return 'yahoo';
  }
}

function alignOnCommonDates(perTicker) {
  // Intersect date sets across all tickers, take the last TARGET_DAYS.
  const tickers = Object.keys(perTicker);
  if (tickers.length === 0) return { dates: [], byTicker: {} };
  let common = new Set(perTicker[tickers[0]].map((r) => r.date));
  for (let i = 1; i < tickers.length; i++) {
    const s = new Set(perTicker[tickers[i]].map((r) => r.date));
    common = new Set([...common].filter((d) => s.has(d)));
  }
  const dates = [...common].sort();
  const trimmed = dates.slice(-TARGET_DAYS);
  const dateSet = new Set(trimmed);
  const byTicker = {};
  for (const t of tickers) {
    const map = new Map(perTicker[t].map((r) => [r.date, r.close]));
    byTicker[t] = trimmed.map((d) => map.get(d));
  }
  return { dates: trimmed, byTicker };
}

async function main() {
  const t0 = Date.now();
  const source = await pickSource();
  console.log(`[source] using ${source}${source === 'stooq' && STOOQ_APIKEY ? ' (with apikey)' : ''}`);

  const perTicker = {};
  const failed = [];
  const allTickers = [];
  for (const [sector, list] of Object.entries(SECTORS)) {
    for (const t of list) allTickers.push([t, sector]);
  }

  for (const [ticker, sector] of allTickers) {
    try {
      const rows = await fetchTicker(ticker, source);
      perTicker[ticker] = rows;
      const first = rows[0], last = rows[rows.length - 1];
      console.log(`${ticker}: ${rows.length} rows, $${first.close.toFixed(2)} -> $${last.close.toFixed(2)}  [${first.date} .. ${last.date}]  (${sector})`);
    } catch (e) {
      console.warn(`${ticker}: FAILED (${e.message}) -- skipping`);
      failed.push(ticker);
    }
    await sleep(FETCH_DELAY_MS);
  }

  if (Object.keys(perTicker).length === 0) {
    throw new Error('no tickers fetched successfully; aborting');
  }

  const { dates, byTicker } = alignOnCommonDates(perTicker);
  if (dates.length < 50) {
    throw new Error(`only ${dates.length} common dates after alignment; aborting`);
  }
  if (dates.length < TARGET_DAYS) {
    console.warn(`[align] only ${dates.length} common dates available (target ${TARGET_DAYS}); writing what we have`);
  }

  const tests = [];
  for (const [sector, list] of Object.entries(SECTORS)) {
    for (const ticker of list) {
      const series = byTicker[ticker];
      if (!series || series.some((v) => v == null || !isFinite(v))) {
        console.warn(`${ticker}: dropped from output (gap after alignment)`);
        continue;
      }
      const stress = series.map((v) => Math.round(v * 100) / 100);
      const strain = stress.map((_, i) => i);
      tests.push({
        test_id: ticker,
        meta: {
          sector,
          country: 'USA',
          industry_group: INDUSTRY_GROUP[ticker] || sector
        },
        strain,
        stress
      });
    }
  }

  // Assert alignment.
  const N = tests[0].stress.length;
  for (const t of tests) {
    if (t.stress.length !== N) {
      throw new Error(`ticker ${t.test_id} has ${t.stress.length} rows, expected ${N}`);
    }
  }

  const dateFirst = dates[0];
  const dateLast = dates[dates.length - 1];

  const dataset = {
    id: 'finance',
    name: `Finance — Daily Stock Returns (${source === 'yahoo' ? 'Yahoo Finance' : 'Stooq'})`,
    description: `Real adjusted-close prices for ${tests.length} US equities across 8 sectors, pulled from ${source === 'yahoo' ? 'Yahoo Finance' : 'Stooq'}.`,
    domain: 'finance',
    x_label: 'trading day',
    y_label: 'Adjusted close (USD)',
    info_columns: ['test_id', 'sector', 'country', 'industry_group'],
    generator_note: `Built ${new Date().toISOString()} from source=${source}. Aligned on ${dates.length} common business days from ${dateFirst} to ${dateLast}. Failed tickers: ${failed.join(',') || 'none'}.`,
    tests
  };

  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(dataset, null, 2);
  writeFileSync(OUT, json);

  const sizeMB = json.length / (1024 * 1024);
  console.log('---');
  console.log(`wrote ${OUT}`);
  console.log(`shape: ${tests.length} tickers × ${N} aligned days  (${dateFirst} .. ${dateLast})`);
  console.log(`size:  ${sizeMB.toFixed(2)} MB`);
  console.log(`source=${source}  failed=${failed.length ? failed.join(',') : 'none'}`);
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (sizeMB > 3) throw new Error(`JSON too large: ${sizeMB.toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
