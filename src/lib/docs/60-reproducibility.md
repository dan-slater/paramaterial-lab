---
title: Reproducibility
slug: reproducibility
---

# Reproducibility

Documentation without a reproducibility statement is a demo, not research output. This page pins every moving part a reader needs to reproduce every number quoted in the rest of the docs.

## Version pinning

- **paramaterial lab** — the SvelteKit app that renders these docs and the editor (`web/` in the `paramaterial-lab` repo). This documentation tracks **v0.2**: three real-data presets, the harmonic and stretched-exponential fits, EWMA and rolling volatility, CSV import and the `/lab/<preset>` routes.
- **paramaterial (Python)** — the original library whose workflow the web app generalises. Not required to reproduce any web-app number, but all five materials case studies in `20-materials.md` originate in notebooks executed against the Python library at the `0.1.0` tag.
- **paramaterial-examples** — `dan-slater/paramaterial-examples`, the public companion repo whose five MSc notebooks define the bar for the materials chapter. The notebook tags referenced in this documentation are `dan_msc_basic_usage_0.1.0`, `dan_msc_cs1_0.1.0`, `dan_msc_cs2_0.1.0`, `dan_msc_cs3_0.1.0`, `dan_msc_cs4_0.1.0`.

## Build environment

| Component | Pinned version |
|-----------|----------------|
| Node.js | ≥ 20 to build and run the app; ≥ 23 for `scripts/chapter-numbers.mjs` and `scripts/test-csv-import.mjs`, which import the TypeScript analyzers directly (tested on 26.0) |
| SvelteKit | ^2.57 |
| Svelte (runes) | ^5.55 |
| adapter-node | ^5.5 |
| marked | ^18.0 |
| uPlot | ^1.6 |
| Playwright (tests) | ^1.59 |

The analyzers are plain TypeScript doing IEEE-754 double arithmetic in a fixed order, so the same JSON gives the same numbers on any platform to well beyond the two decimals quoted in prose.

## Data-source pinning

The finance, climate and battery presets are **real data fetched from the network**, not seeded generators. A rebuild is therefore *not* guaranteed to reproduce the shipped JSON: sources update, windows slide, and mirrors can change. What is pinned is the source URL, the build script, and the snapshot the docs were computed from.

| Dataset | Source | Build script | Cache | Overrides | Shipped snapshot |
|---------|--------|--------------|-------|-----------|------------------|
| `finance` | Stooq `https://stooq.com/q/d/l/?s=<ticker>.us&i=d`, falling back to Yahoo Finance `https://query1.finance.yahoo.com/v8/finance/chart/<TICKER>?range=3y&interval=1d` | `scripts/build-finance.mjs` | none (refetched every run) | `STOOQ_APIKEY` (Stooq now requires a free key), `FINANCE_SOURCE=stooq\|yahoo` to force a source | Built 2026-04-22 from Yahoo; 504 business days, 2024-04-17 → 2026-04-21 (see `generator_note` in the JSON) |
| `climate` | NOAA GHCN-Daily, `https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt` and `.../by_station/<ID>.csv.gz` | `scripts/build-climate.mjs` | `web/.cache/ghcn/` | `CLIMATE_END=YYYYMMDD` (default `20250820`); window length is `YEARS` in the script (3) | Fetched 2026-04-22; 30 of 41 stations, 2022-08-22 → 2025-08-20 (see `provenance` in the JSON) |
| `battery` | Severson et al. 2019 via the GitHub mirror `https://raw.githubusercontent.com/petermattia/revisit-severson-et-al/master/data` (original: matr.io project `5c48dd2bc625d700019f3204`) | `scripts/build-battery.mjs` | `web/.cache/severson/` | none | 124 cells, early-life window (cycles 2–100) |

Rebuild with:

```bash
node scripts/build-finance.mjs     # network every run
node scripts/build-climate.mjs     # network once, then .cache/ghcn
node scripts/build-battery.mjs     # network once, then .cache/severson
node scripts/build-samples.mjs     # re-cut the CSV import samples from the new JSON
node scripts/chapter-numbers.mjs   # recompute every number the chapters quote
```

Each writes `static/data/<domain>.json`, which is gitignored. The cached climate and battery downloads make a second rebuild on the same machine reproduce the first byte-for-byte; finance has no cache and always reflects the latest window. **After any rebuild, rerun `scripts/chapter-numbers.mjs` and update the chapter prose from its output.** No chapter number should be edited by hand.

## Materials datasets

The materials presets `basic-usage`, `cs1`, `cs2`, `cs3`, and `cs4` are **not synthetic** — they are downsampled JSON re-encodings of the full CSV+info-table datasets in `dan-slater/paramaterial-examples`. Regenerate them with `PARAMATERIAL_EXAMPLES=<clone>/examples python3 scripts/build_data.py` (Python with pandas and openpyxl; the script does not import `paramaterial` itself). It writes to `web/static/data/` unless `PARAMATERIAL_DATA_OUT` says otherwise. The web app does not rebuild them automatically.

Each JSON preserves per-test strain/stress arrays (≤ 2 000 samples per test, decimated from the raw ~10⁴ samples) plus the original metadata table. The decimation preserves UTS and the elastic-fit window to within < 0.5 % but does lose fine-grained fracture-tail detail.

## Reproducing a quoted figure

Every "Reproducing in the web tool" section in the domain chapters is a click-path, and each preset has a stable URL that opens it with its report template: `/lab/materials`, `/lab/finance`, `/lab/climate`, `/lab/battery` (and `/lab/cs1` … `/lab/cs4` for the thesis case studies). The app's state is serialised into `localStorage` under the key `paramaterial:blocks:v1`, so after you walk the click-path once you can copy a share link from the Export menu.

When you load a preset, the following happens:

1. The dataset is fetched from `/data/<id>.json` and held in memory.
2. The blocks you add read it from the `datasetStore` singleton.
3. Every analyzer runs client-side in TypeScript. No network calls are made after the initial dataset fetch (the optional Claude chat talks to Anthropic directly with the visitor's own key, and saved projects talk to the app's own server; neither touches the numbers).

Because all computation is client-side and `scripts/chapter-numbers.mjs` imports the very same analyzer files, the numbers you see in your browser are the numbers that went into the docs.

## Known sources of drift

1. **Text rounding.** Correlation numbers in the chapter prose are quoted to 2 decimals; raw `Float64` values will agree to 10+ decimals with a byte-identical build.
2. **Data rebuilds.** Finance always refetches and its window slides; climate changes if NOAA revises a station or `CLIMATE_END` moves; battery changes only if the mirror does. Keep the shipped JSON (or its `generator_note` / `provenance` fields) alongside any number you quote, and pin the `scripts/build-*.mjs` commit.
3. **Analyzer threshold changes.** The knee-detection slope ratio (`2×`), the UPL/LPL fit-window fraction (`0.1`), and the Ramberg–Osgood proof strain (`0.002`) are all tuneable in the source. The methodology chapter flags every tuneable parameter; the values used to produce docs numbers are the current source defaults.

## Changelog

- **v0.2** (2026-10-09) — finance, climate and battery presets switched from seeded synthetic generators to real data (Yahoo/Stooq equities, NOAA GHCN-Daily, Severson 2019); new analyzers `rollingVolatility`, `ewmaVolatility`, `volClusteringIndex` (finance), `fitHarmonicTrend`, `harmonicAmplitude`, `harmonicTrendPerYear` (climate), `fitStretchedExp`, `fadeExponent`, `fadeRateConstant` (battery), with registry rows `VolCluster`, `HarmAmp`, `HarmTrend`, `FadeExp`, `FadeK`; battery units corrected to Ah; `retentionAt` no longer extrapolates past the record; in-browser CSV import; `/lab/<preset>` routes; `scripts/chapter-numbers.mjs` added and every domain-chapter number recomputed from the shipped JSON (closing `SUPERVISOR_REVIEW_4.md` Tier A; self-assessment in `SUPERVISOR_REVIEW_5.md`).
- **v0.1.0** (2026-04-21) — initial documentation set: overview, methodology, materials (5 case studies), finance, climate, battery, glossary, this page. Two supervisor review passes in-repo as `SUPERVISOR_REVIEW.md` and `SUPERVISOR_REVIEW_2.md`.
