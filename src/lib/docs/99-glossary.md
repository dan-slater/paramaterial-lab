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
`rᵢ = ln(pᵢ / pᵢ₋₁)`. Time-additive: the sum over a window is the window's log return. Computed by `logReturns`.

### Sharpe ratio
`(rₐ − rf) / σₐ`, the classical risk-adjusted return. Computed by `sharpeRatio` with a 4 % default *risk-free rate*.

### Beta
Sensitivity of a ticker's returns to a market factor: the OLS slope of its returns on the market's. **Not** in the finance preset: the dataset carries no market series, so β cannot be computed in the tool yet. The finance chapter quotes an outside-the-tool β against the equal-weighted mean return and proposes the covariate schema that would make β an analyzer.

### Max drawdown
Worst peak-to-trough fractional loss over a price path. Computed by `maxDrawdown`, which also returns `(peakIdx, troughIdx)` so the UI can annotate the curve.

### Volatility
Sample standard deviation of daily *log returns*, scaled by √252 to annualise. Computed by `annualizedVolatility`.

### Rolling volatility
Annualised standard deviation of log returns over a moving window (default 21 trading days, centred). Computed per day by `rollingVolatility`; a path, not a scalar, so it has no registry row.

### EWMA volatility
Exponentially weighted volatility, `σ̂²(t) = λ·σ̂²(t−1) + (1 − λ)·r_t²`, annualised by √252. Recent returns weigh more, so it reacts to regime changes within days. Computed per day by `ewmaVolatility`; no registry row.

### RiskMetrics λ
The EWMA decay factor. RiskMetrics (J.P. Morgan, 1996) fixed λ = 0.94 for daily data, the default in `ewmaVolatility`. EWMA is GARCH(1,1) with ω = 0, α = 1 − λ, β = λ.

### Volatility clustering
Large moves tend to follow large moves. Measured by `volClusteringIndex` as the correlation between |r_t| and |r_{t−1}| (registry `VolCluster`); positive for all 40 tickers in the finance preset.

### Risk-free rate
The baseline return subtracted from a ticker's mean return in the *Sharpe ratio* numerator. Fixed at 4 % per year (`riskFreeRate = 0.04` in `sharpeRatio`), a short-dated sovereign proxy rather than a live Treasury quote.

### Sector
The broad sector bucket in `meta.sector` (eight in the preset, e.g. Technology, Energy, Utilities). Used as a colour-by key on the price overlay.

### Skewness
Third standardised moment of daily *log returns*, computed by `skewness` using the Joanes–Gill correction. Negative values indicate a heavier left tail — losses larger than mirror-image gains.

### Excess kurtosis
Fourth standardised moment minus 3, computed by `kurtosis`. Positive values indicate heavier tails than a Gaussian; every ticker in the finance preset is positive (`ExKurt`).

### Geometric Brownian motion (GBM)
The random-walk price model behind the v0.1 synthetic finance preset. The shipped preset is real data; GBM survives only as the reference model that real returns depart from (fat tails, clustering).

## Climate

### Annual mean
Mean daily temperature over the full record. Computed by `annualMean`; the y-axis of the canonical latitude scatter.

### Seasonal amplitude
Half the peak-to-peak swing of the annual cycle. Computed two ways: `seasonalAmplitude` from 12 pseudo-month bin means, and *harmonic amplitude* from the *harmonic fit*. Grows with latitude and *continentality*.

### Trend
Linear slope of temperature over the record, in °C / year. `trendPerYear` fits a plain line and absorbs part of the seasonal cycle; `harmonicTrendPerYear` fits the line jointly with the cycle and is preferred.

### Harmonic fit
The model `T(t) = a + b·t + c·cos(ωt) + d·sin(ωt)` with ω = 2π/365, fitted by OLS in `fitHarmonicTrend`. Gives *harmonic amplitude* `√(c² + d²)` (registry `HarmAmp`), trend `b·365` (`HarmTrend`), *peak day* and R².

### Peak day
The day on which the fitted annual cycle peaks, `(atan2(d, c)/ω) mod 365`, from `fitHarmonicTrend`. Counted on the record's own day index (day 0 is the first day of the window), not the calendar.

### Poleward amplification
The observed tendency for warming to be stronger at high latitudes. Not recoverable from the three-year climate preset: neither trend estimator separates a ~0.1 °C/yr signal from weather noise at that length.

### Summer anomaly
Departure of the summer mean from the full-record mean. Summer is three pseudo-month bins fixed by hemisphere (bins 5–7 for `'N'`, 11, 0, 1 for `'S'`); the bins count from the first day of the record, so they match calendar Jun–Aug / Dec–Feb only for records starting on 1 January. Computed by `summerAnomaly(series, hemisphere)`, which defaults to `'N'` when `meta.hemisphere` is missing.

### Annual range
Spread of the per-year means: split the record into consecutive 365-day years, take each year's mean, return max − min. Computed by `annualRange`; a measure of year-to-year drift, not of the seasonal swing.

### Extreme hot / cold days
Count of days above (below) a threshold, computed by `extremeHotDays(series, threshold)` and `extremeColdDays(series, threshold)`. The climate preset ships `HotDays30` (days > 30 °C) and `ColdDays0` (days < 0 °C) as registry entries.

### Continentality
How far a station is from the moderating influence of the ocean, and so how large its seasonal swing is for its latitude. Not a field in the dataset; the climate chapter uses it to explain why seasonal amplitude correlates only loosely with latitude.

### Altitude
Station elevation in metres, `meta.altitude_m`. Lowers *annual mean* through the lapse rate; metadata, not an analyzer output. Amundsen–Scott carries GHCN's missing-value sentinel (−1000) in the shipped JSON.

### Hemisphere
The `'N'` / `'S'` flag on each climate station's `meta`, used by `summerAnomaly` to decide which bins count as summer. Defaults to `'N'` when missing.

### GHCN-Daily
NOAA's Global Historical Climatology Network — Daily, the public-domain station archive behind the climate preset.

## Battery

### State of health (SoH)
Current discharge capacity divided by initial discharge capacity. *Cycles to 80 % SoH* (`cyclesTo80Pct`) is the usual end-of-life definition.

### C-rate
Current expressed as a multiple of nominal capacity: 1 C fully charges or empties the cell in one hour, 4 C in fifteen minutes. In the battery preset `meta.nominal_c_rate_charge` is the **first-step charge** rate of the fast-charge *policy* (3.6–8 C).

### Charging policy
Severson's two-step fast-charge protocol string, e.g. `5.3C(54%)-4C`: charge at 5.3 C to 54 % state of charge, then at 4 C, followed by a standard discharge. In `meta.policy`; 27 distinct policies in the preset.

### Cycle life
The cycle at which a Severson cell's discharge capacity first falls below 0.88 Ah (80 % of its 1.1 Ah nominal). In `meta.cycle_life` (148–2 237 cycles); the y-axis of the canonical battery scatter.

### Cell group (batch)
Which of Severson's three test batches a cell was cycled in (`meta.cell_group`). Batch shifts cycle life more than C-rate does in this dataset.

### Cycle
One full charge-and-discharge pair. The battery *series* is indexed by cycle rather than wall-clock time; the shipped window is index 0–98, Severson cycles 2–100.

### Knee (in cycling)
A sharp acceleration in *capacity fade* after an initially gentle decay. `kneeCycle` looks for one with a two-segment fit; on the shipped early-life window it flags 18 of 124 cells, which are early slope changes rather than the end-of-life knee.

### Cathode chemistry
`meta.cathode_chemistry`. Every cell in the preset is **LFP** (LiFePO₄ cathode, graphite anode; A123 APR18650M1A): lower energy density than nickel-rich chemistries, very long cycle life.

### Capacity fade
Loss of discharge capacity with *cycle* number, in Ah. Summarised per cell by `fadePerCycle` (Ah/cycle), `cyclesTo80Pct`, and the *stretched exponential* fit.

### Stretched exponential
The fade model `C(n) = C₀ · exp(−k · n^α)`, fitted by `fitStretchedExp` through the log-log linearisation `ln ln(C₀/C(n)) = ln k + α ln n` (closed-form OLS; needs n ≥ 1 and C(n) < C₀). Weak on early-life data where capacity barely moves.

### Fade exponent α
The stretching exponent of the *stretched exponential*, from `fadeExponent` (registry `FadeExp`). α < 1: fade decelerates; α > 1: fade accelerates.

### Rate constant k
The coefficient `k` of the *stretched exponential*, from `fadeRateConstant` (registry `FadeK`), in cycle^(−α). Because its units depend on α, compare k only between cells with similar α.

### Retention
Discharge capacity at a chosen cycle, as a fraction of `C₀`. Computed by `retentionAt(series, cycle)` with nearest-neighbour lookup and no extrapolation; the registry's fixed `Ret500` (retention at cycle 500) is blank on the 99-cycle preset.
