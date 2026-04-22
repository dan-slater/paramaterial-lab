---
title: Climate — daily temperature records
slug: climate
---

# Climate — daily temperature records

## From specimens to stations

The materials workflow that motivates paramaterial has three moves: load a series, reduce each series to a few parameters, then scatter the parameters against each other or against a test condition. A specimen produces a stress–strain curve; that curve collapses to a yield stress; yield stresses from many specimens scatter against temperature and reveal a softening law. The same three moves work on climate data if we agree on the analogy. A **station** plays the role of a specimen. A multi-year **temperature record** plays the role of a stress–strain curve. An **annual mean** plays the role of yield stress. And **latitude** — the station's global coordinate — plays the role of the environmental condition used as the x-axis.

The research question this chapter answers is one that every introductory climate textbook answers qualitatively: *how much of the variation in a station's climate character is explained by its latitude, altitude, and hemisphere?* With the paramaterial tool, the question becomes quantitative with a single dataset and three blocks. We load a synthetic but physically-motivated catalog of stations, reduce each record to interpretable parameters (annual mean, seasonal amplitude, linear trend), and scatter those parameters against station geography. The relationships that emerge — latitudinal temperature gradient, amplification of seasonality away from the equator, and poleward amplification of warming — are the textbook facts, recovered from code, plotted in the browser.

## Dataset provenance

The dataset distributed with the tool is now **real observational data**, not synthetic. The previous release shipped a seeded pseudo-random generator in `scripts/build-climate.mjs`; that file has been replaced by a fetcher that downloads per-station CSV archives from NOAA's Global Historical Climatology Network — Daily (GHCN-Daily) and assembles a three-year window of daily mean temperature into the same `Dataset` schema the tool's other presets use.

The canonical reference for GHCN-Daily is Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E., & Houston, T. G. (2012). An overview of the Global Historical Climatology Network-Daily database. *Journal of Atmospheric and Oceanic Technology* 29(7), 897–910. DOI: [10.1175/JTECH-D-11-00103.1](https://doi.org/10.1175/JTECH-D-11-00103.1). GHCN-Daily is the station-level archive that underpins most reanalysis products and the majority of observational-temperature papers; using it here means the climate preset is on the same empirical footing as the literature the student will read next. The archive is US federal data and is distributed in the **public domain** with no licence restriction, which is why the build script can fetch individual stations anonymously from `https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/<STATION>.csv.gz`.

The preset contains **~30 stations** (retained out of 38 hand-picked GHCN-Daily IDs; 8 were dropped for low coverage in the chosen window — notably Moscow, Paris Montsouris, Rio/Manaus, and Cairo, whose archive entries either retired before 2022 or drop below the 95% coverage floor). Retained stations span from Amundsen-Scott at −90° to Reykjavík at +64°, roughly 154° of latitude, and cover five coarse climate zones: polar (Amundsen-Scott, Yakutsk), continental (Minneapolis, Anchorage, Helsinki), temperate maritime (London, Vancouver, San Francisco), arid subtropical (Phoenix, Madrid, Helwan/Cairo), and tropical (Singapore, Chennai, Guangzhou). Each station is indexed on the same 1 095-day axis (`strain` = 0…1094) so that cross-station slicing by day index remains unambiguous, and the window's absolute calendar bounds are stored in `provenance.window` in the JSON.

The element used is `TAVG` — GHCN's daily mean temperature, reported in tenths of °C, divided by ten and rounded to 0.1 °C on output. Missing days are linearly interpolated across gaps of ≤7 days; stations with <95% coverage post-interpolation are dropped. **QC caveat:** `TAVG` is not always a directly-measured 24-hour average. Some networks report it as `(TMAX + TMIN)/2` — the build script falls back to that construction on days when `TAVG` is absent but `TMAX` and `TMIN` are both present, and records the per-station fraction as `meta.tavg_derived_pct`. The two definitions agree to within a few tenths of a degree on monthly and annual means but give `(TMAX+TMIN)/2` slightly higher day-to-day variance and a small positive bias under strong diurnal asymmetry (e.g., clear desert nights). This affects noise characteristics of `trendPerYear` and extreme-day counts, not annual means or seasonal amplitudes at the aggregate level.

> **[STALE v0.1]** The three headline correlations quoted in the **Recoverable relationships** section below — `corr(annual_mean, |lat|) ≈ −0.87`, `corr(seasonal_amplitude, |lat|) ≈ +0.96`, and `corr(trendPerYear, |lat|) ≈ +0.29` — were computed on the previous **synthetic** dataset (seeded mulberry32, 41 stations with a hard-coded amplitude-vs-latitude law). They need to be re-run against the GHCN-Daily build and refreshed. Expect the annual-mean/latitude correlation to remain strongly negative but somewhat noisier (roughly −0.85 in a preliminary run), the seasonal-amplitude/latitude correlation to drop below +0.96 because real continentality is not perfectly collinear with |lat|, and the trend/|lat| correlation to be dominated by weather noise on a three-year window. All downstream claims that cite these numbers should be treated as STALE until the smoke-check output in `scripts/build-climate.mjs` is incorporated into the chapter.

## The analyzers

All analyzers live in `src/lib/analyzers/climate.ts` and operate on a `ClimateSeries` with `strain` (day index 0…N−1) and `stress` (°C).

**`annualMean(series)`** returns the arithmetic mean of `stress` over the whole record, `(1/N)·Σ yᵢ`. Units °C. This is the simplest possible climatology.

**`annualRange(series)`** computes per-calendar-year means `ȳ_k` and returns `max_k ȳ_k − min_k ȳ_k`. Returns 0 if fewer than one full year is present. It captures year-to-year drift — for a record with a linear trend of `β` °C/yr, `annualRange` is approximately `β·(Y−1)` on `Y` years, since each year's mean increments by `β`.

**`seasonalAmplitude(series)`** splits each calendar year into 12 approximately equal monthly bins (using `floor(m·365/12)` boundaries), takes the month-means, computes `(max − min)/2`, and averages these half-ranges over whole years. Units °C. This is the analyzer most directly tied to the generator's `amplitude` parameter.

**`trendPerYear(series)`** fits an ordinary least-squares line to `(dayIndex, temp)`, then multiplies the per-day slope by 365 to report °C/yr:

```
slope_day = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²
trend     = slope_day · 365
```

With the seasonal cycle centred on the mid-year phase used by the generator, the cycle is nearly orthogonal to a linear fit over an integer number of years, so it contributes little bias — only noise inflation.

**`summerAnomaly(series, hemisphere)`** computes the mean over summer months minus the annual mean. Summer is months `[5, 6, 7]` (Jun–Aug) for `N` and `[11, 0, 1]` (Dec–Feb) for `S`, using the same month-boundary convention as `seasonalAmplitude`. Units °C. It should approximately recover the generator's `amplitude` (since summer is the peak of a cosine) weighted by the summer window.

**`extremeHotDays(series, threshold)`** and **`extremeColdDays(series, threshold)`** simply count days above or below a user-chosen °C threshold. Because noise scales with continentality, two stations with the same annual mean can produce very different extreme-day counts — a point worth exploring in the scatter block.

## Recoverable relationships

Running the build script's embedded smoke check over all 41 stations produces three headline correlations. These are the numbers the student should expect and that the tool will reproduce on click.

**`corr(annual_mean, |lat|) ≈ −0.87`** `[STALE v0.1]`**.** This is the latitudinal temperature gradient. Colder toward the poles, warmer at the equator. The correlation is not quite −1 because altitude contributes an independent slice of variance (`LHASA-CHN`, `LAPAZ-BOL`, and `QUITO-ECU` are equatorial but cold) and because the `arid` boost lifts subtropical desert stations.

**`corr(seasonal_amplitude, |lat|) ≈ +0.96`** `[STALE v0.1]`**.** This is the strongest signal in the dataset. Equatorial stations have essentially no seasonal cycle — the cosine amplitude is close to 1 °C and is swamped by the 2–4 °C daily noise. Continental high-latitude stations swing through 20–25 °C between winter and summer. The correlation approaches +1 because the generator makes amplitude an explicit linear function of `|lat|`, with continentality adding a second positive term that itself tends to be higher at high latitudes in the catalog.

**`corr(trendPerYear, |lat|) ≈ +0.29`** `[STALE v0.1]`**.** This is the poleward-amplification signal: polar stations warm faster than tropical stations. The correlation is modest — not because the generator's trend slope is weak (it ranges from 0.02 to 0.15 °C/yr), but because three years of daily data with seasonal plus Gaussian residual variance of order (18 °C)² gives an OLS slope with a standard error on the order of `σ_resid/√(N·(N²−1)/12)/365 ≈ 0.6` °C/yr per station. Individual station trend estimates are therefore dominated by noise; only by pooling across many stations does the population-level correlation appear. The lesson — that a true signal of magnitude 0.1 °C/yr is unrecoverable from a single short record but detectable across a cross-section of records — is itself one of the useful takeaways of the exercise.

## Reproducing in the web tool

![Annual mean vs latitude (climate preset)](/docs-img/climate-scatter.png)

In the live app:

```
Preset: climate
Blocks:
  1. Stress–strain  (color by: latitude)
  2. Parameters     (annualMean, seasonalAmplitude, trendPerYear)
  3. Parameter scatter  (Y = annual_mean, X = latitude)
```

The raw-temperature block shows 41 overplotted curves spanning 1 095 days, each coloured by latitude with the `plasma` gradient (dark at the poles, bright at the equator). Three full seasonal oscillations are immediately visible on the high-latitude curves; the equatorial curves are nearly flat noisy bands. The `PHOENIX-USA` trace carries a sharp positive spike near day 600 and the `YELLOWKNIFE-CAN` trace a sharp negative spike near day 900 — two diagnostic injections that confirm the generator.

The scatter block plots annual mean against latitude as a signed coordinate. The result is an **inverted V**: warmest around the equator, falling off approximately linearly toward both poles, with the Northern arm a touch warmer than the Southern at matched |lat| because the catalog is not perfectly hemisphere-symmetric. Swapping the X-axis to `|latitude|` collapses the V into a single descending line with `r ≈ −0.87`. Swapping the Y-axis to `seasonalAmplitude` and the X to `|latitude|` shows the tightest relationship in the dataset, `r ≈ +0.96`.

## Limitations and extensions

**Known planted signals.** Two anomalies visible in the raw-temperature plot are injected by the generator and are therefore diagnostic rather than emergent: the `PHOENIX-USA` heat-dome spike (day 600, +10 °C, 15 days) and the `YELLOWKNIFE-CAN` polar-vortex dip (day 900, −15 °C, 15 days). Seeing these recover confirms the pipeline is wired correctly; they should not be read as discoveries or as evidence of any modelled extreme-event physics.

The dataset is pedagogical. Specific limitations:

- **No inter-station correlation.** Because each station's noise is independently drawn, there are no teleconnections. A student cannot study ENSO, NAO, PDO, or any coherent mode of variability by subsetting this dataset.
- **No precipitation, humidity, or wind.** Only temperature is encoded, so Köppen-style classification cannot be recovered from the record itself; the `climate_zone` field is assigned by the generator from latitude and altitude, not inferred.
- **No latitude-modulated lapse rate.** The altitude correction is a single global 6.5 °C km⁻¹, so tropical highlands and mid-latitude highlands are treated equivalently.
- **Short record.** Three years is too short to beat down seasonal and weather noise in a per-station trend estimate.
- **No measurement noise model.** All "noise" is climatic; there is no sensor bias, no station-move step-change, no missing-data pattern.

Concrete extensions a student could implement:

1. Add an AR(1) noise term so daily residuals are serially correlated — this would change the effective sample size for the trend fit and make `trendPerYear` error bars larger and more realistic.
2. Introduce a shared ENSO-like latent factor that modulates a subset of tropical-Pacific stations in phase; then scatter inter-station correlation against great-circle distance.
3. Extend the record to 30 years so that `trendPerYear` becomes individually significant at most stations and poleward amplification shows up as a strong correlation rather than a weak one.
4. Add a `precipitation` channel coupled to temperature via a Clausius–Clapeyron scaling, enabling a second set of parameters (annual total, wet-day count, dry-spell length).
5. Replace the hemisphere-symmetric seasonality with an asymmetric cycle that has a sharper winter and softer summer (a truncated Fourier series), and verify that `seasonalAmplitude` and `summerAnomaly` diverge as expected.

## Mapping back to materials

The isomorphism is exact enough to be useful. **A specimen is a station.** A tensile test, with its thousands of sampled points, is a year of daily temperature. The parameter a materials scientist extracts from the curve — yield stress, ultimate tensile strength, work-hardening exponent — is the annual mean, the seasonal amplitude, or the trend slope. The test condition recorded in the specimen metadata (temperature, strain rate, lot) is the station's latitude, altitude, and hemisphere. And the scatter that closes the workflow — yield stress versus test temperature, revealing the softening law of an alloy — is annual mean versus latitude, revealing the latitudinal temperature gradient.

This matters because the same code path, the same three-block flow, and the same parameter-vs-condition scatter work without modification. The dataset schema is identical (`strain`, `stress`, `meta`); only the labels differ. If a student can read a materials softening curve, they can read the climate scatter; and the generality of the workflow is precisely what the tool is built to demonstrate.

## References

- Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E. & Houston, T. G. (2012). An overview of the Global Historical Climatology Network-Daily database. *J Atmos Ocean Tech* 29, 897–910. (GHCN-Daily — the reference dataset the synthetic version is shaped after.)
- Screen, J. A. & Simmonds, I. (2010). The central role of diminishing sea ice in recent Arctic temperature amplification. *Nature* 464, 1334–1337. (Poleward amplification.)
- Hersbach, H. et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society* 146, 1999–2049. (Reanalysis product named in §"Dataset provenance".)
- Wallace, J. M. & Hobbs, P. V. (2006). *Atmospheric Science: An Introductory Survey*, 2nd ed. Academic Press. (Seasonal-cycle and latitudinal-gradient physics.)
