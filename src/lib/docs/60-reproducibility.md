---
title: Reproducibility
slug: reproducibility
---

# Reproducibility

Documentation without a reproducibility statement is a demo, not research output. This page pins every moving part a reader needs to reproduce every number quoted in the rest of the docs.

## Version pinning

- **paramaterial-web** — the SvelteKit app that renders these docs and the editor. Versioned in `web/package.json`; this documentation tracks **v0.1.0**.
- **paramaterial (Python)** — the original library whose workflow the web app generalises. Not required to reproduce any web-app number, but all five materials case studies in `20-materials.md` originate in notebooks executed against the Python library at the `0.1.0` tag.
- **paramaterial-examples** — `dan-slater/paramaterial-examples`, the public companion repo whose five MSc notebooks define the bar for the materials chapter. The notebook tags referenced in this documentation are `dan_msc_basic_usage_0.1.0`, `dan_msc_cs1_0.1.0`, `dan_msc_cs2_0.1.0`, `dan_msc_cs3_0.1.0`, `dan_msc_cs4_0.1.0`.

## Build environment

The numbers in these docs were produced under the following environment. Different Node versions give identical output because every random number in the synthetic datasets goes through a deterministic mulberry32 PRNG; no platform-specific floating-point differences should survive the rounding in each builder.

| Component | Pinned version |
|-----------|----------------|
| Node.js | ≥ 20.0 (tested on 25.6) |
| SvelteKit | ^2.57 |
| Svelte (runes) | ^5.55 |
| adapter-node | ^5.5 |
| marked | ^18.0 |
| uPlot | ^1.6 |
| Playwright (tests) | ^1.59 |

## Synthetic dataset seeds

Every non-materials dataset is deterministic. Rebuild the JSON with:

```bash
node scripts/build-finance.mjs
node scripts/build-climate.mjs
node scripts/build-battery.mjs
```

Each writes to `static/data/<domain>.json`. The seeds used:

| Dataset | Seed | PRNG | Generator file |
|---------|------|------|----------------|
| `finance` | `20260421` | mulberry32 | `scripts/build-finance.mjs` |
| `climate` | `0xC11A7E` (plus per-station offset) | mulberry32 | `scripts/build-climate.mjs` |
| `battery` | `20260421` | mulberry32 | `scripts/build-battery.mjs` |

If any number in the domain chapters disagrees with what your local build produces, the first thing to check is that your local `static/data/<domain>.json` was not over-written by a rebuild with a different seed.

## Materials datasets

The materials presets `basic-usage`, `cs1`, `cs2`, `cs3`, and `cs4` are **not synthetic** — they are downsampled JSON re-encodings of the full CSV+info-table datasets in `dan-slater/paramaterial-examples`. Regenerating them requires that repository to be cloned locally and the Python `paramaterial` library to be installed; the web app does not rebuild them automatically.

Each JSON preserves per-test strain/stress arrays (≤ 2 000 samples per test, decimated from the raw ~10⁴ samples) plus the original metadata table. The decimation preserves UTS and the elastic-fit window to within < 0.5 % but does lose fine-grained fracture-tail detail.

## Reproducing a quoted figure

Every "Reproducing in the web tool" section in the domain chapters is a deterministic click-path. The app's state is serialised into `localStorage` under the key `paramaterial:blocks:v1`, so after you walk the click-path once you can copy the JSON from the Export menu and share it.

When you load a preset, the following happens:

1. The dataset is fetched from `/data/<id>.json` and held in memory.
2. The blocks you add read it from the `datasetStore` singleton.
3. Every analyzer runs client-side in TypeScript. No network calls are made after the initial dataset fetch.

Because all computation is client-side, the numbers you see in your browser are the numbers that went into the docs — there is no server-side caching layer.

## Known sources of drift

1. **Text rounding.** Correlation numbers in the chapter prose are quoted to 2 decimals; raw `Float64` values will agree to 10+ decimals with a byte-identical build.
2. **Dataset version bumps.** If a builder script is edited (even trivially), rerun it and the seeds will still be deterministic, but the generator-internal state may shift. Pin the `scripts/build-*.mjs` SHA when reproducing.
3. **Analyzer threshold changes.** The knee-detection slope ratio (`2×`), the UPL/LPL fit-window fraction (`0.1`), and the Ramberg–Osgood proof strain (`0.002`) are all tuneable in the source. The methodology chapter flags every tuneable parameter; the values used to produce docs numbers are the current source defaults.

## Changelog

- **v0.1.0** (2026-04-21) — initial documentation set: overview, methodology, materials (5 case studies), finance, climate, battery, glossary, this page. Two supervisor review passes in-repo as `SUPERVISOR_REVIEW.md` and `SUPERVISOR_REVIEW_2.md`.
