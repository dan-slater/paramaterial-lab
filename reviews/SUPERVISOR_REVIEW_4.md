# Supervisor Review 4 — paramaterial web docs (v0.2 sign-off)

Reviewer: supervisor
Date: 2026-04-22
Drafts reviewed: `00-overview.md`, `10-methodology.md`, `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`, `60-reproducibility.md`, `99-glossary.md`
Against: `SUPERVISOR_REVIEW_3.md` (v0.1 sign-off at 8.5/10) and `FUTURE_WORK.md`
Build scripts reviewed: `web/scripts/build-finance.mjs`, `web/scripts/build-climate.mjs`, `web/scripts/build-battery.mjs`
Data spot-checked: `web/static/data/{finance,climate,battery}.json`

---

## 1. Verdict up front

v0.2 is the right swap to have made — three real-data presets plus two new model-fit families is a substantive jump from v0.1 — but the documentation set has **not kept up with the code**. The domain chapters carry a mix of real-data prose and unrefreshed synthetic-era claims, the reproducibility chapter still documents mulberry32 PRNG seeds that no longer exist, and the methodology chapter — the one chapter students will treat as ground truth — never names the new `ewmaVolatility`, `rollingVolatility`, `volClusteringIndex`, `fitHarmonicTrend`, or `fitStretchedExp` functions at all. Two of the three swapped-in domains also contradict their own build scripts in reader-visible ways (climate chapter still narrates "planted signals" that the NOAA fetcher cannot produce; battery chapter still references a "0.5 C cohort at the top" that does not exist in Severson). Final rating: **6.5/10** — a regression against the v0.1 sign-off (8.5/10), because the shipping code moved while the docs stood still. This is **not shippable as v0.2** without the Tier A punch-list in §6 below closed.

---

## 2. Carried items from `FUTURE_WORK.md`

Status of each v0.1.1/v0.2 item declared in `web/src/lib/docs/FUTURE_WORK.md`:

- **Residual Tier B — glossary anchor-linking from chapters.** **Still open.** No anchor links from `20-*`/`30-*`/`40-*`/`50-*` into `99-glossary.md` have been added. A grep for `](#` links in the four domain chapters still shows only intra-chapter anchors (and a couple of external hyperlinks).
- **Tier C1 — `05-design.md`.** **Not added.** No such file exists in `web/src/lib/docs/`.
- **Tier C2 — pipeline schematic at top of `00-overview.md`.** **Not added.** The overview still embeds `materials-scatter.png` (`00-overview.md:18`) as the only figure; no `series → analyzer → parameter → scatter` schematic.
- **Tier C3 — KaTeX math rendering.** **Not wired.** `10-methodology.md:12` still carries the pre-existing "Note on math rendering" block-quote, and `marked-katex-extension` does not appear in `web/package.json`. Formulas in 10-methodology and the new finance/battery/climate fit sections are still Unicode-in-code-fences.
- **Tier C4 — numeric-anchor sweep in methodology.** Not re-audited; no obvious breakage, but also no evidence of a fresh sweep.
- **Lightweight — visual diff between real materials scatter and synthetic-domain scatters.** Superseded by the v0.2 real-data swap; the "materials-vs-synthetic" framing no longer applies. Should be struck from the future-work list.
- **Lightweight — reading-guide paragraph in overview.** Not added.
- **Lightweight — Playwright-driven live demo.** Not added.
- **Deferred — Baron (2005) / Hyde citation promotion.** `20-materials.md` still carries the "placeholder pending confirmation" treatment (unchanged from v0.1).
- **Deferred — quick-start UI-label live diff.** No sign of a Playwright script; labels in `00-overview.md:31` remain unverified against the running UI.

Net: **zero carry-forward items closed in v0.2.** The v0.2 work was entirely orthogonal — real data, new model fits — and the v0.1.1 punch-list is now layered on top of a v0.2 doc-refresh backlog.

---

## 3. `[STALE v0.1]` tag audit

A grep across `web/src/lib/docs/*.md` finds the following distribution of unrefreshed `[STALE v0.1]` markers:

| Chapter | Count | Locations (path:line) |
|---|---|---|
| `30-finance.md` | 10 | 96, 105, 206, 217, 218, 219, 220, 226–227, 232, 249, 259 (same tag on adjacent lines in the table) |
| `40-climate.md` | 4 | 24 (block-quote preamble), 53, 55, 57 |
| `50-battery.md` | 1 | 32 (preamble only — in-prose numbers further down are *not* tagged) |

Nothing looks like it has been refreshed yet; every `[STALE v0.1]` call-site remains next to a synthetic-era number. The caller's note that "a sibling task is refreshing these" does not appear to have landed — all three sections still read as pre-refresh.

### 3.1 Spot-check against real data

I computed two of the STALE claims directly against the checked-in JSON to sanity-check the caveats:

- **Climate `corr(annual_mean, |lat|) ≈ −0.87` (`40-climate.md:24, 53`).** Real GHCN build: **−0.858** (29 stations, matching `finance.json`/`climate.json`/`battery.json` as shipped). The chapter's inline prediction of "roughly −0.85 in a preliminary run" is accurate.
- **Climate `corr(seasonal_amplitude, |lat|) ≈ +0.96` (`40-climate.md:24, 55`).** Real GHCN build: **+0.50**. The chapter's caveat that the value will "drop below +0.96 because real continentality is not perfectly collinear with |lat|" massively understates the drop. A supervisor reading "seasonal amplitude vs |lat| is the strongest signal in the dataset" in §Recoverable relationships (40-climate.md:55) will not be prepared for a 0.5 correlation, where real continentality (Minneapolis, Yakutsk) collides with oceanic damping (Reykjavík, Vancouver). This is the single most misleading number still in print.
- **Battery `corr(cyclesTo80Pct, c_rate) ≈ −0.75` (`50-battery.md:32, 54`).** Spot-compute against `battery.json` of `corr(cycle_life, nominal_c_rate_charge)` across all 124 cells: **−0.026**. The classic rate-capability ordering is essentially invisible in the shipped dataset because Severson's C-rates span only 3.6 → 8 C (step-1 only; the policy string encodes a two-step profile), not the 0.5 → 3 C sweep the synthetic preset was built around. The chapter's STALE note says the number "must be re-run"; the caller should understand that the *re-run will not recover a strong rate-capability signal at all* because the metadata field chosen for the X-axis is the wrong scalar for the Severson design matrix. See §4.3 below.

### 3.2 The STALE tag is hiding a structural problem

The `[STALE v0.1]` annotation is a deferral mechanism, not a fix. In two of the three domains it lets the chapter keep a synthetic-era *narrative* intact (sector Sharpe rankings, the temperature U-shape, the "clean monotonic decline" of Cycles-to-80% vs C-rate) while only the number is marked. A reader who sees the tag may assume "the number needs a refresh" when the correct statement is "the whole finding no longer holds on this dataset". Tier A items in §6 below require removing the STALE narrative, not just the number.

---

## 4. Real-data risk audit per domain

### 4.1 Finance (`30-finance.md`)

- **Prose honestly describes what changed.** The `## Dataset provenance` section (lines 52–107) tells the reader bluntly that the +0.73 β–MaxDD correlation was an artefact of the injected day-180 market shock and is gone.
- **But β is not in the shipped dataset.** `build-finance.mjs:224-234` emits `meta = { sector, country, industry_group }`. There is no `beta` field, no covariate series, no market factor. The chapter's "Reproducing in the web tool" steps (lines 256–259) still instruct the reader to set `X = beta` in the Parameter-scatter block. This will fail in the UI — β cannot be selected because no analyzer or metadata column produces it. The chapter's own §"Where paramaterial must generalise next" (lines 290–321) explains exactly why: it is the schema extension that has not shipped. The reproducing section needs to pivot to something the UI can actually plot (e.g. `Y = MaxDD, X = AnnVol`, coloured by sector — the canonical plot named in `00-overview.md:21`).
- **Sector universe mismatch.** Chapter says "40 real S&P 500 tickers across 8 sectors" (`30-finance.md:70-78`) and the builder agrees (40 tickers, 8 sectors, `build-finance.mjs:31-40`); data spot-check shows 40 tickers × 504 days. ✓
- **Stylised-facts section is self-contradictory.** Lines 192–211 say "Volatility clustering: **no, by construction** — daily innovations are independent" and then in the next paragraph "on the v0.2 real-data preset the index should now lift into the +0.1 to +0.3 range". This is a left-over v0.1 paragraph with a v0.2 coda bolted on; the "by construction" claim is false for real equities. Rewrite as a single coherent real-data paragraph.

### 4.2 Climate (`40-climate.md`)

- **"Planted signals" section is factually wrong.** `40-climate.md:79` tells the reader that the `PHOENIX-USA` heat-dome spike (day 600, +10 °C, 15 days) and the `YELLOWKNIFE-CAN` polar-vortex dip (day 900, −15 °C, 15 days) are "injected by the generator". The generator no longer exists; `build-climate.mjs` is a NOAA fetcher and injects nothing. These paragraphs must be deleted outright, not qualified.
- **Station count drifts between chapter and data.** Chapter opens with "~30 stations" (line 20), reports "41 stations" in §Recoverable relationships (line 51) and the §Reproducing block (line 73). The shipped JSON contains 29 stations. The "41" figure is a left-over from the v0.1 synthetic catalog; every occurrence needs to drop to the actual count (or be phrased as "≈ 29").
- **Analyzer descriptions reference the generator.** `40-climate.md:34` ("most directly tied to the generator's `amplitude` parameter"), line 43 ("mid-year phase used by the generator"), line 45 ("should approximately recover the generator's `amplitude`"), line 57 ("not because the generator's trend slope is weak (it ranges from 0.02 to 0.15 °C/yr)"), and line 84 ("the `climate_zone` field is assigned by the generator from latitude and altitude"). None of those sentences are true after the v0.2 swap. The `climate_zone` field does not appear in `build-climate.mjs` at all (emitted meta fields are `ghcn_id`, `name`, `latitude`, `longitude`, `altitude_m`, `country`, `hemisphere`, `coverage_pct`, `tavg_derived_pct`).
- **Provenance section itself is good.** Lines 14–22 honestly describe GHCN-Daily, the `TAVG` vs `(TMAX+TMIN)/2` fallback, the 95% coverage floor, and the 8 dropped stations. That is the template the other chapters should follow.

### 4.3 Battery (`50-battery.md`)

- **Provenance section is strong.** Lines 16–32 read as an honest substitution: Severson 2019 citation, CC-BY licence, the 99-cycle-window caveat, batch structure, and the STALE block-quote flagging what no longer applies.
- **But the analyzer section and Recoverable-Relationships section still describe the synthetic.** Line 56–64 quote "0 °C: ≈ 0.124 mAh/g per cycle; 25 °C: ≈ 0.081; 45 °C: ≈ 0.115" as the "temperature U-shape", already flagged in the preamble as unrecoverable. The chapter should *delete* the U-shape section, not retain it as a STALE ghost — the real dataset has no temperature axis at all (all cells at nominally 30 °C).
- **The "50 cells" count appears three times (lines 14, 64, 81, 102)** against an actual population of 124. This will confuse every reader who walks through the chapter's reproducing section against the actual JSON.
- **"0.5 C cohort at the top … 3 C cohort tightly clustered near the bottom"** (line 81). Real `nominal_c_rate_charge` range: 3.6 → 8 C. Neither cohort exists in the shipped data. Rewriting the reproducing walk-through for the Severson C-rate matrix (colour by `cell_group` batch, X = `nominal_c_rate_charge`, Y = `cycle_life`) is the honest fix.
- **Units mismatch.** The stress axis is labelled "discharge capacity (mAh/g)" throughout the chapter (e.g. `50-battery.md:36`) and in the methodology chapter (`10-methodology.md:46`), but `build-battery.mjs:243` emits `y_label: 'Discharge capacity (Ah)'` and the reconstructed `max(Qdlin)` values are in Ah (nominal 1.1 Ah cells). This is a v0.1 units convention that contradicts the v0.2 real data. Either rescale the builder or change the chapter+methodology+glossary to Ah. Either way, this is the CS2-units moment of v0.2 and needs the same treatment §A1 got in review 3.

---

## 5. New model fits — EWMA, harmonic, stretched-exp

### 5.1 Documentation coverage

- **EWMA / rolling volatility / vol-clustering index** are exported from `src/lib/analyzers/finance.ts:108, 137, 157` and documented in `30-finance.md:148-187`. The RiskMetrics λ = 0.94 default and the GARCH(1,1) nesting identity (ω = 0, α = 1 − λ, β = λ) are correctly stated on line 174. ✓ in the finance chapter.
- **Harmonic fit** is exported from `src/lib/analyzers/climate.ts:184` and registered as `climate.harmonicAmplitude` / `climate.harmonicTrendPerYear` (registry.ts:99-107). **Not mentioned in `40-climate.md` at all.** The climate chapter documents `trendPerYear` and `seasonalAmplitude` (the v0.1 pseudo-month analyzers) but never names `fitHarmonicTrend`, `harmonicAmplitude`, or `harmonicTrendPerYear`, never writes out the `a + b·t + c·cos(ωt) + d·sin(ωt)` model, and never explains why a reader would prefer the harmonic trend (cycle-aware) over the plain OLS trend.
- **Stretched-exponential fit** is exported from `src/lib/analyzers/battery.ts:165` (and `fadeExponent`, `fadeRateConstant` from lines 251, 258). **Not mentioned in `50-battery.md` analyzer section.** The phrase "stretched exponential" appears only in the §"How the series-to-parameter bridge works" preamble prose (`50-battery.md:42, 85`), always describing the *data's* shape, never naming the analyzer that fits it. The math — `C(n) = C₀·exp(−k·n^α)` — does not appear anywhere in the chapter. The log-log linearisation used in the implementation (`battery.ts:191-225`) is a reasonable closed-form estimator but its limitations (needs n ≥ 1, needs C(n) < C₀, drops noisy early cycles) deserve a methodology paragraph.
- **Methodology chapter `10-methodology.md` has none of the three.** A `grep -i 'harmonic|stretched|ewma|rollingVolatility|volClustering'` against `10-methodology.md` returns zero hits. This is the single largest doc-regression in v0.2: the methodology chapter is advertised as "the technical reference for every analyzer function shipped in the web app" (line 8) and five shipped analyzer functions are missing.

### 5.2 Math correctness spot-check

- **EWMA recursion on line 166 of 30-finance.md** — `σ̂²_ewma(t) = λ·σ̂²_ewma(t−1) + (1−λ)·r²_t` — matches `finance.ts:137-155` and RiskMetrics 1996 TD4. ✓
- **Harmonic OLS on 4 columns `[1, t, cos(ωt), sin(ωt)]`** — `climate.ts:184-270` solves the 4×4 normal equations by Gauss–Jordan with partial pivoting and returns amplitude = √(c² + d²), phase = atan2(d, c), peak-day = phase/ω wrapped into [0, 365). Correct. But *nothing in the docs states this*.
- **Stretched exp log-log linearisation.** `ln(ln(C₀ / C(n))) = α·ln(n) + ln(k)`. This rearrangement is correct algebra of `C(n) = C₀·exp(−k·n^α)`, but it requires n ≥ 1 and C(n) < C₀, which `battery.ts:193-210` correctly guards. R² is computed on the original (non-log-log) residuals, which is the right thing to report to a user. The method is *not* Levenberg–Marquardt (contrary to the `battery.ts:152-154` docstring — it's a single closed-form OLS on log-log residuals, no Gauss–Newton refinement step despite the comment). Docstring needs a line delete.

---

## 6. Regressions vs v0.1

**R1. Reproducibility chapter is entirely wrong about v0.2.** `60-reproducibility.md:18-48` still describes "deterministic mulberry32 PRNG", seeds `20260421` / `0xC11A7E`, and the claim that "rebuild the JSON" with `node scripts/build-{finance,climate,battery}.mjs` is deterministic. After v0.2 *none* of this is true: finance hits Stooq/Yahoo, climate hits NOAA NCEI, battery hits a GitHub mirror. Reruns are *not* deterministic (finance rebuilds slide forward on the window, climate changes if NOAA updates, battery is cached but depends on the mirror). The "Synthetic dataset seeds" table must be deleted and replaced with a "Data-source pinning" table that names the URLs, the cache directory (`.cache/ghcn`, `.cache/severson`), and the `CLIMATE_END` / `STOOQ_APIKEY` / `FINANCE_SOURCE` env vars (`build-climate.mjs:233`, `build-finance.mjs:26-27`).

**R2. Changelog missing v0.2 entry.** `60-reproducibility.md:76` has v0.1.0 only. v0.2 shipped three real-data swaps, five new analyzers, and at least one new registry entry — this is a mandatory changelog line.

**R3. Overview's per-domain paragraphs contradict battery chapter.** `00-overview.md:23` says the canonical plot is "cycle_life vs nominal_c_rate_charge" and quotes "~150–2237 cycles", and the spot-check confirms the JSON min is 148 (close enough). But `50-battery.md:79-81` still describes the canonical plot as "Cycles to 80% SoH vs c_rate" with "0.5 C cohort at the top". The two chapters disagree on both the Y-axis analyzer (`cycle_life` metadata vs `cyclesTo80Pct` analyzer) and the X-axis C-rate regime.

**R4. Materials chapter unchanged but overview's materials paragraph drifted.** `00-overview.md:20` describes basic usage at "20–300 °C"; `20-materials.md` (unchanged in v0.2) uses the same figure. ✓ no drift here, but worth confirming on a walk-through.

**R5. Terminology drift: `nominal_c_rate_charge` vs `c_rate`.** The builder emits `nominal_c_rate_charge` (`build-battery.mjs:226`), the overview uses `nominal_c_rate_charge`, but `50-battery.md` uses the bare `c_rate` in every recoverable-relationships and reproducing-block paragraph. The methodology chapter (`10-methodology.md:283`) is generic. Pick one label and propagate.

**R6. Battery chapter introduces a speculative `temperature_c` colour key** (line 81). This key does not exist in the JSON — `build-battery.mjs:222-233` emits only `cathode_chemistry`, `nominal_c_rate_charge`, `cycle_life`, `policy`, `cell_group`. Delete.

---

## 7. Shipping verdict — 6.5/10

Substantively, v0.2 is a good decision: real data is worth the honesty tax. But the docs need a focused refresh pass before they are shippable. Punch-list, strict ordering:

### Tier A — ship-blocking

- **A1.** Rewrite `60-reproducibility.md` §"Build environment" and §"Synthetic dataset seeds" for the real-data world. Name the three URLs, the two cache directories, the three env-var overrides (`STOOQ_APIKEY`, `FINANCE_SOURCE`, `CLIMATE_END`), and replace the determinism claim with a "pinned by URL, cached locally" statement. Add a v0.2 changelog entry (R1, R2).
- **A2.** Delete the "planted signals" paragraph (`40-climate.md:79`) and every sentence referring to "the generator" in the analyzer, recoverable-relationships, and limitations sections of 40-climate (R-list in §4.2).
- **A3.** Fix the battery chapter's synthetic-era narrative: delete the temperature U-shape section (`50-battery.md:56-62`), delete "7 of 50 cells" (line 64), rewrite the reproducing block (lines 66-81) for the Severson 3.6–8 C policy matrix, and reconcile "50 cells" → 124 (R3, R6).
- **A4.** Refresh the correlation numbers that can be refreshed: climate's three headline correlations against the real JSON (annual_mean/|lat| ≈ −0.86, seasonal_amplitude/|lat| ≈ +0.50, trend/|lat| needs a recompute); finance's β-vs-MaxDD either replace with a β-free reproducing-block or ship the covariate schema extension (§4.1).
- **A5.** Units reconciliation: battery uses Ah in the builder and mAh/g in the chapter+methodology+glossary. Pick one. The builder is currently authoritative (`build-battery.mjs:243`) and cheaper to follow (R-list in §4.3).
- **A6.** Document the three new fits in `10-methodology.md`: one subsection each under §3 (finance — EWMA/rolling/volClusteringIndex), §4 (climate — fitHarmonicTrend and derived amplitude/trend), §5 (battery — fitStretchedExp and derived α/k). One paragraph + one formula block each. This is the single biggest content gap in v0.2.

### Tier B — should-fix before a reader sees it

- **B1.** Finance §"Reproducing" (`30-finance.md:237-267`) pivots from `X = beta` to a UI-reachable axis (e.g. `AnnVol` or `sector`).
- **B2.** Finance §"Stylised facts the finance preset recovers" is rewritten coherently for real data — no "by construction" claims.
- **B3.** Climate station count drifted between "~30", "41", and actual 29. Pick the real number and propagate.
- **B4.** Add a `50-battery.md` analyzer subsection for `fitStretchedExp`, `fadeExponent`, `fadeRateConstant` that spells out the log-log linearisation and the `n ≥ 1` / `C(n) < C₀` domain. Parallel treatment in `40-climate.md` for harmonic.
- **B5.** Battery builder docstring (`battery.ts:152-154`) claims "Levenberg–Marquardt-lite (simplex on log-linearised initial guess then one Gauss–Newton refinement step)". The code does the log-log OLS and stops; the Gauss–Newton refinement is not present. Fix the comment (or add the step).
- **B6.** Glossary entries for `EWMA volatility`, `RiskMetrics λ`, `volatility clustering`, `harmonic fit`, `peak-day`, `stretched-exponential fade`, `rate constant k`, `fade exponent α`. Some exist already (`rate constant k`, `stretched exponential`) in cross-cutting scope but are not cross-referenced to the new analyzers.

### Tier C — deferrable to v0.3

- **C1.** All Tier C items carried from FUTURE_WORK (design chapter, pipeline schematic, KaTeX, glossary anchor-linking, reading-guide paragraph, Playwright live diff, Baron/Hyde citation promotion). None blocked v0.1; none block v0.2.
- **C2.** Covariate-series schema extension named in `30-finance.md:297-321`. The v0.2 decision to ship real data without shipping the schema extension means the finance chapter has to either narrate around the β gap or defer β to v0.3. The chapter currently does the former awkwardly.
- **C3.** An end-to-end "chapter audit" bench that loads each domain JSON, runs every analyzer in the corresponding registry, and prints a tab of correlations so that chapter numbers are regenerated alongside a data rebuild rather than manually edited.

---

## 8. Closing paragraph

The students' instinct to push through to real data in v0.2 was correct — a documentation set that quotes +0.96 correlations on a hard-coded amplitude-vs-latitude law cannot survive outside the MSc environment — but the execution is half-finished. The build scripts are clean, honest, and well-commented; `build-climate.mjs` in particular is a thoughtful GHCN fetcher with the right QC (95% coverage floor, gap interpolation ≤ 7 days, `TAVG` vs `(TMAX+TMIN)/2` fallback tracked as metadata). The new analyzer functions are shipping in the registry and compute correctly on real data. The docs simply have not been rewritten to match. Two chapters (climate, battery) describe a generator that no longer exists; the reproducibility chapter is now actively misleading about determinism; the methodology chapter silently omits five new functions; and no chapter has yet converted a `[STALE v0.1]` tag into a refreshed number, despite the raw data being byte-available in `web/static/data/`. The gap to a clean v0.2 is not large — it is the A1–A6 list above, which one student could plausibly close in a two-day sprint — but it is real, and until it is closed the docs overpromise what the tool actually does. **Hold v0.2 sign-off pending Tier A.** The Tier B list follows naturally once Tier A lands; Tier C rolls into v0.3 without drama.

End of review.
