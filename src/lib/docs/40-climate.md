---
title: Climate — daily temperature records
slug: climate
---

# Climate — daily temperature records

## From specimens to stations

The materials workflow that motivates paramaterial has three moves: load a series, reduce each series to a few parameters, then scatter the parameters against each other or against a test condition. A specimen produces a stress–strain curve; that curve collapses to a yield stress; yield stresses from many specimens scatter against temperature and reveal a softening law. The same three moves work on climate data if we agree on the analogy. A **station** plays the role of a specimen. A multi-year **temperature record** plays the role of a stress–strain curve. An **annual mean** plays the role of yield stress. And **latitude** — the station's global coordinate — plays the role of the environmental condition used as the x-axis.

The research question this chapter answers is one that every introductory climate textbook answers qualitatively: *how much of the variation in a station's climate character is explained by its latitude?* With the paramaterial tool, the question becomes quantitative with a single dataset and three blocks. We load three years of real daily temperature from 30 weather stations, reduce each record to interpretable parameters (annual mean, seasonal amplitude, trend), and scatter those parameters against station geography. The latitudinal temperature gradient comes out cleanly. The amplification of seasonality away from the equator comes out only partly, because real coastlines get in the way. Poleward amplification of warming does not come out at all on a three-year record, and the chapter shows why.

## Dataset provenance

The dataset distributed with the tool is **real observational data**, not synthetic. The v0.1 release shipped a seeded pseudo-random generator in `scripts/build-climate.mjs`; that file has been replaced by a fetcher that downloads per-station CSV archives from NOAA's Global Historical Climatology Network — Daily (GHCN-Daily) and assembles a three-year window of daily mean temperature into the same `Dataset` schema the tool's other presets use.

The canonical reference for GHCN-Daily is Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E., & Houston, T. G. (2012). An overview of the Global Historical Climatology Network-Daily database. *Journal of Atmospheric and Oceanic Technology* 29(7), 897–910. DOI: [10.1175/JTECH-D-11-00103.1](https://doi.org/10.1175/JTECH-D-11-00103.1). GHCN-Daily is the station-level archive that underpins most reanalysis products and the majority of observational-temperature papers; using it here means the climate preset is on the same empirical footing as the literature the student will read next. The archive is US federal data and is distributed in the **public domain** with no licence restriction, which is why the build script can fetch individual stations anonymously from `https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/<STATION>.csv.gz`.

The preset contains **30 stations**, retained out of 41 hand-picked GHCN-Daily IDs. The other 11 fell below the 95 % coverage floor in the window, and the JSON lists each one under `provenance.dropped_stations`: Montréal, Stockholm, Paris, Moscow, Manaus, Rio de Janeiro, Nairobi, Cairo, two Jakarta IDs, and Brasília. Six of the 30 retained stations are in the Southern Hemisphere, and 19 countries are represented. Latitudes run from Amundsen–Scott at −90° to Reykjavík at +64.1°. Coarsely, the set covers polar (Amundsen–Scott, Yakutsk), continental (Minneapolis, Anchorage, Helsinki, Beijing), temperate maritime (London Heathrow, Lerwick, Vancouver, San Francisco, Reykjavík), arid and semi-arid subtropical (Phoenix, Madrid, New Delhi), and tropical (Singapore, Chennai, Guangzhou) stations. Each station is indexed on the same 1 095-day axis (`strain` = 0…1094), and the window's calendar bounds (2022-08-22 → 2025-08-20) are stored in `provenance.window` in the JSON.

The element used is `TAVG`, GHCN's daily mean temperature, reported in tenths of °C, divided by ten and rounded to 0.1 °C on output. Missing days are linearly interpolated across gaps of ≤7 days; stations with <95 % coverage post-interpolation are dropped. **QC caveat:** `TAVG` is not always a directly-measured 24-hour average, and some stations do not report it at all. The build script falls back to `(TMAX + TMIN)/2` on days when `TAVG` is absent but `TMAX` and `TMIN` are both present, and records the per-station fraction as `meta.tavg_derived_pct`. On this build, eight stations are 100 % derived (the seven US stations and Berlin–Tempelhof); the rest are at or near 0 %. The two definitions agree to within a few tenths of a degree on monthly and annual means, but `(TMAX+TMIN)/2` has slightly higher day-to-day variance and a small positive bias under strong diurnal asymmetry (e.g., clear desert nights). This affects the noise in trends and extreme-day counts, not annual means or seasonal amplitudes at the aggregate level.

**Metadata caveat.** `altitude_m` for Amundsen–Scott is −1000 in the shipped JSON. That is GHCN's −999.9 "unknown elevation" sentinel, rounded; the station actually sits at about 2 835 m. The builder now writes `null` for the sentinel, so the next rebuild fixes it. Until then, drop that station from any altitude scatter.

All numbers in this chapter are computed by `node scripts/chapter-numbers.mjs` from the shipped `static/data/climate.json`. Correlations against |latitude| are computed there, because the UI has no |latitude| field (see Limitations).

## The analyzers

All analyzers live in `src/lib/analyzers/climate.ts` and operate on a `ClimateSeries` with `strain` (day index 0…N−1) and `stress` (°C).

**`annualMean(series)`** returns the arithmetic mean of `stress` over the whole record, `(1/N)·Σ yᵢ`. Units °C. This is the simplest possible climatology.

**`annualRange(series)`** computes per-calendar-year means `ȳ_k` and returns `max_k ȳ_k − min_k ȳ_k`. Returns 0 if fewer than one full year is present. It captures year-to-year drift — for a record with a linear trend of `β` °C/yr, `annualRange` is approximately `β·(Y−1)` on `Y` years, since each year's mean increments by `β`.

**`seasonalAmplitude(series)`** splits each 365-day year of the record into 12 approximately equal "months" (using `floor(m·365/12)` boundaries), takes the month-means, computes `(max − min)/2`, and averages these half-ranges over whole years. Units °C. The bins are counted from the first day of the record, not from 1 January, so they are pseudo-months; the half-range is unaffected. On this preset it runs from 1.3 °C (Singapore) to 29.3 °C (Yakutsk).

**`trendPerYear(series)`** fits an ordinary least-squares line to `(dayIndex, temp)`, then multiplies the per-day slope by 365 to report °C/yr:

```
slope_day = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²
trend     = slope_day · 365
```

This estimator is **contaminated by the seasonal cycle**. A sinusoid over a whole number of years is not orthogonal to a straight line unless its phase happens to be right, and the window here starts in late August. On the shipped data the plain OLS trend has a median of +0.84 °C/yr and a maximum of +4.5 °C/yr (Yakutsk, the station with the largest seasonal swing), and it correlates with harmonic amplitude at r = +0.76. Those are not warming rates; they are the seasonal cycle leaking into the slope. Use `harmonicTrendPerYear` instead.

**`summerAnomaly(series, hemisphere)`** computes the mean over summer pseudo-months minus the annual mean. Summer is bins `[5, 6, 7]` for `N` and `[11, 0, 1]` for `S`, using the same bin convention as `seasonalAmplitude`. Units °C. Because the bins start from the first day of the record (late August here), these bins are not calendar June–August; treat the value as indicative until the bins are aligned to calendar months.

**`extremeHotDays(series, threshold)`** and **`extremeColdDays(series, threshold)`** simply count days above or below a °C threshold (the registry uses 30 °C and 0 °C). Because day-to-day variability differs between maritime and continental stations, two stations with the same annual mean can produce very different extreme-day counts.

### Model fit — harmonic trend

`fitHarmonicTrend(series)` fits the four-term model

```
T(t) = a + b·t + c·cos(ωt) + d·sin(ωt),     ω = 2π / 365,  t = day index
```

by ordinary least squares: it builds the 4×4 normal equations on the columns `[1, t, cos ωt, sin ωt]` and solves them by Gauss–Jordan elimination with partial pivoting (returning a zero fit if any pivot falls below 10⁻¹²). It returns the coefficients, the seasonal amplitude `√(c² + d²)`, the phase `atan2(d, c)`, the peak day (phase / ω wrapped into [0, 365)), and R². Two scalars are registered:

- **`harmonicAmplitude`** (`HarmAmp`, °C) — the fitted `√(c² + d²)`. It agrees closely with the binned `seasonalAmplitude` (r = +0.997 across the 30 stations; median 7.5 °C against 7.9 °C), but it uses every day rather than 12 bin means.
- **`harmonicTrendPerYear`** (`HarmTrend`, °C/yr) — `b · 365`. Because the seasonal cycle is fitted jointly, the slope no longer absorbs it: the median drops from +0.84 °C/yr (plain OLS) to +0.17 °C/yr, and the range narrows to −0.57 … +1.08 °C/yr.

The fit explains a median 74 % of daily variance (R² 0.32 at the most weather-dominated station, 0.94 at the most seasonal). Its limits: a single annual harmonic cannot represent a skewed cycle (a short sharp winter, a long flat summer), so some seasonal shape still leaks into `b`; and three years is far too short for `b` to be a climate trend at any one station.

## Recoverable relationships

Correlations across the 30 stations (Pearson r):

| Relationship | r | Reading |
|---|---|---|
| `annualMean` vs \|latitude\| | **−0.86** | The latitudinal gradient. Survives real data essentially intact. |
| `seasonalAmplitude` vs \|latitude\| | **+0.51** | Real, but loose: continentality matters as much as latitude. |
| `harmonicAmplitude` vs \|latitude\| | **+0.47** | Same story with the fitted amplitude. |
| `trendPerYear` vs \|latitude\| | **+0.18** | Not interpretable; the OLS trend is mostly seasonal leakage. |
| `harmonicTrendPerYear` vs \|latitude\| | **+0.60** | Looks like poleward amplification; it is not evidence of it (below). |

**`corr(annual_mean, |lat|) = −0.86`.** Colder toward the poles, warmer near the equator. Chennai is the warmest station and Amundsen–Scott the coldest. The residuals from a straight-line fit show why the correlation is not −1. Amundsen–Scott, on the polar plateau at about 2.8 km, sits 29 °C below the line and pulls it down at high |lat|. Singapore sits 13 °C below because the real gradient is flat across the tropics, not linear. Mexico City (2 303 m) sits 9 °C below on altitude alone. On the other side, maritime high-latitude stations warmed by the ocean sit 6–8 °C above the line (Lerwick, Reykjavík, Oslo, Helsinki, London), as does arid Phoenix.

**`corr(seasonal_amplitude, |lat|) = +0.51`.** On the synthetic v0.1 preset this was +0.96, because amplitude was a hard-coded function of |lat|. On real data maritime stations at high latitude (Reykjavík, Lerwick, Vancouver, London) have modest seasonal swings, while continental stations at similar latitude (Yakutsk, Minneapolis) swing by tens of degrees. Amplitude loads on continentality at least as much as on |lat|, so the scatter is a fan, not a line.

**`corr(harmonicTrendPerYear, |lat|) = +0.60`.** It is tempting to read this as polar amplification. Don't. Three years of daily data cannot pin a per-station trend of order 0.1 °C/yr against weather noise of several degrees, and the harmonic trend still correlates with harmonic amplitude at r = +0.42. Large-amplitude stations are also high-latitude stations, so residual seasonal shape that one harmonic cannot absorb shows up as an apparent latitude signal. The honest conclusion is that neither trend estimator recovers a warming signal on this window; recovering one needs a record of a decade or more.

## Reproducing in the web tool

![Annual mean vs latitude (climate preset)](/docs-img/climate-scatter.png)

In the live app, open `/lab/climate` (which applies this template) or pick the **Climate** preset:

```
Preset: climate
Blocks:
  1. Stress–strain      (color by: hemisphere)
  2. Parameters         (all climate parameters, one row per station)
  3. Parameter scatter  (Y = Annual mean, X = latitude)
```

The raw-temperature block overlays 30 curves spanning 1 095 days. Three full seasonal oscillations are visible on the high-latitude curves, in antiphase between the two hemispheres; the equatorial curves (Singapore, Chennai) are nearly flat noisy bands. No anomalies are planted in this data; any spike you see is weather.

The scatter plots annual mean against **signed** latitude. The result is an inverted V: warmest near the equator, colder toward both poles, with Amundsen–Scott alone at −90° anchoring the southern arm. The −0.86 against |latitude| is not a one-click plot, because the UI has no |latitude| field; `scripts/chapter-numbers.mjs` computes it. Swap Y to **Seasonal amplitude** or **Harmonic amplitude** to see the fan described above, or to **Harmonic trend per year** to see the spread that the +0.60 summarises.

## Limitations and extensions

The dataset is real, small and short. Specific limitations:

- **Short record.** Three years cannot separate a 0.1 °C/yr trend from weather noise at any single station, whichever estimator is used.
- **Small, hand-picked station set.** 30 stations, 6 in the Southern Hemisphere, most at airports. Urban heat islands and instrument changes are not corrected.
- **Mixed definitions of daily mean.** Eight stations are entirely `(TMAX+TMIN)/2`, the rest mostly `TAVG`; see the QC caveat above.
- **Temperature only.** No precipitation, humidity or wind, so Köppen-style classification cannot be recovered from the record. There is no `climate_zone` field; the zones named above are this chapter's informal grouping.
- **No |latitude| field.** The scatter can only use metadata the JSON carries, and the JSON carries signed latitude.
- **Pseudo-month bins.** `seasonalAmplitude` and `summerAnomaly` bin from the first day of the record, not from 1 January.
- **One bad metadata value.** Amundsen–Scott's `altitude_m` is a missing-value sentinel until the next rebuild.

Concrete extensions a student could implement:

1. Extend the window. `YEARS` in `scripts/build-climate.mjs` sets the record length and `CLIMATE_END` the end date; at 30 years `harmonicTrendPerYear` becomes individually meaningful at most stations.
2. Emit an `abs_latitude` metadata field in the builder so the −0.86 becomes a one-click plot.
3. Fetch `PRCP` alongside `TAVG` and add precipitation parameters (annual total, wet-day count, dry-spell length).
4. Real data carries real teleconnections: compute inter-station correlation of daily anomalies (after removing the harmonic fit) and scatter it against great-circle distance.
5. Add a second harmonic (`cos 2ωt`, `sin 2ωt`) to `fitHarmonicTrend` and check whether the trend's correlation with amplitude drops.
6. Align the pseudo-month bins to calendar months using `provenance.window.start`.

## Mapping back to materials

The isomorphism is exact enough to be useful. **A specimen is a station.** A tensile test, with its thousands of sampled points, is a year of daily temperature. The parameter a materials scientist extracts from the curve — yield stress, ultimate tensile strength, work-hardening exponent — is the annual mean, the seasonal amplitude, or the trend slope. The test condition recorded in the specimen metadata (temperature, strain rate, lot) is the station's latitude, altitude, and hemisphere. And the scatter that closes the workflow — yield stress versus test temperature, revealing the softening law of an alloy — is annual mean versus latitude, revealing the latitudinal temperature gradient.

This matters because the same code path, the same three-block flow, and the same parameter-vs-condition scatter work without modification. The dataset schema is identical (`strain`, `stress`, `meta`); only the labels differ. If a student can read a materials softening curve, they can read the climate scatter; and the generality of the workflow is precisely what the tool is built to demonstrate.

## References

- Menne, M. J., Durre, I., Vose, R. S., Gleason, B. E. & Houston, T. G. (2012). An overview of the Global Historical Climatology Network-Daily database. *J Atmos Ocean Tech* 29, 897–910. (GHCN-Daily, the source of this preset.)
- Screen, J. A. & Simmonds, I. (2010). The central role of diminishing sea ice in recent Arctic temperature amplification. *Nature* 464, 1334–1337. (Poleward amplification.)
- Hersbach, H. et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society* 146, 1999–2049. (A reanalysis product built on station archives such as GHCN-Daily.)
- Wallace, J. M. & Hobbs, P. V. (2006). *Atmospheric Science: An Introductory Survey*, 2nd ed. Academic Press. (Seasonal-cycle and latitudinal-gradient physics.)
