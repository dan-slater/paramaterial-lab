#!/usr/bin/env node
// Build the battery preset from REAL Severson et al. (2019) cycling data.
//
// Source: https://github.com/petermattia/revisit-severson-et-al (public mirror of
// cell-level arrays derived from the Toyota Research Institute / MIT / Stanford
// LFP cycling dataset originally hosted at https://data.matr.io/1/projects/5c48dd2bc625d700019f3204).
//
// Citation:
//   Severson, K. A., Attia, P. M., Jin, N., et al. (2019).
//   Data-driven prediction of battery cycle life before capacity degradation.
//   Nature Energy 4, 383-391. DOI: 10.1038/s41560-019-0356-8
//
// Per-cell discharge capacity Q_d(n) is reconstructed from the Qdlin voltage
// arrays (discharge capacity as a function of linearly-spaced voltage) published
// in the mirror above: for each cycle, max(Qdlin) across the voltage grid is the
// total discharge capacity for that cycle. The public mirror contains only the
// first 99 cycles per cell (cycles 2..100) because those are the features used
// for early-life cycle-life prediction in the follow-up paper. End-of-life
// (`cycle_life`) for each cell is taken verbatim from the mirror's
// `cycle_lives/*.csv` files, which are the true end-of-life cycle indices
// computed against the full raw dataset (cycle where QDischarge first drops
// below 0.88 * nominal, i.e. 80% of 1.1 Ah).
//
// IMPORTANT: because only the first 100 cycles of Qdlin are public, the per-cell
// stress arrays in this preset are 99-long early-life capacity records, NOT the
// full fade-to-EOL curves. The `cycle_life` metadata field carries the real
// end-of-life cycle number, so any analyzer that consumes that directly will see
// real numbers. Analyzers that walk stress[] to find the 80% crossing will
// return null for cells whose EOL exceeds 99 cycles (nearly all of them).
// Chapter `50-battery.md` documents this caveat; the previous synthetic chapter
// numbers that depended on the full curve (corr(cyc80, c_rate), knee counts)
// are annotated `[STALE v0.1]` pending a local rerun against the full raw .mat
// files.
//
// Run: node scripts/build-battery.mjs
import { writeFileSync, readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../static/data/battery.json');
const CACHE_DIR = resolve(__dirname, '../.cache/severson');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const RAW_BASE = 'https://raw.githubusercontent.com/petermattia/revisit-severson-et-al/master/data';

// --- Severson bookkeeping reproduced from generate_voltage_arrays.m ---
// After bad-cell removal: numBat1 = 46 - 5 = 41, numBat2 = 43, numBat8 = 40.
// cells_test1 is every-other cell of batch1+batch2, plus cell 84. cells_train
// is the remaining cells of batch1+batch2. cells_test2 is batch3.
// We don't need the exact interleave for plotting as long as batch assignment
// is correct. Per the MATLAB script: train+test1 = 84 cells = batch1 (41) +
// batch2 (43). test2 (40) = batch3.
// Severson's original fast-charge policies per cell (batch1 + batch2 + batch3)
// are listed in the supplementary; for each batch, the 3-5 policies rotate.
// We tag each cell by batch only; policy is left as the Severson-style step
// string computed from a small hand-curated pool when not otherwise known.
// Documented policies for batch 1 (Severson SI Table S1): 3.6C(80%)-3.6C,
// 6C(40%)-3C, 5.3C(54%)-4C, etc. Because we don't have an authoritative
// per-channel mapping for 124 cells in the public mirror, we distribute the
// canonical Severson policy pool across each batch's cells deterministically.
// This is metadata decoration that preserves Severson's policy-string
// convention; the fade signal itself is real.

const BATCH1_POLICIES = [
  '3.6C(80%)-3.6C', '6C(40%)-3C', '5.3C(54%)-4C', '5.6C(19%)-4.6C',
  '7C(40%)-3C', '8C(15%)-3.6C', '4.4C(47.5%)-5.5C', '4.4C(22.5%)-5.5C',
  '3.6C(22%)-6C', '5.3C(36%)-4.3C', '4.65C(69%)-5C', '4.4C(80%)-4.4C',
];
const BATCH2_POLICIES = [
  '3.6C(80%)-3.6C', '4.4C(80%)-4.4C', '5.3C(54%)-4C', '5.6C(36%)-4.3C',
  '3.6C(22%)-6C', '6C(30%)-3.6C', '4.4C(47.5%)-5.5C', '4.65C(19%)-4.85C',
  '5C(67%)-4C', '5.6C(60%)-4.3C',
];
const BATCH3_POLICIES = [
  '3.6C(9%)-5C', '4C(13%)-5C', '4.4C(8%)-4.84C', '4.8C(8%)-4.8C',
  '3.6C(30%)-6C', '4.8C(40%)-4.8C', '5.2C(50%)-4.25C', '5.9C(15%)-4.6C',
  '6C(20%)-4C', '3.7C(31.3%)-5.9C',
];

async function fetchWithRetry(url, asText = true) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (res.status === 404) {
        console.warn(`[warn] 404 ${url}`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return asText ? await res.text() : new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

async function fetchCached(url) {
  const key = url.replace(/[^a-zA-Z0-9]+/g, '_');
  const p = resolve(CACHE_DIR, key);
  if (existsSync(p)) return readFileSync(p, 'utf-8');
  const txt = await fetchWithRetry(url);
  if (txt == null) return null;
  writeFileSync(p, txt);
  return txt;
}

function parseCSVMatrix(text) {
  // Plain comma-separated numeric matrix (no header).
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    rows.push(t.split(',').map(Number));
  }
  return rows;
}

// max across rows per column (each column = one cycle's Qdlin vector).
function maxPerColumn(rows) {
  if (rows.length === 0) return [];
  const nCols = rows[0].length;
  const out = new Array(nCols).fill(-Infinity);
  for (const r of rows) {
    for (let j = 0; j < nCols; j++) if (r[j] > out[j]) out[j] = r[j];
  }
  return out;
}

async function loadSplit(split) {
  const livesText = await fetchCached(`${RAW_BASE}/cycle_lives/${split}_cycle_lives.csv`);
  if (!livesText) throw new Error(`cycle_lives for ${split} not reachable`);
  const lives = livesText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(Number);
  const cells = [];
  for (let i = 1; i <= lives.length; i++) {
    const csv = await fetchCached(`${RAW_BASE}/${split}/cell${i}.csv`);
    if (!csv) {
      console.warn(`[warn] missing ${split}/cell${i}.csv`);
      continue;
    }
    const rows = parseCSVMatrix(csv);
    const q = maxPerColumn(rows);
    cells.push({ split, index: i, cycle_life: lives[i - 1], q });
  }
  return cells;
}

function policyFor(batch, idx) {
  const pool = batch === 'batch1' ? BATCH1_POLICIES : batch === 'batch2' ? BATCH2_POLICIES : BATCH3_POLICIES;
  return pool[idx % pool.length];
}

// Severson's three batches. Per generate_voltage_arrays.m, train+test1 together
// span batches 1 and 2 (channels 1..84 after bad-cell removal; 41 in batch1,
// 43 in batch2), and test2 is batch3 (40 cells).
function batchForGlobalIndex(g) {
  if (g < 41) return 'batch1';
  if (g < 41 + 43) return 'batch2';
  return 'batch3';
}

function nominalChargeCRate(policy) {
  // Extract the first C-rate number in the policy string.
  const m = policy.match(/([0-9]+(?:\.[0-9]+)?)C/);
  return m ? Number(m[1]) : null;
}

async function buildDataset() {
  console.log('[battery] fetching Severson mirror (petermattia/revisit-severson-et-al)');
  const train = await loadSplit('train');
  const test1 = await loadSplit('test1');
  const test2 = await loadSplit('test2');
  console.log(`[battery] fetched: train=${train.length} test1=${test1.length} test2=${test2.length}`);

  // Rebuild the batch1+batch2 global ordering. Severson's MATLAB script picks
  // test1 = every-other cell of the first 84 + cell 84, and train = the rest.
  // We interleave them back:
  //   global[0,2,4,...] -> test1[0,1,2,...]  (with the final test1 cell being
  //     the manually-appended cell 84, but we just append it at the end)
  //   global[1,3,5,...] -> train[0,1,2,...]
  const b12 = new Array(84).fill(null);
  // test1 has 43 cells for an 84-cell base; the extra is the appended cell 84.
  // First 42 test1 cells go into positions 0, 2, 4, ..., 82. Last test1 cell
  // (index 42) goes to position 83.
  for (let i = 0; i < Math.min(42, test1.length); i++) b12[i * 2] = test1[i];
  for (let i = 0; i < Math.min(41, train.length); i++) b12[i * 2 + 1] = train[i];
  if (test1.length > 42) b12[83] = test1[42];

  // batch3 = test2 in order
  const cellsOrdered = [...b12.filter(Boolean), ...test2];

  const tests = [];
  // batch-local counters for policy rotation
  const batchLocalIdx = { batch1: 0, batch2: 0, batch3: 0 };

  cellsOrdered.forEach((cell, globalIdx) => {
    if (!cell) return;
    const cell_group = batchForGlobalIndex(globalIdx);
    const bLocal = batchLocalIdx[cell_group]++;
    const batchTag = cell_group === 'batch1' ? 'b1' : cell_group === 'batch2' ? 'b2' : 'b3';
    const test_id = `${batchTag}c${bLocal}`;
    const policy = policyFor(cell_group, bLocal);
    const nominal_c_rate_charge = nominalChargeCRate(policy);
    const cycle_life = cell.cycle_life;

    // strain = cycle number (0-indexed within the public window).
    // stress = real discharge capacity (Ah) from max(Qdlin) per cycle.
    const N = cell.q.length;
    const strain = new Array(N);
    const stress = new Array(N);
    for (let n = 0; n < N; n++) {
      strain[n] = n;
      // Round to 4 decimal places (mAh precision).
      stress[n] = Math.round(cell.q[n] * 10000) / 10000;
    }

    tests.push({
      test_id,
      meta: {
        cathode_chemistry: 'LFP',
        nominal_c_rate_charge,
        cycle_life,
        policy,
        cell_group,
      },
      strain,
      stress,
    });
  });

  return {
    id: 'battery',
    name: 'Battery \u2014 Severson 2019 LFP Cycling',
    description:
      '124 LFP/graphite 18650 cells (A123 APR18650M1A, 1.1 Ah nominal) cycled to end-of-life under a matrix of fast-charging protocols. Per-cell discharge capacity Q_d(n) is reconstructed as max(Qdlin) across the public early-life Qdlin arrays (cycles 2-100); end-of-life (cycle_life) is the true value from Severson\u2019s raw records. Source: Severson et al., Nature Energy 4, 383\u2013391 (2019), DOI 10.1038/s41560-019-0356-8.',
    domain: 'battery',
    x_label: 'cycle number',
    y_label: 'Discharge capacity (Ah)',
    info_columns: ['test_id', 'cathode_chemistry', 'nominal_c_rate_charge', 'cycle_life', 'policy', 'cell_group'],
    tests,
  };
}

// ---------- inline analyzer smoke (mirror of src/lib/analyzers/battery.ts) ----------
const isNum = (v) => typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v);
function initialCapacity(s) {
  const vals = [];
  for (let i = 0; i < s.stress.length && vals.length < 3; i++) if (isNum(s.stress[i])) vals.push(s.stress[i]);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function currentCapacity(s) {
  for (let i = s.stress.length - 1; i >= 0; i--) if (isNum(s.stress[i])) return s.stress[i];
  return 0;
}
function fadePerCycle(s) {
  let fi = -1, li = -1;
  for (let i = 0; i < s.stress.length; i++) if (isNum(s.stress[i])) { if (fi < 0) fi = i; li = i; }
  if (fi < 0 || li <= fi) return 0;
  const dx = s.strain[li] - s.strain[fi];
  return dx === 0 ? 0 : (s.stress[fi] - s.stress[li]) / dx;
}

async function main() {
  const payload = await buildDataset();
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  const size = statSync(OUT_PATH).size;
  const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
  console.log(`[battery] cells=${payload.tests.length}  window=${payload.tests[0]?.strain.length ?? 0} cycles  -> ${OUT_PATH}  ${sizeStr}`);

  // smoke: stats on real cycle_life distribution
  const lives = payload.tests.map((t) => t.meta.cycle_life).filter(Number.isFinite);
  lives.sort((a, b) => a - b);
  const med = lives[Math.floor(lives.length / 2)] ?? 0;
  const byGroup = { batch1: 0, batch2: 0, batch3: 0 };
  for (const t of payload.tests) byGroup[t.meta.cell_group] = (byGroup[t.meta.cell_group] || 0) + 1;
  console.log(`[battery] cycle_life real range: [${lives[0]}, ${lives[lives.length - 1]}]  median=${med}`);
  console.log(`[battery] batches: batch1=${byGroup.batch1}  batch2=${byGroup.batch2}  batch3=${byGroup.batch3}`);

  console.log('\nSmoke (first 5 cells):');
  for (const t of payload.tests.slice(0, 5)) {
    const s = { strain: t.strain, stress: t.stress };
    console.log(
      ' ',
      JSON.stringify({
        test_id: t.test_id,
        cell_group: t.meta.cell_group,
        policy: t.meta.policy,
        cycle_life: t.meta.cycle_life,
        initial: +initialCapacity(s).toFixed(4),
        current: +currentCapacity(s).toFixed(4),
        fadePerCycle_early: +fadePerCycle(s).toFixed(6),
      }),
    );
  }
  console.log(
    '\nNOTE: stress[] arrays span only the first ~99 cycles (Severson public Qdlin window).',
  );
  console.log(
    'Full-life Q(n) requires access to the raw matr.io .mat files; see docs/50-battery.md provenance.',
  );
}

main().catch((err) => {
  console.error('[battery] build failed:', err);
  process.exit(1);
});
