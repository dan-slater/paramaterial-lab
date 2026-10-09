# Supervisor Review 5 — paramaterial web docs (v0.2 Tier A close-out, self-assessment)

Reviewer: the lab-web factory line (Claude), reviewing its own work. **This is a self-assessment, not an independent sign-off**; it should be read as the author's account of what changed and what did not, for a real supervisor to check.
Date: 2026-10-09
Branch: `feat/lab-web` (commits `00bb00c`, `852b11c`, `7473b5c`, plus this file)
Drafts reviewed: `00-overview.md`, `10-methodology.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`, `60-reproducibility.md`, `99-glossary.md`, `FUTURE_WORK.md`
Against: `SUPERVISOR_REVIEW_4.md` (6.5/10, "hold v0.2 pending Tier A")
Data: `web/static/data/{finance,climate,battery}.json` as shipped (built 2026-04-22; not rebuilt in this pass)
New instrument: `web/scripts/chapter-numbers.mjs`, which runs the app's own analyzer files over the shipped JSON and prints every number the domain chapters quote

---

## 1. Verdict up front

Review 4's Tier A list is closed, and the method changed. No chapter number in the four domain chapters, the overview or the glossary was carried over or estimated: each comes from `chapter-numbers.mjs` output, which imports `src/lib/analyzers/{finance,climate,battery}.ts` directly, so the docs and the browser cannot disagree about arithmetic. The rewrite also surfaced four things Review 4 did not catch. The climate preset has **30** stations, not 29. The plain OLS climate trend is **seasonally contaminated** (median +0.84 °C/yr), not merely noisy. `Ret500` was **silently reporting cycle 98** on the 99-cycle battery window. And the stretched-exponential fit is **weak on this data** (median R² 0.11). The docs now say all of that plainly. What remains is Tier C plus a data rebuild. Self-rating: **8/10**, shippable as v0.2 documentation, with the caveat that the rating is the author's.

---

## 2. Carried items from `FUTURE_WORK.md`

- **Residual Tier B — glossary anchor-linking from chapters.** **Still open.** No anchor links added.
- **Tier C1 — `05-design.md`.** Not added.
- **Tier C2 — pipeline schematic in the overview.** Not added.
- **Tier C3 — KaTeX.** Not wired. Formulas remain Unicode in code fences; the new methodology subsections follow that convention.
- **Tier C4 — numeric-anchor sweep in methodology.** Not re-audited beyond the new sections.
- **Lightweight — synthetic-vs-real visual diff.** **Struck** as superseded, as Review 4 §2 asked.
- **Lightweight — reading-guide paragraph.** Not added.
- **Lightweight — Playwright live demo.** Not added.
- **Deferred — Baron/Hyde citations.** Still placeholders; needs the thesis reference table.
- **Deferred — quick-start label diff.** **Partly closed.** Every label in the six-click quick-start was checked against `TOOLS` in `blocks.svelte.ts` and the registry labels, and three steps that could not work were rewritten ("tick" analyzers in a block that has no ticks, "colour by lot" on a scatter with no colour key, "X = lot" on a numeric-only scatter). Not yet a Playwright click-through of exactly those six steps; `scripts/smoke-lab.mjs` covers the preset routes and import, not the quick-start.

Net: one carried item struck, one partly closed, the rest still open. They remain Tier C.

---

## 3. `[STALE v0.1]` tag audit

Zero `[STALE v0.1]` tags remain (there were none at the start of this pass either; `53a6634` removed the tags but left much of the narrative they guarded, which is what Review 4 §3.2 warned about). This pass removed the narratives themselves: the climate "planted signals" and every "the generator" sentence, the battery temperature U-shape, "7 of 50 cells", the 0.5 C / 3 C cohorts and `temperature_c`, the finance "by construction" stylised-facts paragraph, and the glossary entries that described injected market and sector shocks, `meta.beta`, NMC/NCA chemistries and a `− β·n` fade term.

### 3.1 Numbers recomputed (all from `chapter-numbers.mjs`)

| Claim | Review 4 / old prose | Shipped data |
|---|---|---|
| Climate stations | 29 (Review 4), ~30 / 41 (chapter) | **30** retained of 41 picked; 11 dropped |
| corr(annual_mean, \|lat\|) | −0.86 | **−0.859** |
| corr(seasonal_amplitude, \|lat\|) | +0.50 | **+0.507** |
| corr(trendPerYear, \|lat\|) | +0.16 | **+0.177** |
| corr(harmonicTrendPerYear, \|lat\|) | not reported | **+0.597** (reported, explicitly not read as amplification) |
| Battery cells / batches | 124 / 41-43-40 | **124 / 41-43-40** |
| corr(cycle_life, c-rate) | −0.026 | **−0.026** |
| Finance corr(MaxDD, AnnVol) | not quoted | **+0.785** |
| Finance off-app β vs MaxDD | +0.48 | **+0.481** (kept, labelled as outside the tool) |
| Finance equal-weighted drawdown | "peak day 503 → trough 243" | **−17 %, peak day 210 → trough 244** |
| Sector mean Sharpe | Materials +0.66, Consumer +0.62, Tech +0.47, Energy +0.18 … | **+0.64, +0.60, +0.43, +0.16** (five of eight were off by 0.01–0.04) |

Review 4 was right on every number it spot-checked except the station count.

---

## 4. Real-data risk audit per domain

### 4.1 Finance

- **β reproducing step removed.** "Reproducing in the web tool" now ends at Y = Max drawdown, X = Annualized volatility (r = +0.79), the plot the UI can draw. β survives only as an off-app check with its method stated.
- **Stylised facts rewritten** as three checkable claims on real data: heavy tails (ExKurt > 0 for 40/40), clustering (VolCluster > 0 for 40/40, mean +0.125), weak gain/loss asymmetry. The ones no analyzer measures are named as unmeasured.
- **Limitations rewritten** for a real snapshot (one window, selection, no covariates, no scatter colour key, path functions without registry rows, √252 assumption).
- **Source honesty.** The shipped JSON was built from **Yahoo**, not Stooq, though its `name` says "(Stooq)". The chapter says so; `build-finance.mjs` now names the source it actually used; the UI shows the curated registry name. The JSON itself is unchanged until a rebuild.
- **Residual risk:** sector-level claims rest on three to seven tickers per sector; the chapter says the ordering is suggestive, not significant.

### 4.2 Climate

- **Generator language gone** (A2), station counts corrected (B3), harmonic fit documented (B4, A6).
- **New finding, now documented:** `trendPerYear` absorbs the seasonal cycle. Median +0.84 °C/yr, max +4.5 °C/yr at Yakutsk, r = +0.76 with harmonic amplitude. The old prose claimed the cycle was "nearly orthogonal" to the line; on this window it is not. The chapter now recommends `harmonicTrendPerYear` and explains why even that is not a warming signal (r = +0.42 with amplitude; three-year record).
- **New finding, documented:** the 12 "months" in `seasonalAmplitude` and `summerAnomaly` are counted from the first day of the record (22 August), not 1 January, so `summerAnomaly`'s "Jun–Aug" bins are not June–August. Documented in chapter, methodology and glossary; **not fixed in code**.
- **New finding, documented:** Amundsen–Scott `altitude_m` is −1000, GHCN's missing sentinel. The builder now writes `null`; the shipped JSON still has −1000 until a rebuild.
- **Residual risk:** the "zones" in the provenance paragraph are the chapter's informal grouping; the chapter says there is no `climate_zone` field.

### 4.3 Battery

- **Synthetic narrative removed** (A3): U-shape, 50 cells, cohorts, `temperature_c`. Units are Ah throughout (A5): registry units, methodology table, chapter, glossary.
- **New finding, fixed in code:** `retentionAt` used nearest-index lookup with no range check, so "Retention @ cycle 500" reported the value at index 98. It now returns NaN past the record (UI "—"). Not a thesis analyzer; materials numbers unaffected.
- **New finding, documented:** `cyclesTo80Pct` is null for all 124 cells on the 99-cycle window (median retention at index 90 is 0.997), so the chapter uses `meta.cycle_life` as the end-of-life axis and says why.
- **New finding, documented:** the stretched-exponential fit is weak here: 113/124 fits succeed, median R² 0.11, 55 below zero, α from −0.30 to 5.5. The chapter says α and k are not physical on this window.
- **Positive results stated:** batch dominates (median life 842 / 481 / 940 by batch; the same `3.6C(80%)-3.6C` policy lives 862–1852 in batch1 and 300–487 in batch2), and early fade predicts life (r = −0.46 for `fadePerCycle`).
- **Residual risk:** the battery chapter is now mostly negative results. That is honest for this window but makes it the weakest demonstration of the workflow; a full-life rebuild is the fix (FUTURE_WORK).

---

## 5. New model fits — documentation coverage

- `10-methodology.md` now has a subsection for each of `rollingVolatility`, `ewmaVolatility`, `volClusteringIndex`, `fitHarmonicTrend`, `harmonicAmplitude`, `harmonicTrendPerYear`, `fitStretchedExp`, `fadeExponent`, `fadeRateConstant`, each with signature, formula block, domain/edge cases and registry key. A scripted check confirms all **37** exported analyzer functions across `processing.ts` and the three domain modules are named in the methodology chapter.
- Details stated from the code rather than from earlier prose: `rollingVolatility` shrinks its window at the record ends; `ewmaVolatility` is zero-mean, seeded on r₀², λ clamped, element 0 NaN; `fitHarmonicTrend` returns a zero fit on a pivot below 10⁻¹² and reports `peakDay` on the record's own day index; `fitStretchedExp` nudges C₀ by 0.05 % and needs at least 5 finite and 3 usable points.
- B5 closed: the `battery.ts` docstring no longer claims Levenberg–Marquardt or a Gauss–Newton step.
- B6 closed: glossary entries for rolling and EWMA volatility, RiskMetrics λ, volatility clustering, harmonic fit, peak day, stretched exponential, fade exponent α, rate constant k, plus charging policy, cycle life, cell group, GHCN-Daily.

---

## 6. Regressions vs v0.1 / Review 4 R-list

- **R1** (reproducibility wrong about v0.2): closed. Seeds table deleted, replaced by a data-source pinning table (URLs, `.cache/ghcn`, `.cache/severson`, `STOOQ_APIKEY`, `FINANCE_SOURCE`, `CLIMATE_END`, `YEARS`), with the shipped snapshot dates and a "rerun the bench after any rebuild" rule. The materials rebuild instruction was also wrong (it said the Python package must be installed; `build_data.py` uses pandas/openpyxl only and had hard-coded paths, now overridable).
- **R2** (changelog): v0.2 entry added.
- **R3** (overview vs battery chapter): reconciled; both use `cycle_life` vs `nominal_c_rate_charge` and say it does not predict.
- **R4** (materials drift): not re-audited in this pass. `20-materials.md` was not edited and no materials analyzer was touched.
- **R5** (`c_rate` vs `nominal_c_rate_charge`): `nominal_c_rate_charge` everywhere except where v0.1 is quoted as history.
- **R6** (`temperature_c`): deleted.
- **New regression found and fixed outside the docs:** report templates and the Markdown export used `xKey`/`yProperty` while `ScatterBlock` reads `xId`/`yId`, so template scatter axes were silently ignored. Fixed; the new domain templates use the right keys.

---

## 7. Shipping verdict — 8/10 (self-assessed)

### Tier A — ship-blocking

- **A1–A6: closed** as above.

### Tier B — should-fix before a reader sees it

- **B1–B6: closed.**

### Tier C — deferrable to v0.3

- **C1:** all carried items in §2 remain open except the struck visual diff.
- **C2:** covariate schema for β: open; the finance chapter narrates around it honestly.
- **C3:** chapter-audit bench: **done** (`scripts/chapter-numbers.mjs`). Not yet wired to fail when prose and bench disagree; the prose is still transcribed by hand from its output.
- **C4 (new):** rebuild the shipped data once to pick up the finance source name and the Amundsen–Scott altitude fix, then rerun the bench and refresh the chapters.
- **C5 (new):** scatter colour key and categorical axes. The chapters narrate around this gap in four places.
- **C6 (new):** calendar-aligned climate bins; second harmonic in `fitHarmonicTrend`; parse the battery `policy` string; full-life battery rebuild.
- **C7 (new):** domain-aware labels in the series block (it still says "stress vs strain" and offers a 0.2 % offset line on finance, climate and battery).

### Why not higher

The docs are now accurate about the data, but three of the four domains have UI gaps (no colour key, no |lat| field, no policy axes), so "reproduce this in the tool" sometimes ends with "computed by the bench". The battery chapter is mostly about what the window cannot show. The prose numbers are correct today but are not mechanically tied to the bench. Tier C from Review 2 is untouched. And this review is written by the author.

---

## 8. Closing paragraph

The useful change in this pass is the instrument, not the prose. Review 4's complaint was that the code moved while the docs stood still. The root cause was that every chapter number was typed by hand, so nothing could notice when one went stale. With `chapter-numbers.mjs` importing the same analyzer files the browser runs, a data rebuild now has a one-command answer to "what do the chapters need to say?" Running it immediately found three things the previous reviews missed: a contaminated trend estimator, a retention parameter reading the wrong cycle, and a miscounted station list. That is the argument for keeping it. The next step that would move this to a 9 is making the bench authoritative: generate the numbers into the chapters (or fail a check when they disagree), rebuild the data once, and give the scatter a colour key so the reproducing sections stop narrating around the UI. **Recommend v0.2 sign-off on Tier A, subject to an independent reader confirming §3.1 against the bench output.**

End of review.
