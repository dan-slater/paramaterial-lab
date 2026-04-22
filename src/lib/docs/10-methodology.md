---
title: Methodology reference
slug: methodology
---

# Methodology reference

This chapter is the technical reference for every analyzer function shipped in the web app. Other chapters link into it for formulas, implementation choices, and failure modes. Precision is preferred over pedagogy — the reader is expected to consult the source.

## 1. Shared conventions

> **Note on math rendering.** Formulas in this chapter are rendered as Unicode text inside indented code fences because the docs loader does not currently ship a KaTeX plugin. The content is written in a LaTeX-adjacent style so a future student can swap each block to `$…$` / `$$…$$` once KaTeX is wired up.

### The `Dataset` schema

Every domain loads into a single in-memory `Dataset` type declared in `src/lib/datasets.ts`:

```ts
export interface Test {
    test_id: string;
    meta: Record<string, string | number | boolean | null>;
    strain: number[];
    stress: number[];
}
export interface Dataset {
    id: string;
    name: string;
    description: string;
    info_columns: string[];
    tests: Test[];
    domain?: 'materials' | 'finance' | 'climate' | 'battery' | 'generic';
    x_label?: string;
    y_label?: string;
}
```

### Legacy field names `strain` and `stress`

The field names `strain` and `stress` are historical. Paramaterial grew out of a materials-testing pipeline, so every `Series` still carries a `strain: number[]` and a `stress: number[]` whatever the x- and y-axes actually mean:

| Domain     | `strain`                    | `stress`                        |
|------------|-----------------------------|---------------------------------|
| materials  | ε (strain, dimensionless)   | σ (stress, MPa)                 |
| finance    | trading-day index           | adjusted close price            |
| climate    | day-of-record index         | daily mean temperature (°C)     |
| battery    | cycle number                | discharge capacity (mAh/g)      |

Display labels come from `Dataset.x_label` / `Dataset.y_label`; analyzer code simply operates on `series.strain` (x) and `series.stress` (y).

### Series, analyzer, tool

- A **series** is an array of (x, y) pairs with metadata — a single `Test`.
- An **analyzer** is a pure function `series → scalar` (or small record). Deterministic, side-effect-free, tolerant of noisy input.
- A **tool** composes analyzers with a scatter to make parameter-vs-parameter plots. The `ParameterDef[]` registry ([section 6](#6-analyzer-registry)) is how tools discover analyzers.

### Units and numerical conventions

Units live in `ParameterDef.unit` strings only; analyzers operate on whatever numbers the builder script produced. Materials: MPa and dimensionless strain. Finance: raw adjusted closes with a hard-coded 252-trading-day year. Climate: °C on a 365-day year (leap days ignored). Battery: mAh/g with integer cycle numbers.

There is **no sparse handling** — every series is a dense array. Missing samples are `NaN` and are silently skipped inside each analyzer (finance is stricter and assumes no gaps). NaN/Inf propagate unless explicitly filtered with `Number.isFinite`. Out-of-range interpolation returns `NaN` rather than clamping. The registry wraps every extractor in `safe(...)` which converts exceptions and non-finite outputs to `null`.

## 2. Materials analyzers

All live in `src/lib/processing.ts`. They operate on a `Curve = { strain: number[]; stress: number[] }`.

### `findUTS`

```ts
export function findUTS(c: Curve): { UTS: number; idx: number; strainAtUTS: number }
```

Ultimate tensile strength is the largest σ in the record:

    UTS = max_i σ_i,   idx = argmax_i σ_i

Single linear scan, first-occurrence on ties. No smoothing: a noise spike beats a smoother plateau. Returns `-Infinity` if empty. Used as parameter `UTS` in the scatter tool and by `fitRambergOsgood` as the plastic-window upper bound.

### `findUplLpl`

```ts
export function findUplLpl(
    c: Curve,
    opts?: { windowFraction?: number; toleranceMPa?: number }
): FootCorrection
```

Locates the upper/lower proportional limits by sliding-window OLS. For each window of width `w = max(5, floor(windowFraction · N))`, `linfit` returns slope, intercept, R². Of the windows clearing the R² threshold the one with **maximum slope** wins — the steepest well-fitting segment is the genuine elastic line; shallower high-R² segments are post-yield tangents. If none clear the threshold, the highest-R² window is used.

Defaults: `windowFraction = 0.1` and `toleranceMPa = 0.995` (the name is misleading — the threshold is a dimensionless R², not an MPa tolerance). **Both are tuneable**; the 10 % window in particular trades statistical stability for resolution.

Returns `{ uplIdx, lplIdx, E, intercept, strainShift }` where `strainShift = −intercept / E` zeroes a curve with a toe. With fewer than `w` samples `best` remains `null` and the non-null assertion throws. Used by the `E`/`ProofStress` extractors and by `fitRambergOsgood`.

### `findE`

```ts
export function findE(c: Curve, upl: number, lpl: number): { E: number; intercept: number }
```

Plain OLS slope through `[min(upl, lpl), max(upl, lpl) + 1)`. Useful when the caller wants to override the `findUplLpl` window. No R² is returned — call `linfit` directly if you need it. Silently returns slope = 0 if `N·Σx² − (Σx)²` is zero.

### `findProofStress`

```ts
export function findProofStress(
    c: Curve, E: number, offset: number = 0.002
): { proofStress: number; idx: number; strainAtPS: number }
```

The 0.2 %-offset proof stress: intersection of the curve with the elastic line shifted by `offset`, i.e.

    σ_ps   such that   σ(ε) = E · (ε − offset)

Sign-change test on `diff_i = σ_i − E·(ε_i − offset)`. Every zero crossing updates `lastCross`, so the **last** crossing wins — matters for non-monotonic curves where the elastic line re-enters the data after yielding. A linear intersection between samples `[cut, cut+1]` and the elastic line gives exact (ε*, σ*). Returns `NaN` if no crossing exists or the segment slope equals `E`. Used via the `ProofStress` registry entry and by `fitRambergOsgood`.

### `computeRepresentative`

```ts
export function computeRepresentative(
    tests: Array<{ meta: Record<string, unknown>; strain: number[]; stress: number[] }>,
    groupBy: string[],
    nPoints: number = 200
): RepresentativeCurve[]
```

Groups tests by the `|`-joined concatenation of `groupBy` metadata fields. For each group: (1) take the **intersection** of per-test strain ranges as `[lo, hi]` (lo = max of mins, hi = min of maxes) — guarantees every member has data across the grid, discarding the tails of longer tests; (2) linearly space `nPoints` samples (default 200, tuneable) from lo to hi; (3) resample each member via `interpOntoGrid` (which sorts by x and returns NaN out of range); (4) at each grid point compute mean, std (population-style, `E[X²] − E[X]²` clamped at zero), min, max across members, skipping non-finite values.

Groups with empty intersection (`hi ≤ lo`) emit empty arrays with `n = members.length`. Output is sorted numerically when all keys parse as numbers, otherwise lexicographically. Used by the representative-curve block and the CS1/CS2 studies.

### `fitRambergOsgood`

```ts
export function fitRambergOsgood(c: Curve, proofStrain: number = 0.002): RambergOsgoodFit
```

Power-law fit σ = C · ε^n across the plastic region (Ramberg–Osgood, NACA TN 902, 1943). Lower bound is the proof strain from `findProofStress` (with `findUplLpl` supplying E); upper bound is the UTS index from `findUTS`. If either helper throws, the lower bound falls back to `proofStrain`. OLS runs on `(ln ε, ln σ)` for samples with ε > 0 and σ > 0. The slope is n, `exp(intercept)` is C, R² comes directly from `linfit`. Fewer than three valid points returns NaNs. Used by the CS1 tool to plot n-vs-temperature and C-vs-temperature.

### `computeZH`

```ts
export function computeZH(
    tests: ...,
    opts: { Q_kJmol?: number; flowStrain?: number }
): ZhRegression | null
```

Zener–Hollomon regression (Zener & Hollomon, J. Appl. Phys. 15, 1944). For each test with both a strain rate ε̇ and a temperature T the code forms

    Z = ε̇ · exp(Q / (R · T_K)),   T_K = T_°C + 273.15

with Q in J/mol (`opts.Q_kJmol`, default 155 kJ/mol — typical for hot aluminium, tuneable per material), R = 8.314 J/mol·K. Flow stress is the linearly interpolated σ at `opts.flowStrain` (default 0.3) via `flowStressAt`. OLS on `ln σ = a · ln Z + b` gives `a = 1/n_ZH` in the usual formulation. Tests missing rate, temperature, or a reachable `flowStrain` are dropped; fewer than two survivors returns `null`. Used by CS3 / CS4.

### `flowStressAt`

```ts
export function flowStressAt(c: Curve, targetStrain: number): number | null
```

Linear interpolation of σ at a given ε. Sorts by strain first to tolerate non-monotonic input (e.g. unloading segments). Returns `null` outside `[min ε, max ε]` or for fewer than two samples. No extrapolation. Called from `computeZH` and the flow-stress tools.

## 3. Finance analyzers

All in `src/lib/analyzers/finance.ts`. The convention is `series.stress = price`, `series.strain = trading-day index`. The constant `TRADING_DAYS = 252` is hard-coded and used for every annualisation.

### `logReturns`

```ts
export function logReturns(series: Series): number[]
```

Daily log returns `r_t = ln(p_t / p_{t-1})`, returned as a length-(N−1) array. No gap handling — missing days would produce spurious jumps — so the builder script must drop non-trading days. Used internally by volatility, skewness, kurtosis.

### `annualizedReturn`

```ts
export function annualizedReturn(series: Series): number
```

Compound annual growth rate:

    CAGR = exp(ln(p_{N-1} / p_0) / years) − 1,   years = (N − 1) / 252

Returns 0 for series of length < 2. Uses total log return over the window (equivalent to `mean(log_returns) · 252` up to a geometric/arithmetic discrepancy). Registered as `AnnReturn`.

### `annualizedVolatility`

```ts
export function annualizedVolatility(series: Series): number
```

Sample-std of daily log returns scaled by √252:

    σ_ann = std(r) · √252

Uses the sample estimator (divisor N − 1). Registered as `AnnVol`.

### `sharpeRatio`

```ts
export function sharpeRatio(series: Series, riskFreeRate = 0.04): number
```

Annualised Sharpe ratio (Sharpe 1966 / 1994):

    S = (r_ann − r_f) / σ_ann

Default `riskFreeRate = 0.04` (a tuneable parameter; nominal USD rate for the synthetic dataset's era). Returns 0 if volatility is zero. Registered as `Sharpe`.

### `maxDrawdown`

```ts
export function maxDrawdown(series: Series): { drawdown: number; peakIdx: number; troughIdx: number }
```

Single forward pass tracking the running peak and the maximum peak-to-trough fractional drop:

    DD_i = (peak_i − p_i) / peak_i,   MDD = max_i DD_i

Returns the indices of the running peak and the trough at which MDD was attained. Edge cases: empty input yields `p[0] = undefined` and NaN arithmetic — callers are expected to guard. Registered as `MaxDD`.

### `skewness`

```ts
export function skewness(series: Series): number
```

Sample skewness of daily log returns using the bias-corrected G1 estimator (Joanes & Gill 1998):

    G1 = n / ((n−1)(n−2)) · Σ ((r_i − μ) / σ)^3

Returns 0 for n < 3 or zero σ. Registered as `Skew`.

### `kurtosis`

```ts
export function kurtosis(series: Series): number
```

Sample excess kurtosis, also Joanes–Gill / SAS G2:

    G2 = [n(n+1) / ((n−1)(n−2)(n−3))] · Σ ((r_i − μ) / σ)^4  −  3(n−1)² / ((n−2)(n−3))

Returns 0 for n < 4. Note the registry label is `ExKurt`; this is already the excess (subtract-3) form, not raw kurtosis.

## 4. Climate analyzers

All in `src/lib/analyzers/climate.ts`. Convention: `strain` is day-of-record index, `stress` is daily mean temperature in °C. `DAYS_PER_YEAR = 365` — leap days ignored, a deliberate simplification that biases sub-day effects but is fine at the annual aggregation level.

### `annualMean`

Arithmetic mean of all daily temperatures. Returns `NaN` on empty input.

### `annualRange`

Slice the record into consecutive 365-day years (trailing partial year discarded), compute each year's mean, return `max − min`. Requires ≥ 1 complete year; returns 0 otherwise.

### `seasonalAmplitude`

For each complete year, split into 12 pseudo-months of `floor(m · 365/12)` boundaries, take monthly means, and record `(max − min) / 2`. Return the mean amplitude across years. The pseudo-month boundaries are tuneable — a calendar-accurate alternative would replace them with actual month-length lookups, but the current approximation gives month lengths of 30 or 31 days and matches the analysis resolution.

### `trendPerYear`

OLS slope of (day-index, temperature), multiplied by 365 to convert °C/day to °C/year. Uses the covariance/variance closed form rather than `linfit` from `processing.ts` — identical mathematically, duplicated here to keep domains decoupled. Returns 0 if the denominator is zero (constant x) or n < 2.

### `summerAnomaly`

```ts
export function summerAnomaly(series: ClimateSeries, hemisphere: 'N' | 'S'): number
```

Mean temperature across the three summer months minus the overall annual mean. Summer months are months 5–7 (Jun–Aug) for N hemisphere and months 11, 0, 1 (Dec–Feb) for S hemisphere. Month boundaries use the same pseudo-month scheme as `seasonalAmplitude`. Registered with `hemisphere` pulled from test metadata (`meta.hemisphere`), defaulting to `'N'` if the key is missing.

### `extremeHotDays` / `extremeColdDays`

```ts
export function extremeHotDays(series: ClimateSeries, threshold: number): number
export function extremeColdDays(series: ClimateSeries, threshold: number): number
```

Straight counts of days with `T > threshold` (hot) or `T < threshold` (cold). Registered with thresholds 30 °C and 0 °C respectively — the two classical public-health and agronomy cut-offs. Thresholds are tuneable by changing the registry entry.

## 5. Battery analyzers

All in `src/lib/analyzers/battery.ts`. Convention: `strain` is the cycle number, `stress` is discharge capacity (mAh/g). The helper `isNum` gates every read so NaN/Inf/non-number entries are skipped rather than propagated.

### `initialCapacity`

Mean of the first up-to-three finite capacities in the record. Averaging reduces noise from conditioning cycles; the hard-coded 3 is a tuneable parameter.

### `currentCapacity`

Most recent finite capacity (reverse linear scan until a numeric entry is found). Returns 0 if every entry is non-finite.

### `fadePerCycle`

    fade = (C_first − C_last) / (cycle_last − cycle_first)

Returns 0 if only one finite sample exists or if the x-range is zero. Positive for normal (fading) batteries, negative if capacity has net increased. Registered in mAh/g·cycle.

### `cyclesTo80Pct`

First cycle index whose finite capacity drops below `0.8 · C_0`, where `C_0` comes from `initialCapacity`. Returns `null` if no sample satisfies the condition or `C_0 = 0`. Registered as `Cyc80`.

### `kneeCycle`

Piecewise-linear change-point detector for accelerated-fade onset. Filters to finite samples, requires ≥ 20. Searches breakpoints `k ∈ [minSeg, n − minSeg)` with `minSeg = max(5, floor(0.1·n))`; each candidate is scored by the summed SSE of OLS fits on `[0, k)` and `[k, n)`. Stride is `max(1, floor(n/100))` — about 100 candidates regardless of record length. **The 10 % minimum segment, the ~1 % stride, and the knee-sharpness factor (below) are all tuneable.**

Acceptance: both segment slopes must be negative and `|s₂| ≥ 2|s₁|`; otherwise returns `null`.

### `retentionAt`

```ts
export function retentionAt(series: Series, cycle: number): number
```

Nearest-neighbour lookup: find the finite sample with `x_i` closest to the target `cycle`, return `y_i / C_0`. Does **not** interpolate — for retention curves this matters less than it does for flow stress, but if cycles are sparse it can introduce 1–2 % error. Registered with `cycle = 500` as `Ret500`. Returns 0 if `C_0 = 0` or no finite sample exists.

## 6. Analyzer registry

`src/lib/analyzers/registry.ts` exposes a `ParameterDef` type and one `ParameterDef[]` per domain, plus a dispatcher `getParameterDefs(domain)`:

```ts
export interface ParameterDef {
    key: string;
    label: string;
    unit?: string;
    extract: (s: Series, meta?: Record<string, unknown>) => number | null;
}
```

Each entry wraps its analyzer call in `safe(...)`, which coerces thrown exceptions and non-finite results to `null` so the UI can render them as "—" without special casing. The `meta` second argument is how per-test parameters (like hemisphere) reach analyzers that need them; most entries ignore it.

To surface a new analyzer, append a `ParameterDef` to the appropriate array. To surface a new *domain*, add an array and a case in `getParameterDefs`. The scatter-plot tool consumes `getParameterDefs(dataset.domain)` directly — no per-component plumbing is needed.

## 7. How to add a new domain

1. **Builder script.** Emit a JSON file at `static/data/<id>.json` conforming to `Dataset` ([section 1](#1-shared-conventions)). Each `Test` needs `test_id`, `meta`, `strain`, `stress`; `info_columns` lists which `meta` keys the UI should show. Include the `domain` discriminator.
2. **Analyzers.** Implement domain-specific analyzers in `src/lib/analyzers/<domain>.ts`. Keep them pure, tolerate NaNs, return scalars or small records, and prefer sample (unbiased) estimators. Duplicate small helpers like `mean` rather than cross-importing from other domains — this keeps the files independent and easy to delete.
3. **Registry.** In `src/lib/analyzers/registry.ts`, import your module, build a `ParameterDef[]` array, and extend the `switch` in `getParameterDefs`. Pick stable `key` strings (they end up in URLs and CSV exports) and include `unit` where applicable.
4. **Preset.** Add a `DatasetInfo` entry to `PRESET_DATASETS` in `src/lib/datasets.ts` with the new `id`, a `domain`, and a short description. The dataset picker will pick it up automatically.

The scatter tool and plotting components are domain-agnostic — they react to `Dataset.domain` and the registry output. Bespoke case-study blocks (as materials has for CS1–CS4) go in `src/lib/blocks/`.

## References

- Ramberg, W. & Osgood, W. R. (1943). *Description of stress-strain curves by three parameters.* NACA Technical Note 902.
- Zener, C. & Hollomon, J. H. (1944). Effect of strain rate upon plastic flow of steel. *Journal of Applied Physics* 15, 22–32.
- Sharpe, W. F. (1966). Mutual fund performance. *Journal of Business* 39(1), 119–138.
- Joanes, D. N. & Gill, C. A. (1998). Comparing measures of sample skewness and kurtosis. *Journal of the Royal Statistical Society: Series D* 47(1), 183–189.
- Severson, K. A., Attia, P. M., Jin, N., Perkins, N., Jiang, B., Yang, Z., Chen, M. H., Aykol, M., Herring, P. K., Fraggedakis, D., Bazant, M. Z., Harris, S. J., Chueh, W. C. & Braatz, R. D. (2019). Data-driven prediction of battery cycle life before capacity degradation. *Nature Energy* 4, 383–391.
- Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E. & Houston, T. G. (2012). An overview of the Global Historical Climatology Network-Daily database. *Journal of Atmospheric and Oceanic Technology* 29, 897–910.
