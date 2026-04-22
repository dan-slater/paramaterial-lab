# Supervisor Review 2 — paramaterial web docs (second pass)

Reviewer: supervisor
Date: 2026-04-21
Drafts reviewed (revised): `00-overview.md`, `10-methodology.md`, `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`, `99-glossary.md`
Against: `SUPERVISOR_REVIEW.md` (first pass, 2026-04-21)

---

## 1. Top-line verdict

This is a dramatic, defensible improvement on the stubs. The methodology chapter in particular is now what a reference manual should look like: every materials, finance, climate, and battery analyzer has a signature, a formula, numerical-convention prose, and an edge-case statement. The four domain chapters all have provenance, a research question, a limitations section, and a reproduction recipe. On a 1–10 scale I would rate this **7/10** and call it shippable as v0.1 research-tool documentation with a named-known-issues list. To move to 9/10 the team needs to (a) add a `## References` section to every chapter (zero citations still; the first pass flagged this and it is unresolved), (b) put at least one embedded figure or screenshot into each chapter, (c) settle the CS2 materials numerics where units are visibly wrong, and (d) add the promised pipeline schematic and a `05-design.md` / `60-reproducibility.md` pair. None of those are week-long jobs. This is a one-sprint finish.

---

## 2. First-pass concerns that are now resolved

One line each; keep them short.

- **§2.1 Voice flat/over-hedged.** Resolved. Every chapter now opens with a concrete activity or question; `40-climate.md` and `50-battery.md` in particular open on the research question rather than plumbing. Placeholder block-quotes are gone.
- **§2.2 Pedagogy/reference split undecided.** Resolved by convention: overview = tour, methodology = reference, domain pages = case-study cookbook. The split now reads intentionally.
- **§2.5 Units informally handled.** Resolved. `10-methodology.md` §1 has the per-domain (strain, stress) units table the first pass demanded.
- **§2.6 Math absent.** Resolved. `10-methodology.md` now renders Ramberg–Osgood, Zener–Hollomon, Sharpe, skew/kurtosis, trendPerYear, kneeCycle criteria with formulas and implementation details. Finance and battery chapters also quote formulas inline.
- **§2.9 Limitations sections missing.** Resolved for the three synthetic domains. Finance has "Limitations and extensions"; climate has "Limitations and extensions"; battery has "Limitations and extensions". Materials is partial (see below).
- **§3.1 Overview title/quick-start missing.** Resolved. New H1, six-click quick-start, scope/non-goals paragraph, design-rationale paragraph, and a domain overview with numbers all present.
- **§3.2 L35 `findE` vs `findUplLpl` factual inconsistency.** Resolved — both are documented separately and the relationship between them is stated.
- **§3.2 L39 `logReturns` and `riskFreeRate = 0.04` default missing from finance list.** Resolved.
- **§3.2 L43 `summerAnomaly` hemisphere default behaviour.** Resolved — methodology explicitly states the default is `'N'`.
- **§3.2 L47 battery `Ret500` / `retentionAt`.** Resolved — methodology names both the parametric analyzer and the registry's fixed `cycle = 500` entry.
- **§3.3 Materials provenance/N.** Mostly resolved for Basic Usage (154 stated with origin), CS1 (76, lots A–E named), CS2 (74, lots F–I), CS3 (70, three alloys × six temperatures × two rates), CS4 (40, PSC/PSC*).
- **§3.4 Finance seed and shock window.** Resolved — seed `20260421`, days 175–185 market-wide, 325–335 Energy-only, per-ticker β jitter spec.
- **§3.4 Finance Sharpe clustering as a claim-without-numbers.** Resolved — the per-sector Sharpe table is in `30-finance.md`.
- **§3.4 Finance corr(β, MaxDD) quantified.** Resolved at +0.73.
- **§3.5 Climate dataset description.** Resolved — 41 stations by name, continentality index, three correlations anchored numerically.
- **§3.5 Climate per-station metadata schema.** Resolved — lat, lon, altitude, country, continentality, hemisphere all named.
- **§3.5 Climate trend-fit method and month-boundary approximation.** Resolved in `10-methodology.md` and `40-climate.md`.
- **§3.6 Battery design matrix reconciliation.** Resolved — 4 × 4 × 3 = 48 + 2 replicates = 50 cells, explicitly called out.
- **§3.6 Battery fade model.** Resolved — stretched exponential `C₀·exp(−k·n^α) − β·n` with k-factor decomposition.
- **§3.6 Battery knee-detection thresholds.** Resolved — 10 % minimum segment, 1 % stride, |s₂|≥2|s₁| all named in both methodology and chapter.
- **§3.7 Glossary empty.** Mostly resolved — ~30 entries present covering all four domains plus cross-cutting. Short of the 40-entry target but the entries that exist are good.
- **§4.6 "How to add a new domain" chapter.** Resolved — `10-methodology.md` §7 covers builder-script, analyzers, registry, and preset steps.

That is roughly two-thirds of the first pass, cleared. Good work.

---

## 3. First-pass concerns that are still open

Each item cites the original finding and names the target file.

1. **§2.3 Reproducibility statement missing.** Still open. No chapter names the pinned paramaterial-web version or the `dan-slater/paramaterial-examples` commit/tag. Fix: add `60-reproducibility.md` or a top-of-page "Reproducibility" box in each chapter with (version, seed, data path, command). Target: new file `/src/lib/docs/60-reproducibility.md` plus a one-line back-reference from `00-overview.md`.
2. **§2.4 No citations.** Still open. Every chapter discusses named models (Ramberg–Osgood, Zener–Hollomon, Sharpe, Joanes–Gill, Severson 2019, GHCN, Merton/Kou, Heston, Clausius–Clapeyron) without a `## References` section. Fix: append `## References` to every chapter in IEEE or APA — minimum one citation per domain chapter; minimum three in methodology. Files: all seven.
3. **§2.7 Accessibility of domain detail.** Partially addressed. Glossary exists but domain chapters do not link into it on first-use. Fix: add MD links from `10-methodology.md`, `20–50-*.md` first-uses of terms into `99-glossary.md` anchors. Files: `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`.
4. **§2.8 No figures, no screenshots.** Still open. Zero images across all seven chapters. The six-click quick-start in `00-overview.md` is text, not an annotated screenshot. Fix: add at least one screenshot per chapter and a pipeline schematic at the top of the overview. Files: all seven.
5. **§2.10 Design-rationale page.** Partially addressed. `00-overview.md` has a six-sentence "Design rationale" paragraph, but the promised `05-design.md` defending the three-step abstraction against alternatives (latent embeddings, whole-series regression, summary stats + ANOVA) is not written. Fix: new file `/src/lib/docs/05-design.md` or expand the overview section to ~500 words naming the alternatives and saying why they are not the default.
6. **§3.3 Materials dataset source papers.** Partially addressed. Each case study now writes "**source unknown**" honestly, which is better than silent omission — but the Aakash reference table and the Baron/Hyde simulator identifications in CS3/CS4 deserve at least an internal-report or institution citation. Fix: add what is known (institution, MSc-thesis tag of `dan-slater/paramaterial-examples`) to the Provenance box of each CS. File: `20-materials.md`.
7. **§3.3 Materials cross-study synthesis paragraph.** Still open. The page opens with a strong framing paragraph, but there is no closing 1–2 paragraph that steps back and says "across CS1–CS4, the same pipeline handled lot-variation, test-type-variation, hot-compression, and PSC with only the metadata axis changing." Fix: add a "Cross-study synthesis" H2 at the end of `20-materials.md`.
8. **§3.4 Finance "how to reproduce" walkthrough.** Partially addressed — `30-finance.md` has a "Reproducing in the web tool" section but it is text steps, no screenshot and no explicit UI-control names. Fix: verify the UI labels named in step 2–5 match the actual component labels in `src/lib/blocks/` and add a screenshot. File: `30-finance.md`.
9. **§3.5 Climate injected-event list.** Partially addressed — the heat-dome and polar-vortex injections are now named in provenance, but the `## Limitations` section does not also call them out as *known planted signals* so a reader knows which visible anomalies are diagnostic vs accidental. Fix: add a one-line "Known planted signals" note at the top of the Limitations section. File: `40-climate.md`.
10. **§3.6 Battery chemistry units and C-rate definition.** Partially addressed. Glossary has C-rate and chemistry definitions, but the chapter still says `mAh/g` without saying specific-capacity-per-cathode-mass. Fix: one parenthetical where `mAh/g` first appears in `50-battery.md` or methodology §5. Low effort.
11. **§3.7 Glossary 40-entry target.** Partially addressed — ~30 entries shipped. Missing: `foot correction`, `representative curve`, `experimental matrix`, `test_id`, `info table`, `fracture point`, `plane-strain tension (PST)`, `test type (UT/PST/UC/PSC)`, `annual range`, `extreme hot/cold days`, `idiosyncratic β`, `sector shock`, `market shock`, `continentality`, `altitude`, `hemisphere`, `censored cell`, `rate constant k`, `stretched exponential`, `retention`, `conformance matrix`, `risk-free rate`, `skewness`, `excess kurtosis`. File: `99-glossary.md`.
12. **Factual/code check (§Appendix of review 1): `processing.ts` lists 8 materials analyzers, methodology lists 7.** Resolved — all eight documented. Keep this one in the win column.

---

## 4. New concerns raised on re-reading

The stubs hid these.

### 4.1 Consistency between case studies — structural drift

I asked for: per-domain (units table, reproducibility box, limitations, references). Current state:

| Chapter | Units table | Reproducibility box | Limitations H2 | References H2 |
|---|---|---|---|---|
| `20-materials.md` | No (methodology has it) | Per-CS "Reproducing" code block | CS-level paragraph only, no H2 | **Missing** |
| `30-finance.md` | No | Yes | Yes | **Missing** |
| `40-climate.md` | No | Yes | Yes | **Missing** |
| `50-battery.md` | No | Yes | Yes | **Missing** |

The climate, finance, and battery chapters are structurally matched (Preamble → Provenance → Analyzers → Recoverable relationships → Reproducing → Limitations → Mapping back). Materials breaks the pattern — it uses per-case-study sub-blocks rather than chapter-level H2s, and its "Limitations" subsections exist under each CS instead of as a chapter-level H2. Pick one pattern. Recommendation: keep materials' per-CS structure but also add a chapter-level `## Limitations` and `## References` at the bottom of the page.

### 4.2 Terminology drift between chapters

- **`50-battery.md`** uses "8.66×10⁻⁴ /s"... no, that was materials. In battery it's "C-rate". Fine. But note: `50-battery.md` says "cycles-to-80 % SoH" while the analyzer key is `cyclesTo80Pct` and the glossary registers the cycle key (`Cyc80`). Three names for one thing. Pick one display name and use it everywhere; cross-reference the analyzer key parenthetically.
- **`40-climate.md`** uses `c_rate` nowhere — correctly — but `trendPerYear` is rendered as "`trendPerYear`" (camelCase) in §Analyzers and as "`trend_per_year`" (snake_case) two lines later in §Recoverable relationships. Methodology is camelCase throughout. Standardise to camelCase in prose.
- **`30-finance.md`** uses `Max drawdown` (capitalised, spaced) as the UI axis name in "Reproducing" but `MaxDD` in methodology. Similarly `cyclesTo80Pct` appears as "Cycles to 80% SoH" in `50-battery.md` quick-start. These are probably correct UI labels, but the student should verify against `src/lib/analyzers/registry.ts` and either match the registry `label` field exactly or add a note that UI labels differ from keys.
- **`00-overview.md`** quick-start step 3 names `findE`, `findProofStress`, `findUTS` — internal function names that do not appear in the UI. Either the UI exposes these names (verify) or the step should name the analyzer *labels* from the registry (`E`, `ProofStress`, `UTS`). This is the highest-friction inconsistency a first-time user will hit.

### 4.3 Quick-start clicks vs actual UI — unverified

`00-overview.md` §Quick-start promises a "Preset menu", "Stress–strain block", "Parameters block", "Parameter scatter block", a "Swap axes" behaviour, and a "reload the page" step to switch presets. None of this is verified against the real component labels. The review cannot confirm correctness from the docs alone; someone needs to open the app, walk the six clicks, and reconcile wording. Same applies to the per-chapter "Reproducing in the web tool" recipes — they use names like "Foot correction (preload = 36 MPa)", "Representative curves (group by temperature)", "Ramberg–Osgood (per test, proofStrain = 0.002)". If any of those are not literal block names, the student should either rename the block or rename the doc.

### 4.4 Methodology cross-references do not use numbered anchors

`10-methodology.md` §1 says "The `ParameterDef[]` registry (section 6) is how tools discover analyzers." But §6 is "Analyzer registry" — fine — yet there is no MD anchor and no link. Similarly §7 "How to add a new domain" is referenced nowhere. Either convert these to MD links (`[section 6](#6-analyzer-registry)`) or drop the numeric cross-references and let the reader use the ToC.

### 4.5 Climate `summerAnomaly` and glossary don't match

Glossary entry says "Departure of the hottest-quarter mean from the full-record mean." But the implementation (and methodology) says "summer *three months*" (Jun–Aug or Dec–Feb), not hottest quarter. Hottest-quarter is what the reader will expect from the name but it is not what the code does. Fix the glossary to match the code.

### 4.6 Battery chapter's `retentionAt` drift

`50-battery.md` says "nearest-index lookup, skipping NaNs". Methodology says "Nearest-neighbour lookup … does **not** interpolate". Consistent. But the *registry* advertises `Ret500` only, fixed at cycle 500 — the chapter suggests "Ret@100, Ret@500, Ret@800, etc., as required" which the UI currently does not expose. Either the chapter is roadmap-writing (mark it as such) or the registry needs a parametric entry added. Flag to the battery student.

### 4.7 Overview's canonical plot for finance contradicts the shipped correlation

`00-overview.md` says "the planted correlation is about +0.73" for finance. `30-finance.md` says `corr(β, MaxDD) ≈ +0.731`. Fine. But the overview *also* attributes this to "a seeded GBM with sector-correlated shocks" — it attributes the correlation to the GBM model, when in fact the correlation is driven by the injected day-180 market dip. Tighten the overview's one-line finance description to credit the injected shock, not the GBM mechanics.

### 4.8 Materials CS2 units are off by a factor

`20-materials.md` CS2 key-results table shows elastic modulus values like "588.9 MPa · strain-in-percent". The prose then says "divide by 100 to get physical GPa equivalents" — i.e. divide 588.9 by 100 → 5.89 GPa, which is two orders below a reasonable modulus for this alloy family. Then the prose says "the notebook then divides by 10 (rather than 100) when plotting". That is a known-bug confession, not a documented result. Either:
(a) recompute the CS2 numbers in physical units and quote them correctly, or
(b) explicitly flag this table as "display units preserving the notebook bug; divide by 1000 for SI GPa" and stop waffling between 100× and 10×.
As written, the CS2 table misleads readers. This is the single most concerning factual issue in the revision.

### 4.9 `00-overview.md` quick-start uses `findE` but the page has no link to methodology

When a novice sees "select `findE`, `findProofStress`, and `findUTS`", they need a one-click path to the formula. Methodology links are implicit in the "Where to go next" section at the bottom but there is no inline link from step 3 of the quick-start to `#materials-analyzers`. Fix with a parenthetical `[see methodology §2](./methodology#materials-analyzers)`.

### 4.10 Glossary "Test" vs "Series"

Glossary says "Test: Legacy name for a single *series*". Methodology uses both terms in the same paragraph (`Test` is the schema type, `series` is the prose name). Fine in methodology. But then `Dataset` glossary entry lists the schema field as `tests[]` — correct — while "Series" glossary entry calls it "Every block in the tool ultimately reads series." So in prose we read "series" but in code we read `Test[]`. Call this out once in methodology (it already does) and stop using both words interchangeably in prose within a single paragraph.

### 4.11 No changelog / versioning policy

First pass's §4.9 flagged this; not addressed. Low priority for v0.1 but should at least have one sentence in the new reproducibility page saying "docs track web-app minor versions; this is v0.1.0".

### 4.12 KaTeX rendering not verified

Methodology §3 `skewness` / `kurtosis` write formulas with Unicode superscripts and explicit braces — no `$…$` math blocks. Climate chapter uses code-fences (` ``` `) for equations rather than math blocks. This is consistent but means math does not typeset — the documentation renders the LaTeX-like content as monospace text. If the SvelteKit markdown pipeline has KaTeX, convert the code-fence equations in `40-climate.md` and the Unicode formulas in methodology to proper `$$…$$`. If KaTeX is not wired, file a ticket to wire it before shipping.

---

## 5. Second-round punch list (ranked by impact × ease)

Format: (a) file, (b) change, (c) owner.

### Tier A — cheap wins, high impact (close these first; each is < half a day)

1. **File: `20-materials.md`** — Fix the CS2 units confusion (§4.8). Either recompute in SI GPa or add a red-boxed note that the table preserves a known notebook bug and give the correction factor. **Owner: materials student.**
2. **File: all seven chapters** — Add a `## References` section. Minimum citations: Ramberg–Osgood (NACA TN 902, 1943), Zener & Hollomon (J Appl Phys 15, 1944), Sharpe (J Business 39, 1966), Joanes & Gill (J R Stat Soc D 47, 1998), Severson et al. (Nature Energy 4, 2019) for battery, GHCN-Daily (Menne 2012 J Atmos Ocean Tech) for climate. **Owner: each domain student owns their own chapter; methodology goes to the student who wrote it.**
3. **File: `00-overview.md`** — Step 3 of quick-start: replace `findE`, `findProofStress`, `findUTS` with whatever the UI actually labels them, or add a parenthetical link to methodology. (§4.9) **Owner: overview student.**
4. **File: `99-glossary.md`** — Fix `summerAnomaly` entry so it matches the code (§4.5). Add the ~20 missing entries listed in §3.11. **Owner: whoever owns glossary.**
5. **File: `50-battery.md`** — Add a parenthetical definition of `mAh/g` on first use; state whether the `retentionAt`-at-arbitrary-cycle claim is current UI or roadmap (§4.6). **Owner: battery student.**
6. **File: `40-climate.md`** — Standardise `trendPerYear` casing throughout the chapter; add a "known planted signals" pointer at the top of Limitations (§4.2, §3.9). **Owner: climate student.**
7. **File: `30-finance.md`** — Verify and reconcile analyzer display names (`Max drawdown` vs `MaxDD`) with `registry.ts` labels (§4.2). **Owner: finance student.**

### Tier B — medium effort, high impact

8. **New file: `60-reproducibility.md`** — 400–600 words: pinned versions of paramaterial-web and paramaterial-examples, seeds (`20260421` finance/battery, `0xC11A7E` climate), data-build commands (`npm run build:data`), and a pointer from `00-overview.md`'s "Where to go next". **Owner: whoever has bandwidth; the material is already scattered across chapters, so assembly is fast.**
9. **File: `00-overview.md`** — Walk the six-click quick-start against the live UI, record the actual labels in the app, and reconcile. Add a screenshot of the final scatter (§4.3). **Owner: overview student.**
10. **File: `20-materials.md`** — Add a chapter-level `## Limitations` and `## Cross-study synthesis` (§3.7, §4.1). Keep the per-CS paragraphs, but add the aggregator. **Owner: materials student.**
11. **Files: `20–50-*.md`** — Add in-text glossary links on first-use of each technical term. 20–30 link insertions per chapter. **Owner: whoever owns the chapter.**
12. **All chapters** — Add at least one screenshot (rendered plot or UI block) per chapter. Hand-cropped from the running app is fine (§4 original §2.8, unresolved). **Owner: split by chapter.**

### Tier C — bigger, lower priority

13. **New file or expanded section: `05-design.md`** — 500–800 words defending the three-step abstraction against alternatives: whole-series regression, latent embeddings, summary-statistics + ANOVA. Say why paramaterial chose scalar parameters. (§2.10, §3.5) **Owner: the senior student or whoever wrote `00-overview.md`.**
14. **File: `10-methodology.md`** — Convert `(section 6)` style numeric cross-references to MD-anchor links (§4.4). Convert Unicode formulas to `$…$` or `$$…$$` blocks once KaTeX is confirmed wired up (§4.12). **Owner: methodology student.**
15. **File: `00-overview.md`** — Add a pipeline schematic (SVG or hand-drawn PNG) at the top showing `series → analyzer → parameter → scatter`. (§2.8, original) **Owner: overview student; figure can be trivial.**
16. **Infra (not a docs file)** — Verify the SvelteKit markdown pipeline renders KaTeX. If it doesn't, wire it before any math-heavy pages ship. **Owner: the dev who maintains the `src/lib/docs` loader.**

### Order of operations

Do Tier A in week 1. The units fix in CS2 is a single student-hour and removes the docs' most embarrassing factual issue. References are tedious but trivial. The glossary clean-up is a half-day.

Do Tier B in week 2. The reproducibility page can be written against the finished chapters in one session, and the screenshot pass is mechanical once the students are set up to grab images.

Tier C is the "move from 7/10 to 9/10" batch. It is worth doing but it is not shipping-blocking.

---

## 6. Closing note

The gap between the stubs I reviewed first and what the students delivered here is the largest one-pass improvement I have seen on this kind of docs project. The methodology chapter alone would be a respectable v0.1 docs artefact in isolation. The three synthetic-domain chapters have acquired a genuine authorial voice — particularly `40-climate.md`, which reads like someone who actually understands why three years of daily data gives a noisy per-station trend. The one chapter that did not quite land on the same structure is `20-materials.md`, and its CS2 units confusion is the single most visible regression; fix that, add references and a few screenshots, and the docs pass for v0.1.

End of review.
