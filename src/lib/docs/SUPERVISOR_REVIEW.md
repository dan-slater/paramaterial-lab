# Supervisor Review — paramaterial web docs (first draft)

Reviewer: supervisor
Date: 2026-04-21
Drafts reviewed: `00-overview.md`, `10-methodology.md`, `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`, `99-glossary.md`
Reference bar: the five notebooks under `dan-slater/paramaterial-examples` (basic-usage, CS1–CS4)

---

## 1. Top-line verdict

This is a scaffold with placeholder stubs, not a first draft. Five of seven pages are under 20 lines of prose. The work done — the three-step abstraction in `00-overview.md`, the schema block in `10-methodology.md`, and the concrete synthesis targets in the domain pages — is correct but carries no analytical weight. In this state the docs are not shippable: a first-time reader cannot reproduce a single number, cannot trace any analyzer to a formula, and cannot tell what distinguishes paramaterial from "scatter a csv in pandas". The reference notebooks set a much higher bar — specimen counts, named source papers, numeric test conditions, captioned figures — and each page of this draft is missing most of those elements. Treat this as 15–25% complete and budget accordingly.

---

## 2. Cross-cutting concerns

### 2.1 Voice is rhetorically flat and over-hedged

The overview's H1 describes plumbing ("time-series → parameters → parameter-vs-parameter analysis") not research. Compare CS3's opening: *"This example showcases the use of Paramaterial to process and analyse a set of uniaxial compression test data"* — short, specific, committed. Every page should open by stating what the reader will be able to do or conclude by the end of it.

Second: every page except the overview opens with a `> Placeholder — to be expanded by a student.` block. Acceptable as TODO; must not render in a public docs site. Move to HTML comments.

### 2.2 The pedagogy/reference split is not decided

The TOC mixes a tutorial-style overview, an API-style methodology reference, and case-study-style domain chapters. The reader does not know whether to read sequentially or dip in. Pick one of three models: (a) linear tutorial building from materials to the generalisation, (b) reference manual with tutorial front-matter, (c) cookbook of independent case studies. The current draft is simultaneously trying to be all three, which is why every page is short.

### 2.3 No reproducibility statement anywhere

The docs never state: which version of paramaterial-web they describe, which commit of `dan-slater/paramaterial-examples` they draw from, what seed produces the 48-ticker finance preset, nor where raw data files live. Every domain page must name (i) a version, (ii) a seed, (iii) a data-source URL or DOI, (iv) a command or UI action that produces the named figures. None of the four does this.

### 2.4 No citations

Zero references across 7 files. The methodology page explicitly requires "a literature reference" but none are supplied. Ramberg–Osgood, Zener–Hollomon, Sharpe, stretched-exponential fade — all have canonical references that must be named. Add a `## References` section per page with DOIs or stable URLs.

### 2.5 Units are informally handled

The schema hard-codes `strain` / `stress` and the prose says "Interpret them as x and y" — fine, but the glossary never disambiguates units per domain. The registry advertises units (`°C`, `MPa`, `mAh/g`, `mAh/g·cycle`) yet none is documented narratively. Every domain page needs a three-line units table up front.

### 2.6 Math is absent

The methodology page lists 7 materials, 6 finance, 6 climate, and 6 battery analyzers under empty stubs. No formulas are rendered. Docs must render math in `$…$` / `$$…$$`; verify KaTeX is wired into the SvelteKit markdown pipeline or fix that first.

### 2.7 Accessibility of domain detail

The draft assumes the reader knows Sharpe, C-rate, stretched-exponential fade, knee, poleward amplification, Zener–Hollomon, proof stress, UPL/LPL. The glossary is one placeholder line. Either gloss every domain term on first use with a one-line parenthetical linking to the glossary, or populate the glossary with ≥ 40 entries and link into it. Currently neither.

### 2.8 No figures, no tables, no screenshots

The overview promises "a 30-second quick-start with a screenshot reference" but no screenshot is embedded. No pipeline schematic, no synthetic-data preview, no illustrative scatter. The reference notebooks produce 5–15 figures each; these docs produce zero.

### 2.9 Limitations sections missing

Every page needs a numbered `## Limitations` at the end. The synthetic generators in particular must name "what these data do not capture" (no fat tails in finance, no ENSO in climate, no calendar aging in battery, no crystalline-plasticity detail in materials). This is what distinguishes a research tool from a toy.

### 2.10 No design-rationale section

The overview claims the three-step abstraction is the same across all four domains but never defends it. Why "time-series + metadata → scalar parameters → parameter-vs-parameter scatter" and not "per-entity summary statistics + regression"? A design-rationale section (own `05-design.md`) is the single most important missing piece.

---

## 3. Section-by-section review

### 3.1 `00-overview.md` (19 lines)

- ★★★ **L6, H1.** "A research tool for time-series → parameters → parameter-vs-parameter analysis" is not a title, it is a tagline that describes plumbing. Replace with a title that names the research activity, e.g. "paramaterial: cross-sectional analysis of per-entity time-series." *Fix:* rewrite H1 to name the scientific activity, not the data flow.
- ★★★ **L8, placeholder block quote.** Remove before publishing; if you must retain TODOs, move to an `editor-notes` HTML comment so they do not render.
- ★★★ **L10.** "paramaterial began as a Python library for extracting mechanical properties from stress–strain test curves" — good origin story but it is the *only* sentence that gives the reader historical anchor. Expand to 3–4 sentences: when it was written (cite MSc thesis), which materials problem it solved, what the `web` front-end adds over the library (interactivity? no Python?).
- ★★ **L12–16.** The three-move list is the strongest piece of the draft. Make it the rhetorical spine of the whole docs site — every domain page should reprise these three steps in its opening paragraph, naming the specific Load/Extract/Scatter instance.
- ★★ **L18.** The materials→finance→climate→battery one-liner is dense and correct but reads like a table — render it as an actual 4-row table with columns {Domain, Entity, Series, Example parameters, Example scatter}. That table is the tool's elevator pitch and is worth 10× the real estate.
- ★★★ **Missing: quick-start.** The placeholder promises a 30-second quick-start. Replace the placeholder with: one numbered list (5–8 steps), one screenshot per step or at least an opening and closing screenshot, and one expected outcome sentence. This is the single-highest-leverage addition to this page.
- ★★ **Missing: scope/non-goals.** State explicitly what paramaterial is *not*: not a replacement for pandas/Excel, not a training harness, not a production monitoring tool. One paragraph.
- ★ **Missing: "When to use / when not to use".** Decision matrix in three bullets.

### 3.2 `10-methodology.md` (48 lines)

- ★★★ **L8, scope.** The placeholder says "Document every analyzer function … with (a) formula, (b) numerical implementation notes, (c) edge cases, (d) literature reference." Good TODO. Currently none of those are present for *any* of the 26 analyzers. This is the single biggest unit of missing work in the draft.
- ★★ **L14–29, schema block.** Accurate against `src/lib/analyzers/registry.ts` (`Series = { strain, stress }`). However, the doc exposes the legacy names `strain`/`stress` which is fine in code but confusing in docs. Prefix the schema with a one-paragraph explanation ("legacy names — read as X/Y") *before* the code block so the casual reader is not confused.
- ★★★ **L31.** "The `strain` / `stress` names are historical." — one sentence acknowledging a confusing decision is not enough. Add either (a) a roadmap note promising to rename them or (b) a justification for keeping them and a mapping table per domain: Materials (strain→strain; stress→stress/MPa); Finance (strain→trading-day index; stress→adjusted close); Climate (strain→day index; stress→daily mean °C); Battery (strain→cycle index; stress→capacity or SoH).
- ★★★ **L33–47, analyzer stubs.** Zero documentation. For each entry, produce: signature, formula, a ~3-sentence "what this is doing" paragraph, edge-cases (empty array, all-NaN, length < N), and one reference. Rough target 80–150 words per analyzer. Total: 26 analyzers × ~100 words = 2.5 kwords just for this section.
- ★★ **L35.** Materials list mentions `findE` but in `processing.ts` there is both `findUplLpl` (which returns `E`) and a separate `findE(c, upl, lpl)`. The registry uses the former. Either drop `findE` from the doc list or document both and explain when each is called. This is a factual inconsistency the students should catch.
- ★★ **L39.** Finance list is missing the `logReturns` helper (which is exported and used internally) and the `riskFreeRate` default of `0.04` in `sharpeRatio`. The default value must be documented *and* the choice defended.
- ★★ **L43.** Climate list documents `summerAnomaly` but the function signature takes a `hemisphere` argument; the registry defaults to `'N'` when meta is missing. This is a silent behaviour that the glossary must warn about.
- ★★ **L47.** Battery list includes `retentionAt` but the registry only exposes `Ret500` (i.e. retention at cycle 500). Either document the fixed cycle choice or expose the parametric version in the UI.
- ★★ **Missing: numerical-conventions subsection.** State calendar conventions (finance: 252 trading days/year — already hard-coded in `finance.ts`; climate: 365-day year, leap ignored — already hard-coded in `climate.ts`), NaN/missing-value handling, sample- vs population-variance (finance `stdev` uses `n-1`).
- ★★ **Missing: testing/validation statement.** Which analyzers have unit tests? What is the numerical tolerance against a reference implementation (e.g. `scipy.stats.skew` for the finance skew)?

### 3.3 `20-materials.md` (28 lines)

- ★★★ **L8, placeholder.** The placeholder correctly lists the required elements but note the reference bar is high. Basic-usage notebook cell 10 gives specimen counts (up to 7 per cell) grouped by lot and temperature; cell 51 loads an Aakash-authored reference table with 12 named columns of known reference values. The draft needs to match that specificity.
- ★★★ **L10, subsection title.** "Basic Usage — 154 tensile tests across 9 lots, 20–300 °C" — check this number. The basic-usage notebook subsets to `test_type == 'T'` only, and CS1 drops lots F–I. If 154 is drawn from the raw pre-subset count it needs justification; if it is post-subset it is probably wrong. Verify against `info/01 prepared info.xlsx` and state the exact figure with a sentence like "After removing plane-strain tests (PST) and lots F–I, N=154 specimens remain".
- ★★★ **Missing dataset provenance.** Basic-usage section currently names no source paper, no material (probably Al or a steel?), no rate. CS3 explicitly states "uniaxial compression" in its first cell. The draft names none of this. *Fix:* write an "Acquisition" paragraph per case study: source paper, material, supplier/lot info, specimen geometry (A0, h0), strain rate (e.g. 8.66e-4 /s per CS1 cell 11), temperature range.
- ★★★ **L12–28, CS1–CS4 stubs.** "Mirror dan-msc-csN-0.1.0.ipynb" is a valid instruction but "mirror" is ambiguous. The notebook flow is: (1) info-table construction, (2) formatting checks, (3) experimental matrix, (4) foot correction, (5) proof stress, (6) representative curves, (7) model fit, (8) thesis figures. Are the web docs to replicate *all* those steps or only the results? Pick one and be explicit. Recommendation: **results + one representative figure per case study, linking out to the notebook for full reproduction**. Each CS subsection should be 500–800 words, not the current 1 line.
- ★★ **L18, CS2 title.** "Uniaxial vs plane-strain tension" — CS2 in the repo is a "CS2 Processing Report" that includes PST tests in the experimental matrix but the narrative is not actually a uniaxial-vs-PST comparison, it is a processing report. Either find a real research question that CS2 answers (probably: how does PST change UTS/failure-strain vs UT?) or retitle.
- ★★ **L22, CS3 title.** Zener–Hollomon regression is correct; verify that the web tool actually implements `computeZH` (it does — `processing.ts:297`) and document its inputs/outputs on the methodology page.
- ★★ **L26, CS4 title.** "Plane-strain compression at high strain rates" — confirm rate range and match the notebook's nominal-rate buckets.
- ★★ **Missing: cross-study synthesis.** At the end of the materials page, 1–2 paragraphs that extract the common pattern across CS1–CS4: same pipeline, different materials, different models. That is the argument for generalisation and it is currently implicit.

### 3.4 `30-finance.md` (15 lines)

- ★★★ **L8, placeholder.** Useful outline but "limitations of the synthetic generator" is last — it should be first-class, own H2.
- ★★★ **L10, dataset description.** "48 synthetic tickers across 8 sectors, 504 trading days of adjusted closes, generated deterministically with a seeded RNG." Good numeric density but no seed value given. State the seed (e.g. `seed=42`) and the file/path that generates the dataset. Confirm against the generator code.
- ★★★ **L10.** "504 trading days" = 2 years at 252/yr. Say so. A non-finance reader will not convert that in their head.
- ★★ **L12, Sharpe clustering claim.** "Utilities/Industrials positive; Financials/Energy negative" — this is a quantitative claim that must be backed by a table: median Sharpe per sector, rounded to 2 dp. Currently unfalsifiable.
- ★★ **L13, corr(beta, maxDD).** Give the expected Pearson *r*. If the synthesis encodes a specific correlation, state the target (e.g. "design target: r ≥ 0.5 between beta and max-drawdown magnitude") and the realised value for the shipped seed.
- ★★ **L14, shocks.** "Market-wide dip around day 180" — is day 180 in the first year or the second? Both? Name the shock magnitude (e.g. −12% over 15 trading days) and the recovery length. Currently a reader cannot tell whether the shock is visible or subthreshold.
- ★★★ **Missing: formulas.** Sharpe = (R_a − R_f) / σ_a, but with which R_f? The code uses 4%. Why 4%? Pick a defensible anchor (3-month T-bill typical 4–5% in 2025). Explicitly.
- ★★★ **Missing: research question.** The placeholder suggests "which metadata explains cross-sectional differences in risk-adjusted return?". Write that paragraph. Commit to a falsifiable expectation: *"We expect Sharpe to cluster by sector; β and drawdown to correlate; idiosyncratic volatility to be orthogonal to sector."* Then the results section either confirms or disconfirms.
- ★★ **Missing: limitations.** Named calibration targets not matched: no fat tails (kurtosis is designed-in as well-behaved), no regime switches, no cross-sectional momentum, constant vol, no dividend model.
- ★ **Missing: how to reproduce.** One code snippet or UI walkthrough that takes the reader from "open app" to "see the beta-vs-maxDD scatter".

### 3.5 `40-climate.md` (12 lines)

- ★★★ **L8, placeholder.** Same structural feedback as finance — limitations must be its own H2.
- ★★★ **L10, dataset description.** "41 synthetic weather stations, 1 095 days (3 years)" — 3×365=1095 matches `climate.ts` DAYS_PER_YEAR. Good. But 41 is an odd number: what is the station-placement schema? Named locations? Random (lat, lon, altitude) draws? State explicitly.
- ★★ **L10, "poleward amplification".** Fine physics term but glossary-worthy. Add a one-line parenthetical on first use: "(warming trend increasing with |latitude|, as observed in real Arctic-vs-tropics records)."
- ★★★ **Missing: per-station metadata schema.** What columns are on each station: lat, lon, altitude, hemisphere, continentality? The `summerAnomaly` analyzer reads `meta.hemisphere`. Docs must define all metadata keys and their types, and flag which analyzers consume which keys.
- ★★ **L10, "small warming trend".** Quantify. 0.02 °C/year? 0.05? This is the core deliverable relationship, and the number has to appear in the docs.
- ★★ **Missing: month-boundary approximation.** `climate.ts:50` uses `Math.floor((m * 365) / 12)` for month bounds — that is 30.42-day months, *not* real calendar months. Docs should warn that e.g. `summerAnomaly` is an approximation and would drift relative to ERA5 or GHCN. This is the kind of honesty that distinguishes research docs from marketing docs.
- ★★ **Missing: trend-fit method.** `trendPerYear` is OLS on (dayIdx, temp) with slope × 365. Doc should note that OLS is biased in autocorrelated series — fine for synthesis-recovery but cited as a limitation for real data.
- ★ **Missing: an injected-event list.** Finance has "two visible shocks"; climate presumably has none, or does it? State explicitly.

### 3.6 `50-battery.md` (12 lines)

- ★★★ **L8, placeholder.** Outline is fine; add "mapping to real accelerated-aging conventions" as own H2.
- ★★★ **L10, dataset description.** "50 synthetic cells covering NMC811, NMC622, NCA, and LFP at four C-rates (0.5, 1, 2, 3) and three operating temperatures (0, 25, 45 °C)." Good numeric density. But: 4 chemistries × 4 C-rates × 3 temperatures = 48 design points ≠ 50 cells. Explain the allocation (replicates? unbalanced?). Currently this does not reconcile.
- ★★★ **L10, "stretched-exponential fade with an optional injected knee in roughly a quarter of cells".** Quantify. State the fade model explicitly: `C(n) = C0 * exp(-(n/τ)^β)` or whatever, with parameter ranges per chemistry. "Roughly a quarter" is not a spec; either ~25% (exact count) or say "12 of 50".
- ★★★ **Missing: knee-detection thresholds.** `kneeCycle` in `battery.ts:115–150` uses: min segment ≥ `max(5, n/10)`, a grid-search stride of `n/100`, requires `|s2| ≥ 2·|s1|` with both slopes negative. These are research-relevant thresholds that must be documented. A reader should understand that a "knee" in paramaterial means specifically *this* detection criterion, not the Attia-2021 or Severson-2019 definition.
- ★★ **Missing: C-rate definition.** Glossary-level, or inline: "1 C = discharge in 1 hour to nominal cutoff voltage."
- ★★ **Missing: capacity units.** `registry.ts` advertises `mAh/g` for both C0 and Cnow — is that specific capacity or absolute? Synthesis should specify (and a real-world reader will want that clarity).
- ★★ **Missing: validation against published datasets.** State explicitly that the synthetic generator *is not* Severson/MATR/NASA-Randolph calibrated. A sentence such as "Fade profiles resemble but do not replicate the MIT–Stanford fast-charging dataset (Severson 2019)" is expected.
- ★★ **Missing: limitations.** No calendar aging, no temperature trajectory (each cell is isothermal), no two-compartment SEI/LAM split, no cell-to-cell variation beyond Gaussian draws, etc.

### 3.7 `99-glossary.md` (8 lines)

- ★★★ **Entirely empty.** Populate with ≥ 40 entries. Scope target:
  - **Materials**: stress, strain, proof stress (0.2%), Young's modulus, UPL/LPL, UTS, fracture point, foot correction, Ramberg–Osgood, representative curve, Zener–Hollomon Z, Arrhenius plot, flow stress, strain rate, plane-strain compression, test type (UT/PST/CC).
  - **Finance**: log return, annualized return/volatility, Sharpe ratio, max drawdown, beta, skewness, excess kurtosis, sector, risk-free rate, trading day (252/yr).
  - **Climate**: annual mean, annual range, seasonal amplitude, summer anomaly, trend per year, poleward amplification, continentality, hemisphere, latitude, altitude.
  - **Battery**: cycle, C-rate, SoC, SoH, capacity fade, retention, knee, stretched-exponential, chemistry (NMC811/NMC622/NCA/LFP), nominal capacity.
  - **Cross-cutting**: dataset, info table, test_id, metadata, analyzer, parameter, scatter plot, representative curve, experimental matrix.
- ★★ **Format.** Bolded term + colon + 1–3 sentences, cross-linked to methodology and first-use domain page. ≤ 75 words per entry.

---

## 4. What is missing entirely

1. **Reproducibility statement.** Per page or in a single `05-reproducibility.md`: pinned versions, seeds, data sources, commands. (M)
2. **Data provenance tables.** Per domain, a table with columns {Source, License, Access date, N, Pre-processing}. Particularly important when real public datasets are folded in alongside synthetics. (M)
3. **Worked numeric example.** An end-to-end walkthrough with actual numbers from the UI: load → extract (show 5 specimens × parameter table) → scatter (show the plot, name the observed trend). The basic-usage notebook does this implicitly; the docs must do it explicitly. (L)
4. **Abstraction-comparison page.** One-page compare-and-contrast showing the four domains side-by-side at the schema/analyzer level. This is what justifies the generalisation claim. (M)
5. **Design rationale.** Why three steps? Why scalar parameters, not latent-space embeddings? Why per-entity aggregation, not cross-entity regression on the raw series? (M)
6. **"How to add a new domain" chapter.** Step-by-step: define the metadata schema, implement the analyzers in `src/lib/analyzers/yourdomain.ts`, register in `registry.ts`, write the synthesis preset, add the docs page. Without this, the tool is a closed catalogue, not a framework. (L)
7. **Known-limitations section per synthetic generator.** Already called out above; must be its own thing. (S)
8. **UI walkthrough with screenshots.** At least one image per page; a pipeline diagram at the top of the overview. (M)
9. **Changelog / versioning policy.** Which page corresponds to which web-app release? How will the docs track the library? (S)
10. **Contributor guide.** How to propose a new analyzer, testing conventions, style rules (units, naming, NaN policy). (M)
11. **Testing statement.** What is covered by `vitest` or equivalent? What numerical tolerances? (S)
12. **Failure-mode gallery.** "What goes wrong" per domain: series too short, all-NaN, zero-variance, monotonic anomaly. Particularly relevant for `cyclesTo80Pct` and `kneeCycle`, which return `null` in edge cases. (M)

---

## 5. Rubric for students

Use this as the acceptance criterion before requesting another supervisor read.

### 5.1 Depth (word-count order-of-magnitude, ±30% is fine)

| Page | Target |
|---|---|
| `00-overview.md` | 900–1300 words, 1 schematic, 1 screenshot, 1 quick-start code/UI block |
| `10-methodology.md` | 2500–3500 words; every analyzer documented |
| `20-materials.md` | 2500–4000 words (5 case studies × ~600 w each + intro + synthesis) |
| `30/40/50-*.md` | 1200–1800 words each |
| `99-glossary.md` | ≥ 40 entries, 30–75 words each |
| (new) `05-design.md` | 700–1000 words |
| (new) `60-reproducibility.md` | 400–700 words |

Total target: 12–18 kwords across the docs site. Draft is currently ~700 words.

### 5.2 Voice

- Opening sentence of every page must name the concrete activity (not the plumbing) and commit to a claim.
- First-person plural is acceptable in the case-study pages (matches the notebooks). Reference pages stay in third-person.
- No placeholder block quotes or `TODO` strings in rendered output. Use HTML comments for supervisor notes.
- One H1 per file. H2 for major sections. H3 for sub-steps.

### 5.3 Quantitative backing

- Every numeric claim ("positive Sharpe", "poleward amplification", "knee in a quarter of cells") must be accompanied by either the realised number on the shipped seed, or a clearly labelled design-target number with a realised-value footnote.
- Every analyzer described in prose must also show a formula in math mode.
- Every "works in edge case X" claim must cite the function and line in `src/lib/analyzers/*.ts`.

### 5.4 Citations

- ≥ 1 citation per domain chapter. Ramberg–Osgood (1943 NACA TN 902), Zener–Hollomon (1944 J Appl Phys), Sharpe (1966 J Business), Severson et al. (2019 Nature Energy), GHCN-Daily (Menne 2012 J Atmos Ocean Tech).
- Citations in a `## References` section at the bottom of each page, in IEEE or APA, consistently.

### 5.5 Figure and table integration

- ≥ 1 figure per domain page showing a representative scatter (e.g. yield stress vs temperature for materials; Sharpe vs beta for finance).
- ≥ 1 table per domain page summarising parameters-per-entity for a small subset (5–10 rows).
- Every figure has a caption with {source, axes, units, sample size, seed}.
- Pipeline schematic on the overview page.

### 5.6 Limitations

- Every domain page ends with a `## Limitations` H2 containing ≥ 3 items as a numbered list.
- Every analyzer doc ends with "Edge cases:" bullet list.

### 5.7 Reproducibility

- Every synthetic dataset page names (seed, generator-file-path, N, units, calendar convention).
- Every case-study page links to the relevant notebook at a pinned tag of `dan-slater/paramaterial-examples`.
- A single top-level `Reproducibility` page lists pinned versions of paramaterial-web, paramaterial (Python), SvelteKit, Node, and any data files.

---

## 6. Ranked punch-list — top 10 next actions

Effort: S = ≤ half day, M = 1–3 days, L = 3+ days.

1. **Write the methodology reference content.** All 26 analyzers; formula + implementation + edge cases + reference. This is the highest-leverage item and blocks the domain pages. Verify signatures against `processing.ts` and `analyzers/*.ts` as you go. **Effort: L.**
2. **Populate the glossary with ≥ 40 entries.** Use the list in §3.7 as the starter. Cross-link from every first-use in the domain pages. **Effort: M.**
3. **Rewrite `00-overview.md`.** New title, 900-word body, quick-start with screenshot, domain-comparison table, scope/non-goals paragraph. **Effort: M.**
4. **Write CS1–CS4 materials subsections** by mirroring the notebook structure (≥ 500 words each with at least one embedded figure and one results table). Verify N per case study against `info_table` counts. **Effort: L.**
5. **Flesh out each synthetic-domain page (finance, climate, battery)** to 1200+ words including: generator seed + file, analyzer formulas, design-target table with realised values, reproduction steps, limitations. **Effort: L.**
6. **Add a `05-design.md` page** explaining why the three-step abstraction is the right one and how the four domains map onto it. 700–1000 words. **Effort: M.**
7. **Add a `60-reproducibility.md` page** pinning versions, seeds, commit SHAs, data URLs. **Effort: S.**
8. **Add one pipeline schematic and one screenshot per page.** Even hand-drawn PNGs at first. **Effort: M.**
9. **Add `## Limitations` and `## References` sections to every page.** Standardise citation format. **Effort: S once the content exists.**
10. **Scrub placeholder block-quotes, confirm KaTeX works in the SvelteKit markdown pipeline, run a link-check.** Ship-readiness pass. **Effort: S.**

Recommended order: 1 → 2 → (3, 7) in parallel → 5 → 4 → 6 → (8, 9, 10). Expect ~3–4 weeks of focused student time, not the weekend you are probably hoping for.

---

## Appendix: factual/code checks the students should make

- `registry.ts` advertises `MPa` for `E`, but `findE` returns whatever units the input carries. State: "MPa is the convention when input stress is in MPa."
- `finance.ts:42` defaults `riskFreeRate = 0.04` — surface this in prose.
- `climate.ts:93` summer months are `[5,6,7]` N, `[11,0,1]` S. Put in glossary.
- `battery.ts:115` `kneeCycle` requires `n ≥ 20` finite samples and `|s2| ≥ 2·|s1|`. Document.
- `processing.ts` exposes 8 materials functions; methodology stub lists 7. Reconcile.

End of review.
