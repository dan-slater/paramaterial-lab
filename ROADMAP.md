# Roadmap

What ships now, and what comes next in small releases. Each stage leads with what a user will notice.

## v0.2 (now)

- **Materials.** The thesis tension and compression data (basic usage plus case studies CS1–CS4), with foot correction, properties, representative curves, Ramberg–Osgood and Zener–Hollomon.
- **Finance and climate.** Real data: 40 US large-cap tickers (Yahoo Finance) and 30 NOAA GHCN-Daily stations. Each has its own parameters and its own chapter.
- **CSV import.** Bring your own series. Files are parsed in the browser and never uploaded.
- **Docs and chat.** The docs give every number with the script that computes it. Chat is bring-your-own-key and runs in your browser.
- **Battery is experimental.** `/lab/battery` works, behind a banner, but it is not on the picker or in the docs. It covers only each cell's first 100 cycles, so most fade parameters come out empty.

## v0.3: better scatters

- The parameter scatter gets a colour key, so you can colour points by sector, lot, hemisphere or batch in one click.
- Categorical axes, so "X = sector" or "X = lot" is a plot instead of a table lookup.
- `build-climate.mjs` writes `abs_latitude` metadata, so the climate chapter's annual-mean-vs-|latitude| result can be plotted in the UI.

## v0.4: battery leaves experimental

- Battery is rebuilt over each cell's full life from the matr.io `.mat` files. Cycles to 80 %, retention at cycle 500, the knee and the stretched-exponential fit then have data to work on.
- The charging `policy` string is parsed into `c1`, `soc_switch` and `c2` metadata, so each charging step can be scattered against cycle life.
- Battery returns to the picker and the docs, with its chapter rewritten from the new numbers.

## v0.5: covariates and a stricter bench

- A covariate schema (`Dataset.covariates`) puts finance β and factor loadings in the Parameters block instead of in a side calculation.
- Climate seasonal bins align to the calendar (from `provenance.window.start`), and the harmonic fit gains a second harmonic, to test whether the residual trend–amplitude correlation is leakage from the shape of the seasons.
- `scripts/chapter-numbers.mjs` runs in CI as a failing test: if a rebuild changes a number that a chapter states, the build fails until the chapter is updated.

## v0.6: docs polish

- KaTeX renders the formulas in the methodology and climate chapters, replacing Unicode and code fences.
- A short design chapter (`05-design.md`) explains why the unit of analysis is scalar parameters plus a metadata scatter, and what that gives up.
- A pipeline diagram at the top of the overview (dataset → series → parameters → scatter), and a reading guide for first-time readers.
- Technical terms in the chapters link to their glossary entries.

## Open, not yet scheduled

- Full citations for the Baron and Hyde data sources in the materials chapter. They are placeholders until the thesis reference table is checked.
- A recorded walk-through of the overview's quick-start.
