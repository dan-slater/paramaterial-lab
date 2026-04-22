# Future work — paramaterial docs

Derived from `SUPERVISOR_REVIEW_2.md` (Tier C) and `SUPERVISOR_REVIEW_3.md` (final sign-off). All items below were declared non-shipping-blocking for v0.1.0. Target: v0.1.1 or v0.2.

## Residual Tier B (one item)

- **Glossary anchor-linking from chapters.** Add markdown links from first-use of each technical term in `20-materials.md`, `30-finance.md`, `40-climate.md`, `50-battery.md` into the corresponding `99-glossary.md` anchor. Rough estimate: 20–30 link insertions per chapter. Mechanical once a student pairs terms with anchors.

## Tier C — 7→9 improvements

1. **`05-design.md`**. A ~500–800-word chapter defending the three-step (series → analyzer → parameter → scatter) abstraction against the most obvious alternatives: whole-series regression, latent embeddings, summary-statistics + ANOVA. State why paramaterial chose scalar parameters + metadata scatter as the unit of analysis, and what the abstraction gives up.

2. **Pipeline schematic at the top of `00-overview.md`**. One SVG or PNG showing the four blocks — Dataset → Stress–strain plot → Parameters table → Parameter scatter — with arrows labelled `series`, `scalar`, `scatter`. Even a hand-drawn one beats prose here.

3. **KaTeX math rendering.** The methodology chapter currently renders formulas as Unicode + code fences because `src/lib/components/Markdown.svelte` does not ship a KaTeX plugin. When KaTeX is wired, convert the Unicode formulas in methodology and climate to proper `$…$` / `$$…$$` blocks. `marked` has first-party `marked-katex-extension` support; roughly one half-day of work including one reference formula per section.

4. **Numeric-anchor cross-references in `10-methodology.md`**. The chapter has a handful of `(see §1)` / `(section 6)` pointers; two were converted to anchor links in the second fix-up pass, but a sweep for any remaining plain numeric references is worth doing before v0.2.

## Lightweight candidates

- Add a **visual diff** between materials-real and the three synthetic domains to the overview, showing that the synthetic scatters are designed to be easily-recoverable whereas the materials scatter carries real experimental noise.
- Add a **"reading guide"** paragraph to `00-overview.md` that tells a first-time reader whether to read the chapters sequentially (materials → methodology → domains), by domain (direct to one), or as a reference (methodology + glossary only).
- Embed **a Playwright-driven live demo** of the click-path from the overview's quick-start, generating a short MP4 or animated PNG checked into `static/docs-img/`.

## Deferred but flagged by supervisor

- The materials chapter's source citations for Baron (2005) and Hyde remain `placeholder pending confirmation`. Whoever has access to the original MSc-thesis reference table should promote them to full citations.
- The quick-start UI labels were normalised against `src/lib/analyzers/registry.ts` in the second fix-up pass, but no one has walked the six clicks live and diff-ed the resulting block labels against what appears in the UI's `aria-label`s. A one-hour Playwright script would close this.

---

Commit alongside `SUPERVISOR_REVIEW_3.md` as the research-unit's record of what shipped, what didn't, and why.
