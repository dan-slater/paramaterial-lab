---
title: Glossary
slug: glossary
---

# Glossary

## Cross-cutting

### Series
An ordered pair of equal-length numeric arrays `(x, y)` representing one entity's record — a stress–strain curve, a price history, a temperature trace, a discharge-capacity trace. Every block in the tool ultimately reads series.

### Test
Legacy name for a single *series*, inherited from the materials Python library. In the TypeScript schema the array field on a *dataset* is still `tests`; each element has a `test_id`, a `meta` object, and the `(strain, stress)` arrays. In prose we prefer *series*; in code we still use `Test[]`. They refer to the same thing.

### Metadata
The `meta` record attached to each test — categorical or numeric attributes that describe the entity but are not part of its time evolution (lot, temperature, sector, latitude, chemistry). The *parameter scatter* block uses metadata columns for its X-axis when you do not want another analyzer-derived scalar.

### Analyzer
A pure function `(series) → scalar` (occasionally `(series) → struct`) that reduces one *series* to one or a few numbers. Analyzers live under `src/lib/analyzers/<domain>.ts` and are the bridge from series to *parameters*.

### Parameter
The scalar output of an *analyzer* applied to a *series*. The **Parameters** block produces a table with one row per test and one column per selected analyzer; the **Parameter scatter** block plots one column against another or against a *metadata* column.

### Domain
One of `materials | finance | climate | battery | generic`. A dataset's domain selects the analyzer menu, axis labels, and default colour-by field.

### Dataset
The in-memory object passed between blocks: `{ id, name, description, info_columns, tests[], domain?, x_label?, y_label? }`. Loaded from `/data/<id>.json` by `loadDataset` in `src/lib/datasets.ts`.

### test_id
The stable string identifier on each *test* in `tests[]`. Used by blocks to join *parameters* back to *metadata* rows and to label points in the **Parameter scatter** and **Properties table** blocks.

### Info table
The metadata view of a dataset — one row per *test*, one column per `info_columns` entry. Rendered as the top panel of the **Dataset summary** block; referenced in the materials chapter when describing how lot, temperature, and rate are attached to each specimen.

### Experimental matrix
The full crossing of independent variables that defines a dataset's design — for materials, `lot × temperature × rate`; for battery, `chemistry × C-rate × temperature`. Referenced in the domain chapters' Provenance sections to say "N cells across a 4 × 4 × 3 matrix" and similar.

### Censored cell
A battery cell whose record ends before it reaches 80 % SoH. `cyclesTo80Pct` returns `null` for these, so they appear as missing rows in the **Parameters** block rather than biasing the scatter toward shorter lives. See battery chapter, Limitations.

## Materials

### UPL
**Upper proportional limit.** Highest stress at which the stress–strain curve is still linear within tolerance. Upper bound of the fit window for *Young's modulus*. Computed by `findUplLpl`.

### LPL
**Lower proportional limit.** Lowest stress above which the curve has cleared the noise band around zero. Paired with *UPL* to define the fit window for *E*. Computed by `findUplLpl`.

### Young's modulus (E)
Slope of the linear portion of the stress–strain curve between *LPL* and *UPL*. GPa units in the materials preset. Computed by `findE`.

### Ultimate tensile strength (UTS)
Maximum engineering stress reached during the test, i.e. `max(stress)`. Computed by `findUTS`.

### Proof stress (0.2 % offset)
Stress at the intersection of the measured curve with a line of slope *E* offset by 0.2 % strain. Standard engineering proxy for yield when there is no sharp yield point. Computed by `findProofStress`.

### Ramberg–Osgood
Two-parameter plastic-strain model, `ε_p = K · (σ / σ_y)^n`, fitted per specimen by `fitRambergOsgood`. High `n` means nearly-perfect plasticity.

### Zener–Hollomon parameter (Z)
`Z = ε̇ · exp(Q / RT)`, a temperature-compensated strain rate used in hot-working analysis. Computed by `computeZH`; drives the CS3 hot-compression case study.

### Flow stress
Stress on the plastic branch of the curve at a chosen plastic strain. Reported at a fixed `ε_p` via `flowStressAt` so specimens can be compared at the same deformation state.

### Specimen
A single physical sample in a materials test. One specimen → one *test*.

### Gauge length
Straight-sided region of a specimen over which strain is measured. Not computed; a standard entry in materials *metadata*.

### Foot correction
The operation of locating *UPL* / *LPL*, fitting *Young's modulus* on the linear window, and shifting each curve horizontally so that its extrapolated elastic line passes through the origin. Exposed as the **Foot correction** block and used before *proof stress* and Ramberg–Osgood fits to remove machine compliance and initial take-up.

### Representative curve
A per-group mean stress-at-strain trace, with optional ±1σ band, produced by grouping specimens (for example by *lot* or temperature), interpolating each series onto a common strain grid, and averaging. The **Representative curves** block renders one per group.

### Fracture point
The final `(strain, stress)` sample before the test ends, taken as the terminus of the curve. Not currently a first-class analyzer output but referenced in the materials chapter when distinguishing UTS-at-peak from stress-at-break.

### Plane-strain tension (PST)
A tensile *test type* in which the specimen geometry suppresses lateral contraction, enforcing ε₂ ≈ 0 in the gauge section. Appears in CS4 alongside standard uniaxial tension (UT); the resulting curves sit above UT in stress for the same material.

### Test type (UT / PST / UC / PSC)
Four deformation modes carried as a *metadata* column in the materials presets: uniaxial tension (UT), plane-strain tension (PST), uniaxial compression (UC), and plane-strain compression (PSC). Used as a colour-by key in **Stress–strain** and as a facet in **Representative curves**; CS3 and CS4 exercise the non-UT cases.

## Finance

### Log return
`rᵢ = ln(pᵢ / pᵢ₋₁)`. Time-additive and natural under *GBM*. Computed by `logReturns`.

### Sharpe ratio
`(rₐ − rf) / σₐ`, the classical risk-adjusted return. Computed by `sharpeRatio` with a 4 % default risk-free rate.

### Beta
Sensitivity of a ticker's log return to the market shock series. Stored as *metadata* in the finance preset and used as the X-axis of the canonical *max drawdown* scatter.

### Max drawdown
Worst peak-to-trough fractional loss over a price path. Computed by `maxDrawdown`, which also returns `(peakIdx, troughIdx)` so the UI can annotate the curve.

### Volatility
Sample standard deviation of daily *log returns*, scaled by √252 to annualise. Computed by `annualizedVolatility`.

### Geometric Brownian motion (GBM)
Continuous-time stochastic process used by `scripts/build-finance.mjs` to synthesise prices. Each ticker is a GBM with idiosyncratic drift and volatility plus shared market and sector shocks.

### Risk-free rate
The baseline return subtracted from a ticker's mean return in the *Sharpe ratio* numerator. Fixed at 4 % per year in the finance preset (`riskFreeRate = 0.04` in `sharpeRatio`), consistent with a short-dated sovereign proxy rather than a live Treasury quote.

### Market shock
A shared additive shock applied to *every* ticker's log-return path on a specific set of days. In the finance preset, a market-wide dip is injected over days 175–185 and is the mechanical source of the +0.73 β-vs-MaxDD correlation.

### Sector shock
An additive shock applied only to tickers in one sector. In the finance preset, an Energy-only shock is injected over days 325–335 so that sector-conditional *max drawdown* no longer collapses onto the market-β line.

### Idiosyncratic β
The ticker-specific sensitivity to the *market shock* series, drawn from a distribution centred on a sector-mean β with per-ticker jitter. Stored as `meta.beta`; the X-axis of the canonical **max drawdown vs β** scatter.

### Skewness
Third standardised moment of daily *log returns*, computed by `skewness` using the Joanes–Gill correction. Negative values indicate a heavier left tail — losses larger than mirror-image gains.

### Excess kurtosis
Fourth standardised moment minus 3, computed by `kurtosis`. Positive values indicate heavier tails than a Gaussian; the finance preset's `ExKurt` column lets the scatter surface tail-heavy tickers.

## Climate

### Annual mean
Mean daily temperature over a 365-day window (or the full record). Computed by `annualMean`; the y-axis of the canonical latitude scatter.

### Seasonal amplitude
Half the peak-to-peak swing of the 365-day periodic component of the record. Computed by `seasonalAmplitude`; grows with latitude and continentality.

### Trend
Linear slope of *annual mean* temperature over the record, in °C / year. Computed by `trendPerYear`.

### Poleward amplification
The empirical tendency for warming *trend* to scale with |latitude|. Planted deliberately in the synthetic dataset so the scatter of trend against latitude recovers it.

### Summer anomaly
Departure of the *calendar-summer* mean from the full-record mean. Summer months are fixed by hemisphere — Jun–Aug for `'N'` and Dec–Feb for `'S'` — not chosen as the hottest quarter of the year. Computed by `summerAnomaly(series, hemisphere)`, which defaults to `'N'` when the station's `meta.hemisphere` is missing.

### Annual range
Peak-to-trough span of the 365-day periodic component of a station's record — i.e. twice the *seasonal amplitude*. Used in the climate chapter as a secondary parameter when discussing continental vs coastal stations.

### Extreme hot / cold days
Count of days above (below) a threshold, computed by `extremeHotDays(series, threshold)` and `extremeColdDays(series, threshold)`. The climate preset ships `HotDays30` (days > 30 °C) and `ColdDays0` (days < 0 °C) as registry entries.

### Continentality
A `meta` index describing how far a station sits from a large water body and therefore how thermally inertial its seasons are. High continentality → large *seasonal amplitude*; used as a secondary colour-by key in the climate chapter.

### Altitude
Station elevation in metres, carried as `meta.altitude`. Primarily a bias on *annual mean* through the environmental lapse rate; treated as metadata rather than an analyzer output.

### Hemisphere
The `'N'` / `'S'` flag on each climate station's `meta`, used by `summerAnomaly` to decide which calendar months count as summer. Defaults to `'N'` when missing.

## Battery

### State of health (SoH)
Current discharge capacity divided by initial discharge capacity, as a percentage. The dependent variable of the canonical battery scatter.

### C-rate
Discharge current expressed as a multiple of nominal capacity: 1 C empties the cell in one hour, 2 C in thirty minutes. A piece of *metadata* in the battery preset.

### Cycle
One full charge-and-discharge pair. The battery *series* is indexed by cycle rather than wall-clock time.

### Knee (in cycling)
A sharp acceleration in *capacity fade* after an initially gentle decay. The synthesis script injects a knee into roughly a quarter of cells; `kneeCycle` reports its cycle index.

### Cathode chemistry codes
- **NMC811** — LiNi₀.₈Mn₀.₁Co₀.₁O₂; high nickel, high energy density, fades faster.
- **NMC622** — LiNi₀.₆Mn₀.₂Co₀.₂O₂; balanced chemistry.
- **NCA** — LiNi₀.₈Co₀.₁₅Al₀.₀₅O₂; automotive-favoured, sensitive to high *C-rate*.
- **LFP** — LiFePO₄; lower energy density, very long cycle life.

### Capacity fade
Monotonic loss of discharge capacity with *cycle* number. Modelled in the synthesis script as a stretched exponential plus an optional *knee*; summarised per cell by `fadePerCycle` and `cyclesTo80Pct`.

### Stretched exponential
The functional form `C(n) = C₀ · exp(−k · n^α) − β · n` used to model *capacity fade* before any *knee*. The stretching exponent α < 1 gives the early-life plateau; the linear β · n term represents a slow calendar-age drift.

### Rate constant k
The exponential-decay coefficient in the *stretched exponential* fade model. Larger `k` means faster early-life fade; the synthesis script tunes `k` per chemistry and *C-rate* so that high C-rate NCA cells fade visibly faster than 1 C LFP cells.

### Retention
Discharge capacity at a chosen cycle, expressed as a fraction of `C₀`. Computed by `retentionAt(series, cycle)` with nearest-neighbour lookup (no interpolation); the registry currently exposes the fixed-cycle entry `Ret500` (retention at cycle 500).
