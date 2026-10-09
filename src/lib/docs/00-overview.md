---
title: Overview
slug: overview
---

# A research tool for series → parameters → parameter-vs-parameter analysis

A paramaterial *dataset* is a collection of `(x, y)` series, one per entity, each carrying a bag of metadata. The entity can be a tensile specimen, an equity ticker, a weather station, or a lithium-ion cell; the series can be a stress–strain curve, a price history, a temperature record, or a discharge-capacity trace. The workflow is always the same three moves: plot the *series*, reduce each series to a handful of scalar *parameters* using a domain analyzer, then produce a *parameter-vs-parameter scatter* (or parameter-vs-metadata scatter) across the population so that cross-sectional structure becomes visible.

## Where the abstraction came from

The tool started life as a Python library for extracting mechanical properties from uniaxial tensile tests: one stress–strain curve per specimen, analyzers for Young's modulus, 0.2 % proof stress, UTS, Ramberg–Osgood exponents and Zener–Hollomon parameters, and a final scatter of yield stress against temperature across a 154-specimen, 9-lot, 20–300 °C matrix. Nothing in that pipeline is specifically about metal. A materials engineer's *specimen → test → parameter → scatter* is structurally the same pattern a quant, a climatologist, or a battery scientist reaches for when they ask "does this per-entity scalar depend on that per-entity metadatum?". That is the single sentence that justifies the generalisation, and the other three presets in the tool are there to stress-test it.

## The four shipped case studies

The app ships with four preset datasets, each demonstrating the same pipeline on a different domain. The canonical plot in each case is the scatter a domain expert would actually produce — the materials version is reproduced below as a reference for what the tool's final artefact looks like.

![0.2% proof stress vs temperature — the canonical materials scatter, here on the basic-usage preset](/docs-img/materials-scatter.png)

- **Materials.** 154 real tensile tests across 9 lots, 20–300 °C, from `dan-slater/paramaterial-examples`. The canonical plot is **0.2 % proof stress vs temperature**; the softening trend is the thing you want to see. A few specimens sit at or near zero in the figure: those are tests where the automatic elastic-window fit behind the proof stress fails, not real values, and they are the reason the materials case studies screen curves before extracting properties.
- **Finance.** 40 real US large-cap tickers across 8 sectors over 504 trading days (2024-04-17 → 2026-04-21), shipped as a Yahoo Finance snapshot (the builder prefers Stooq, which now needs a key). The canonical plot is **max drawdown vs annualized volatility** (r = +0.79): higher-volatility names draw down harder. β is *not* a metadata field (it is a derived quantity against a market factor); the chapter's generalisation section proposes the schema extension that would make β a first-class analyzer.
- **Climate.** 30 real NOAA GHCN-Daily stations, three years (2022-08-22 → 2025-08-20) of daily mean temperature. The canonical plot is **annual mean vs latitude**; `corr(annual_mean, |lat|) = −0.86`. Seasonal amplitude correlates only loosely with |lat| (+0.51), and no warming trend is recoverable from a three-year record; the chapter shows why.
- **Battery.** 124 real LFP/graphite 18650 cells from the Severson et al. 2019 *Nature Energy* release (Toyota Research Institute / MIT / Stanford), fetched from a public mirror. The canonical plot is **cycle_life vs nominal_c_rate_charge**; `cycle_life` (true Severson end of life) runs 148–2 237 cycles, and the first-step charge rate (3.6–8 C) does **not** predict it (r = −0.03). Batch and early-life fade do. Per-cell capacity arrays span only the public early-life window (cycles 2–100); the chapter documents how to extend to full life.

Every number in these paragraphs and in the domain chapters is computed by `node scripts/chapter-numbers.mjs` from the shipped JSON. Each preset also has a shareable URL that opens it with its report template: `/lab/materials`, `/lab/finance`, `/lab/climate`, `/lab/battery`. You can also import your own CSV from the dataset picker; it is parsed in the browser into the same shape.

## Quick-start — six clicks to the full pipeline

If you do nothing else on first use, do this. It exercises every core concept.

1. **Load preset** → open `/lab/materials`, or pick *Materials — Uniaxial Tension* in the dataset picker. A 154-specimen materials dataset loads into memory. (The route also adds this walk-through's blocks for you; the steps below build them by hand.)
2. **Add a Stress–strain block** → the raw curves render, one per specimen. Pick `lot` in the block's *Color by* menu to colour-code by lot.
3. **Add a Parameters block** → it computes every registered materials parameter, one row per specimen: **Young's modulus** (key `E`), **0.2% proof stress** (key `ProofStress`) and **Ultimate tensile strength** (key `UTS`). ([see methodology §2 for formulas](#2-materials-analyzers))
4. **Add a Parameter scatter block** → Y = *0.2% proof stress (MPa)*, X = *temperature* (from metadata).
5. **Swap axes** → flip X and Y, or change Y to *Young's modulus*. Nothing re-computes; the scatter just re-binds. (The scatter plots numeric axes only and has no colour key yet, so lot-to-lot offsets are read from the Stress–strain block and the Parameters table.)
6. **Done.** You have just run the same pipeline that structures every other preset — open `/lab/finance` to see it again with drawdown against volatility.

## Design rationale

The tool's core unit is a *Svelte-hosted report* composed of blocks because a report is what a working scientist actually writes: a sequence of plots and tables interleaved with commentary, each element bound to a small piece of configuration. Plots are colocated with their configuration — axis choices, colour keys, selected analyzers — so that the thing you see and the thing you would re-run are never separated; there is no hidden `plot.py` to chase. The chat pane exists because most of the day-to-day friction is not in the click path but in the "what analyzer should I use here" question, and keeping a domain-aware assistant in the same surface as the blocks means you can answer it without leaving the report.

## Scope and non-goals

This is a research and teaching tool. It is **not** a replacement for domain-specific analysis libraries (scipy, statsmodels, pybamm, xarray); it is **not** a backtester and cannot model transaction costs, slippage, or realistic factor structure; it is **not** a climate reanalysis product and does not ingest ERA5 or CMIP; it is **not** a battery validation platform and does not model EIS, DVA, or coupled electro-thermal behaviour. Four small real datasets do not make a production tool. The generalisation claim is that the *workflow abstraction* holds; the per-domain analyzers shipped here are demonstrations, not reference implementations.

## Where to go next

- **Methodology reference.** Analyzer-by-analyzer formulas, numerical notes, and edge cases, grouped by domain.
- **Materials — stress–strain case studies.** The original use case, including Ramberg–Osgood fitting, UT vs PST, and Zener–Hollomon regression on hot compression data.
- **Finance — daily equity returns.** Dataset provenance, stylised facts, recoverable relationships, and the one-to-one mapping back to the materials workflow.
- **Climate — daily temperature records.** 30 GHCN-Daily stations, the harmonic fit, and which of three textbook relationships a three-year record can and cannot recover.
- **Battery — capacity fade across cycling.** 124 Severson cells, the stretched-exponential fit and its limits on early-life data, and why batch beats C-rate.
- **Reproducibility.** Data sources, caches, overrides and how to recompute every number.
- **Glossary.** Every technical term used in the other chapters, one short entry each.

## References

- Ramberg, W. and Osgood, W. R. (1943). *Description of stress–strain curves by three parameters*. NACA Technical Note 902.
- Zener, C. and Hollomon, J. H. (1944). *Effect of strain rate upon plastic flow of steel*. Journal of Applied Physics, 15(1), 22–32.
- Sharpe, W. F. (1966). *Mutual fund performance*. Journal of Business, 39(1), 119–138.
- Severson, K. A. et al. (2019). *Data-driven prediction of battery cycle life before capacity degradation*. Nature Energy, 4(5), 383–391.
