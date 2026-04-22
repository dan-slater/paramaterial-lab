# Supervisor Review 3 — paramaterial web docs (final sign-off)

Reviewer: supervisor
Date: 2026-04-21
Drafts reviewed: `00-overview.md`, `10-methodology.md`, `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md`, `60-reproducibility.md` (new), `99-glossary.md`
Against: `SUPERVISOR_REVIEW_2.md` (second pass, same day)

---

## 1. Sign-off verdict

This is shippable as v0.1. The students closed the Tier A punch-list substantially in full, added the `60-reproducibility.md` file that pass 2 demanded, wired references into every chapter, and dropped four embedded PNG scatter plots into the `static/docs-img/` tree so that every domain chapter now carries at least one figure. The CS2 units confusion that was flagged in pass 2 as "the single most concerning factual issue" has been resolved with a boxed units note plus a two-column raw/physical table — an honest fix that preserves the notebook's numbers while telling the reader how to interpret them. Final rating: **8.5/10**, a clean +1.5 delta on the pass-2 rating of 7/10. The remaining gap to 9.5/10 is the untouched Tier C work (a dedicated design-rationale page and KaTeX math rendering), and one residual terminology mismatch in the overview's quick-start that the caller may want to smoke-test against the live UI before they put the docs in front of an external reader. None of those are shipping-blocking.

---

## 2. Tier A closure audit

Pass 2 ranked seven Tier A items as "cheap wins, high impact". Closure status:

**A1 — CS2 units fix (`20-materials.md`).** **Closed.** The CS2 Key Results section now carries a block-quoted "Units note" that spells out the `Strain *= 100` rescaling, explains that the `/10` division in the notebook is the correct conversion (not a bug), and quotes the table in *both* `MPa/%` raw and `GPa` physical columns. The prose explicitly reconciles with the basic-usage numbers: "UT moduli at 20–300 °C (58.9 → 30.3 GPa) agree with the basic-usage corpus … within one pooled standard deviation." That's exactly the treatment pass 2 asked for.

**A2 — `## References` on every chapter.** **Closed.** All seven chapters now end with a references section. Methodology carries six (Ramberg–Osgood, Zener–Hollomon, Sharpe, Joanes–Gill, Severson, Menne GHCN); materials five (including the honest "placeholder pending confirmation" for Baron and Hyde); finance five; climate four; battery four. Overview carries a minimal four. The honest placeholder treatment for the materials internal-report sources is the right call and preserves the chapter's integrity.

**A3 — Overview quick-start terminology (`00-overview.md`).** **Partial.** Step 3 now writes "tick **Young's modulus** (key `E`), **0.2% proof stress** (key `ProofStress`), and **Ultimate tensile strength** (key `UTS`)" with a parenthetical link "[see methodology §2 for formulas](#2-materials-analyzers)". The UI-label-plus-registry-key pattern matches how finance and battery chapters label their analyzers and is defensible. The residual risk is whether the UI's live label strings literally read "Young's modulus" and "0.2% proof stress" — unverified from the docs alone.

**A4 — Glossary fixes and expansion (`99-glossary.md`).** **Closed.** The `summerAnomaly` entry now reads "Summer months are fixed by hemisphere — Jun–Aug for `'N'` and Dec–Feb for `'S'` — not chosen as the hottest quarter of the year," which is exactly the code-matching correction pass 2 asked for. The glossary's entry count is up visibly: materials gained `foot correction`, `representative curve`, `fracture point`, `plane-strain tension (PST)`, `test type (UT/PST/UC/PSC)`; climate gained `annual range`, `extreme hot/cold days`, `continentality`, `altitude`, `hemisphere`; finance gained `risk-free rate`, `market shock`, `sector shock`, `idiosyncratic β`, `skewness`, `excess kurtosis`; battery gained `censored cell`, `stretched exponential`, `rate constant k`, `retention`, plus `test_id`, `info table`, and `experimental matrix` in the cross-cutting section.

**A5 — Battery `mAh/g` parenthetical and `retentionAt` roadmap note (`50-battery.md`).** **Closed.** First mention reads "discharge capacities in mAh/g, i.e. specific capacity per cathode active mass". The `retentionAt` paragraph now says plainly: "Parametric `Ret@N` for arbitrary `N` … is **roadmap** (not shipped): the function supports it today, but no registry row yet exposes it to the UI." That's the exact roadmap-vs-shipped disambiguation pass 2 requested.

**A6 — Climate `trendPerYear` casing and planted-signals pointer (`40-climate.md`).** **Closed.** The chapter uses camelCase `trendPerYear` consistently throughout (analyzers section, recoverable-relationships section, extensions list). The Limitations section now opens with a dedicated "Known planted signals" paragraph naming both the Phoenix heat-dome and the Yellowknife polar-vortex injections and calling them "diagnostic rather than emergent". That's cleaner than pass 2 asked for.

**A7 — Finance registry-label reconciliation (`30-finance.md`).** **Closed.** The analyzer prose now carries an explicit mapping: "the analyzer is referred to by its registry key `MaxDD` (displayed as **Max drawdown** in the UI); the other finance analyzer keys and their UI labels are `AnnReturn` → **Annualized return**, `AnnVol` → **Annualized volatility**, `Sharpe` → **Sharpe ratio**, `Skew` → **Return skewness**, and `ExKurt` → **Excess kurtosis**." The "Reproducing" section propagates the same convention.

---

## 3. Tier B closure audit

**B8 — New file `60-reproducibility.md`.** **Closed.** The new file exists and does exactly what pass 2 scoped: it pins paramaterial-web to v0.1.0, names the `dan-slater/paramaterial-examples` MSc-notebook tags, tabulates the build environment (Node ≥ 20, SvelteKit ^2.57, Svelte ^5.55, uPlot ^1.6), tabulates the three synthetic-dataset seeds (`20260421` for finance and battery, `0xC11A7E` for climate), gives the rebuild commands, notes the materials-preset decimation (≤ 2 000 samples per test, < 0.5 % loss at UTS), and appends a changelog tagged v0.1.0.

**B9 — Six-click quick-start walk-through plus overview screenshot (`00-overview.md`).** **Partial.** Terminology has been tightened (see A3). An explicit `materials-scatter.png` exists in `static/docs-img/`, but the overview chapter itself embeds *no* image — the figure sits inside `20-materials.md`'s Basic Usage reproducing section, not at the top of the overview. A pipeline schematic of the `series → analyzer → parameter → scatter` pattern is still absent from the overview (the Tier C item C15 survives as a consequence). A reader landing on the overview cold will see prose-only and will have to click into a domain chapter to see the canonical plot.

**B10 — Materials chapter-level `## Limitations` and `## Cross-study synthesis` (`20-materials.md`).** **Closed.** Both now exist. The cross-study synthesis at the chapter tail delivers exactly the "same pipeline, different metadata axis" framing the first-pass review asked for: "What varies is the *metadata axis* that ends up as X on the final parameter scatter — `lot` in Basic Usage … `test_type` in CS2 … `material` or `rate` in CS3." The chapter-level Limitations section lifts the four cross-cutting caveats (provenance, CS2 units, compliance tail in `FP_0`, preload assumption) out of the per-CS paragraphs and makes them visible at the chapter level.

**B11 — In-text glossary links from domain chapters.** **Open.** No markdown-anchor links from `20-*`, `30-*`, `40-*`, or `50-*` chapters into `99-glossary.md` are present. First-use terms like "C-rate", "Sharpe ratio", "continentality", "UPL" are bolded or italicised in prose but not linked. This is the one Tier B item that did not close, and it is the closest thing to a genuine regression risk against the "graduate student opening the tool cold" test.

**B12 — At least one screenshot per chapter.** **Mostly closed.** Four PNG scatters shipped to `static/docs-img/` (materials, finance, climate, battery) and are embedded in the corresponding domain chapters. Overview and methodology still carry no figures. On the "one per chapter" bar that is four out of six content-bearing chapters; the overview gap is the one most worth closing because the overview is the landing page.

---

## 4. Tier C status

**C13 — Dedicated `05-design.md`.** **Still deferred.** No new file. The six-sentence "Design rationale" paragraph in `00-overview.md` is unchanged. Recommend *not* escalating before ship; this is a research-tool v0.1, and the scope/non-goals paragraph plus the design-rationale paragraph together discharge the minimum requirement. A 500-word defence against whole-series regression / latent embeddings / summary-stats + ANOVA alternatives belongs in v0.2.

**C14 — Methodology cross-references and KaTeX.** **Partial / deferred.** The numeric cross-references now carry proper MD anchor links: `The `ParameterDef[]` registry ([section 6](#6-analyzer-registry))` and `conforming to `Dataset` ([section 1](#1-shared-conventions))` both resolve. That half is closed. The KaTeX half is **deferred deliberately**: methodology §1 opens with a block-quoted "Note on math rendering" that tells the reader the LaTeX-adjacent content is held in code fences pending KaTeX wiring. That is the right call for v0.1.

**C15 — Pipeline schematic in the overview.** **Still open.** No SVG or PNG of `series → analyzer → parameter → scatter` exists in the overview. Recommend **escalating** this one before ship if time permits: the four existing scatters are domain-specific and the overview's generalisation claim would land harder with a single abstract schematic. If time does not permit, defer to v0.1.1.

**C16 — KaTeX infra.** **Deferred with explicit docs-side acknowledgement.** Methodology flags the gap; reproducibility notes it implicitly (uPlot is listed but no math-rendering dependency). Not shipping-blocking.

---

## 5. Remaining risks

- **The overview is the only content chapter without an embedded figure.** A reader landing on `/docs/overview` cold will see 1 500 words of prose before they hit a visual. The Tier B12 closure did not reach the overview. Easy post-ship fix: promote one of the four existing scatters (most likely `materials-scatter.png`) or hand-crop a block screenshot into `00-overview.md` immediately after the "Quick-start" section. Low effort, high visible payoff.
- **No glossary links from chapters to definitions.** A first-time reader hitting "UPL" in CS1 or "continentality" in the climate chapter has no one-click path to the definition. This is the single most reader-friction item still open and the one the Tier B punch-list did not close.
- **The quick-start's literal UI labels are still unverified against the live app.** Step 3 of `00-overview.md` names "Young's modulus", "0.2% proof stress", and "Ultimate tensile strength" as UI labels. The registry-key parenthetical is a good belt-and-braces, but someone should walk the six clicks in a running build before the docs go in front of an external reader. If the labels drift, every domain chapter's "Reproducing" recipe drifts with them.

---

## 6. Closing paragraph

Would this documentation set serve a graduate student opening paramaterial cold? Yes. The overview lands the one-paragraph workflow claim without being evasive, the methodology chapter is a genuinely good technical reference that a student would reach for when they need to know what `findProofStress` actually does, and the four domain chapters each carry a recoverable-relationships section pinned to concrete numerical targets (+0.73 β-vs-MaxDD, +0.96 seasonal-amplitude-vs-latitude, −0.75 cycles-to-80%-vs-C-rate, the 71 % UTS decay across the materials temperature sweep) so that the student can tell immediately whether their local build matches the docs. The reproducibility page closes the loop: seeds, versions, rebuild commands, and an honest statement that the materials presets are decimated re-encodings of the Python-library data. The CS2 units note in the materials chapter is the single most important piece of editorial work the students did in this pass — it converts what would have been a "the docs are wrong" moment into an "oh, I see why they did that" moment. The residual risks are cosmetic (no figure in the overview, no glossary anchor-links, the quick-start UI labels unverified) and the deferred Tier C items (design-rationale page, pipeline schematic, KaTeX) are explicitly v0.2 work. Ship as v0.1.0, put the three Remaining-risks items on the v0.1.1 stub, and move on. The gap from the first-pass stubs to this final set is larger than most one-sprint docs efforts achieve; the students have earned the sign-off.

End of review.
