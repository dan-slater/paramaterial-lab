---
title: Finance — daily equity returns
slug: finance
---

# Finance — daily equity returns

## Background

Given a single time series of daily closing prices, what can be said about the
asset that produced it? The question is old, and every answer assigns a
different role to randomness. The chapter treats a price path as data and asks
which scalar summaries of that path admit a defensible cross-sectional story
once they are laid alongside metadata such as sector, size, or factor
exposure.

The modern statistical treatment of equity prices begins with Osborne, who
argued that daily percentage changes are approximately log-normal because
investors perceive proportional, not absolute, price moves [1]. Louis
Bachelier had anticipated Brownian motion as a price model half a century
earlier, but Osborne's log-normal reframing matched the empirical shape of
daily return histograms and underwrote the geometric Brownian motion (GBM)
convention that still dominates textbooks.

Mandelbrot punctured the i.i.d.-Gaussian picture almost immediately. Cotton
prices, he showed, exhibit *volatility clustering*: large absolute returns
tend to follow large absolute returns, and the marginal distribution has
heavier tails than a normal [2]. A coherent statistical model took two more
decades. Engle's ARCH captured clustering by letting conditional variance
depend on recent squared returns [3], and Bollerslev's GARCH generalisation
added a smoothed term for conditional variance itself, giving a
parsimonious and empirically robust specification [4]. Black, Scholes and
Merton had meanwhile turned log-normal prices into a tractable option-pricing
theory that made volatility a tradable quantity [5].

Cont later consolidated the empirical regularities that any serious model
must reproduce into a list of *stylised facts*: near-zero autocorrelation in
returns, heavy-tailed return distributions, persistent autocorrelation in
absolute or squared returns (clustering), a leverage effect linking negative
returns to higher subsequent volatility, and so on [6]. Those seven or so
facts are now the standard sanity check on any synthetic return generator.

The analyzers in this chapter address the first- and second-moment facts
directly: mean return, variance, skewness, excess kurtosis, rolling
volatility, and EWMA volatility. They do not yet address conditional
heteroskedasticity in its GARCH form, the leverage effect, jumps, or
cross-sectional factor structure. The closing section treats that last
omission as the most consequential one and proposes a concrete schema
extension.

## Dataset provenance

**v0.2 change.** The `finance` preset is no longer synthetic. The seeded
geometric-Brownian-motion generator that produced v0.1 has been removed and
replaced with **real daily adjusted-close prices** fetched from
[Stooq](https://stooq.com) by `scripts/build-finance.mjs`. Stooq publishes
per-ticker daily CSVs under
`https://stooq.com/q/d/l/?s=<ticker>.us&i=d`; the `Close` column is already
split- and dividend-adjusted for US equities, so no further adjustment is
applied downstream. If Stooq is unreachable or gated (it now requires a
free apikey), the script falls back to the Yahoo chart endpoint
(`query1.finance.yahoo.com/v8/finance/chart/...`), which returns an
equivalent `adjclose` series.

**Licence and usage.** Stooq's data is distributed free for personal and
research use; commercial redistribution requires their permission
(see `https://stooq.com/terms/`). The dataset here is a snapshot for
method demonstration, not a re-distributed commercial feed.

**Ticker universe.** 40 US-listed large-caps across eight sectors —
Technology (7), Healthcare (6), Energy (5), Financials (5), Consumer (5),
Industrials (5), Materials (4), Utilities (3). The sector buckets are
deliberately aligned with the v0.1 synthetic so the chapter's sector prose
still reads sensibly. This is **not** a balanced representation of global
equities. It is a convenience sample of heavily-traded US names chosen so
that a reader can recognise every ticker and reason about it informally.
Non-US markets, small caps, emerging markets, and anything non-equity are
all absent by construction.

**Time range and alignment.** The script fetches ~3 years of daily rows per
ticker, intersects the date sets, and keeps the latest **504 common
business days** (≈ 2 calendar years). The window therefore ends at the
most recent Stooq/Yahoo close and slides forward on every rebuild. Every
retained ticker shares the same 504-day aligned index.

**Adjustments.** Adjusted close already folds in splits and dividends, so
the series is directly comparable across pre/post-event dates without
further correction. No outlier masking, winsorisation, or return clipping
is applied — real tails reach the analyzers unmodified.

**What changed vs v0.1.** The two injected shocks that defined the
v0.1 synthetic — a market-wide dip on days 175–185 and an Energy-only
shock on days 325–335 — **are gone**. Any drawdowns visible in the real
series occur at whatever calendar dates the rolling 504-day window
happens to cross; they are no longer mechanical. As a direct
consequence, the +0.73 β-vs-`MaxDD` correlation documented in v0.1 was an
artefact of the injected market window and **must be re-computed from the
real data** rather than quoted from a synthetic generator.

**v0.2 numbers (refreshed 2026-04-22).** The quantitative claims in the
sections below have been re-computed against the current 504-day real-price
window via `tmp/compute-stale.mjs`. They are specific to that window and
will drift on every rebuild; the chapter treats them as worked examples
rather than fixed anchors.

## First-moment analyzers

The analyzers live in `src/lib/analyzers/finance.ts`. Each takes a
`Series = { strain: number[]; stress: number[] }`; the materials field names
are reused because every dataset in the tool is treated as an `(x, y)`
series. For finance, `strain` is the day index and `stress` is the adjusted
close.

**Log returns.** `logReturns(series): number[]` computes
rᵢ = ln(pᵢ / pᵢ₋₁). Log returns are time-additive — the sum over a window
is the window log return — and they are the natural quantity under GBM.

**Annualized return.** `annualizedReturn(series): number` applies geometric
annualisation: exp(ln(p_N / p_0) / years) − 1, with
years = (N − 1) / 252.

**Annualized volatility.** `annualizedVolatility(series): number` is the
sample standard deviation of daily log returns (unbiased, n − 1 in the
denominator) scaled by √252. The √252 factor assumes independent daily
returns.

**Sharpe ratio.** `sharpeRatio(series, riskFreeRate = 0.04): number` is
(rₐ − rf) / σₐ, Sharpe's classical risk-adjusted return measure [7]. The
default short rate is a 4 % placeholder; the function returns 0 rather than
diverging when σₐ = 0.

**Max drawdown.** `maxDrawdown(series)` walks the price path tracking the
running peak and returns `{ drawdown, peakIdx, troughIdx }` so the UI can
annotate both endpoints on the equity curve.

**Skewness and excess kurtosis.** `skewness(series)` uses the adjusted
Fisher–Pearson estimator with the n/((n−1)(n−2)) correction. `kurtosis`
returns *excess* kurtosis (so a normal scores 0). For the GBM generator both
should sit near zero.

The registry keys and UI labels are `AnnReturn` → **Annualized return**,
`AnnVol` → **Annualized volatility**, `Sharpe` → **Sharpe ratio**, `MaxDD`
→ **Max drawdown**, `Skew` → **Return skewness**, `ExKurt` → **Excess
kurtosis**.

## Model fit — rolling and EWMA volatility

Summary scalars compress a whole price path to one number. A minimal step
toward a model fit is to estimate a *time-varying* variance across the path
itself. Two standard estimators do this without leaving the one-parameter
regime.

The centred rolling variance is

    σ̂²_rolling(t) = (1/(w−1)) · Σ_{i=t−w+1}^{t} (r_i − r̄)²        (annualised × √252)

over a window of `w` days. It is unbiased if returns are i.i.d. within the
window, but it reacts slowly: a one-day shock only leaves the window `w`
days later, so σ̂ sits elevated for the full window width.

The exponentially weighted estimator of RiskMetrics [8] replaces the
boxcar window with a geometric one,

    σ̂²_ewma(t) = λ·σ̂²_ewma(t−1) + (1−λ)·r²_t                    (λ = 0.94, RiskMetrics 1996)

which is usually preferred at short horizons. Recent shocks receive higher
weight, the estimator responds to regime changes within a few days rather
than a full window, and the single free parameter λ subsumes window-length
choice. RiskMetrics fixes λ = 0.94 for daily data as an industry default.

A GARCH(1,1) generalisation,
σ²_t = ω + α·r²_{t−1} + β·σ²_{t−1}, nests EWMA as the case
ω = 0, α = 1 − λ, β = λ [4], and is the natural next step once parameter
estimation is available. It is not yet shipped; it is on the roadmap.

The new signatures exported from `finance.ts` are

    export function rollingVolatility(series: Series, window: number = 21): number[];
    export function ewmaVolatility(series: Series, lambda: number = 0.94): number[];
    export function volClusteringIndex(series: Series): number;

`rollingVolatility` returns an annualised σ̂ per day over a centred window
(default 21 trading days, one calendar month). `ewmaVolatility` returns an
annualised EWMA σ̂ per day (NaN on day 0 since the estimator needs at least
one return). `volClusteringIndex` is the scalar companion documented below.

## Stylised facts the finance preset recovers

Cont's 2001 list [6] is the right checklist for a synthetic generator. The
finance preset scores as follows. *Heavy-tailed daily returns:* partial.
Individual tickers have Gaussian innovations, but the mixture across
β-scaled market shocks and injected dip windows produces excess kurtosis
mildly above zero. *Volatility clustering:* **no, by construction** — daily
innovations are independent. *Leverage effect:* no — negative returns do
not feed back into next-day variance. *Asymmetric response to shocks:* no —
the GBM increments are symmetric around the drift. *Aggregational
Gaussianity:* yes, trivially, since the generator is Gaussian at the
daily scale. *Slow decay of autocorrelation in absolute returns:* no.
*Volume/volatility coupling:* not applicable — there is no volume.

The `volClusteringIndex` scalar is the single-column diagnostic for this.
It is the Pearson correlation between |r_t| and |r_{t-1}|. On real equity
returns this value is typically +0.1 to +0.3; on the v0.1 synthetic preset
it sat near zero, with no meaningful sector difference. On the current
v0.2 real-data window the cross-sectional mean sits at **+0.13** with a
per-ticker range of 0.00–0.29 — squarely inside the expected band. Sector
means separate weakly (Utilities +0.08, Consumer +0.10, Technology +0.11,
Healthcare / Industrials +0.12, Financials +0.14, Materials +0.15,
Energy +0.18). Energy clusters fastest, as expected given its exposure to
oil-price shock regimes; Utilities is flattest. This is a feature, not a
defect: the reader can confirm the v0.1 generator's limits and the v0.2
real data's clustering with one Parameters-block column.

## Recoverable relationships

| Relationship | Value on the preset (v0.2, 504-day window) | Driven by |
|---|---|---|
| corr(β, `MaxDD`) across all tickers | **+0.48** (β proxy = OLS on equal-weighted market index) | Real market drawdown of −17% (peak day 503 → trough day 243) exposes high-β names more; weaker than the +0.73 v0.1 artefact because the signal is emergent rather than mechanical |
| Mean `Sharpe` by sector (best → worst) | Financials **+1.17**, Utilities **+0.84**, Materials **+0.66**, Consumer **+0.62**, Industrials **+0.55**, Technology **+0.47**, Healthcare **+0.26**, Energy **+0.18** | All positive on the current bull-window; sector ordering reflects the realised rally rather than a generator's drift/β design matrix |
| Visible drawdowns on the price overlay | Single market-wide trough at **day ≈ 243**, −17% peak-to-trough on the equal-weighted proxy; no second Energy-only dip | Emergent from the 2024–2026 real window; the two v0.1 injected shocks (day 180 market-wide, day 330 Energy) are gone |
| `volClusteringIndex` across sectors | Cross-sectional mean **+0.13** (range 0.00–0.29 per ticker); weak sector ordering — Energy +0.18, Materials +0.15, Financials +0.14, Healthcare/Industrials +0.12, Tech +0.11, Consumer +0.10, Utilities +0.08 | Real returns exhibit Cont-style clustering; the v0.1 generator had independent innovations and sat near zero |

The +0.48 β–MaxDD correlation is emergent, not mechanical. The equal-weighted
market proxy registered a −17 % drawdown troughing at day 243 of the current
504-day window; high-β names amplified it. The effect is real but noisier
than v0.1's injected window produced, because individual tickers carry
idiosyncratic volatility that dilutes the market-beta channel. A
single-market-drawdown-dominated window is sufficient to recover a positive
correlation; a window without a meaningful market drawdown would collapse the
signal.

Financials top the v0.2 Sharpe table at +1.17 because the current window
runs through a rally in which large-cap banks delivered the highest
risk-adjusted excess return over the 4 % risk-free rate. Energy is lowest at
+0.18 because oil-price volatility widened σ faster than drift. None of the
sectors are negative on this window — a v0.1-style synthetic with injected
shocks would produce negative Sharpes; a real bull-market window does not.

## Reproducing in the web tool

*![Max drawdown vs beta (finance preset)](/docs-img/finance-scatter.png)*

```
Preset: finance
Blocks: Stress–strain (color by sector) → Parameters → Parameter scatter (Y = Max drawdown, X = beta)
```

1. Select the **finance** preset; the loader resolves `/data/finance.json`
   via `loadDataset` in `src/lib/datasets.ts`.
2. Add a **Stress–strain** block with `color by = sector`. Under v0.1 the
   two injected shocks were visible near day 180 and day 330; on the
   current v0.2 window the equal-weighted proxy drops ~17 % peak-to-trough
   with the trough sitting near day 243, and there is no second
   Energy-only event.
3. Add a **Parameters** block and tick at minimum **Annualized return**,
   **Annualized volatility**, **Sharpe ratio**, and **Max drawdown**
   (`AnnReturn`, `AnnVol`, `Sharpe`, `MaxDD`). Once `registry.ts` is
   updated, tick the new **Rolling volatility (mean)**, **EWMA
   volatility (mean)**, and **Vol clustering index** columns as well. The
   block computes one row per ticker.
4. Add a **Parameter scatter**: Y = **Max drawdown**, X = **beta**, colour
   by sector. On v0.1 the +0.73 correlation was immediately visible; on
   the current v0.2 window the correlation is +0.48 — clearly positive but
   with more scatter, reflecting that real market drawdowns expose high-β
   names without the mechanical proportionality the v0.1 generator imposed.
5. For Sharpe-by-sector, set Y = **Sharpe ratio** and X = `sector`, or
   use a grouped strip plot.
6. For the stylised-fact check, set Y = **Vol clustering index** and
   X = `sector`. The values should scatter around zero with no sector
   structure.

Since the dataset is seeded, re-running `npm run build:data` reproduces
every number in this chapter.

## Limitations

- **No autocorrelation in returns.** Daily log returns are independent
  GBM increments. Momentum or mean-reversion analyzers have zero expected
  signal.
- **No stochastic volatility.** σ is fixed per ticker; GARCH-style
  clustering is absent, and `volClusteringIndex` confirms it.
- **Diagonal sector structure.** Sector shocks are independent across
  sectors; the only cross-sector coupling is through `m[i]`.
- **No earnings or calendar effects.** No day-of-week, no end-of-quarter
  drift, no announcements.
- **Shocks are deterministic in timing.** The day-180 and day-330 events
  are hard-coded windows rather than Poisson-distributed jumps.
- **EWMA is not a full conditional-variance model.** It has no leverage
  term, no volatility-of-volatility, no regime-switching, and no jump
  component. It is a one-parameter smoother of squared returns. GARCH(1,1)
  and its asymmetric extensions (EGARCH, GJR-GARCH) would be required to
  probe any of those effects.

## Where paramaterial must generalise next

Finance is intrinsically multi-series. A meaningful risk decomposition
cannot be performed on one ticker in isolation; it needs the market
portfolio as a covariate. The capital asset pricing model asks for β
against a market index. The Fama–French three-factor model asks for
loadings on market, size, and value returns [9]. The five-factor model
adds profitability and investment. None of this can be computed from a
lone `(strain, stress)` pair.

The `Dataset` schema currently carries one `(strain, stress)` curve per
`Test` — that is, one per ticker — and has no mechanism for a common
covariate series shared across tests. The concrete extension is a new
optional field

    Dataset.covariates: Record<string, number[]>

holding day-indexed aligned series, for example a `market` factor and a
`size` factor sampled at the same grid as each ticker's `strain`. A new
analyzer type, `CovariateParameterDef`, would expose

    extract(series: Series, covariates: Record<string, number[]>): number

so that analyzers such as `betaVsMarket`, `residualVolatility`, and
`factorLoading(factor)` can be expressed cleanly. Three new analyzers
cover the baseline: beta against a nominated factor, residual volatility
after the factor regression, and the factor's loading magnitude.

The lift is **medium**: one schema field, one new `ParameterDef` variant
with an `extract` signature, a loader change for presets that ship
covariates, and two or three analyzers. It is the single extension that
would lift paramaterial from per-ticker summary statistics into
cross-sectional factor analysis — the form in which modern empirical
finance is actually practised.

## References

[1] M. F. M. Osborne, "Brownian motion in the stock market," *Operations
Research*, vol. 7, no. 2, pp. 145–173, 1959. doi:10.1287/opre.7.2.145.

[2] B. Mandelbrot, "The variation of certain speculative prices," *Journal
of Business*, vol. 36, no. 4, pp. 394–419, 1963. doi:10.1086/294632.

[3] R. F. Engle, "Autoregressive conditional heteroscedasticity with
estimates of the variance of United Kingdom inflation," *Econometrica*,
vol. 50, no. 4, pp. 987–1007, 1982. doi:10.2307/1912773.

[4] T. Bollerslev, "Generalized autoregressive conditional
heteroskedasticity," *Journal of Econometrics*, vol. 31, no. 3, pp.
307–327, 1986. doi:10.1016/0304-4076(86)90063-1.

[5] R. C. Merton, "Theory of rational option pricing," *Bell Journal of
Economics and Management Science*, vol. 4, no. 1, pp. 141–183, 1973.
doi:10.2307/3003143.

[6] R. Cont, "Empirical properties of asset returns: stylized facts and
statistical issues," *Quantitative Finance*, vol. 1, no. 2, pp. 223–236,
2001. doi:10.1080/713665670.

[7] W. F. Sharpe, "Mutual fund performance," *Journal of Business*, vol.
39, no. 1, pp. 119–138, 1966. doi:10.1086/294846.

[8] J.P. Morgan/Reuters, *RiskMetrics — Technical Document*, 4th ed. New
York: J.P. Morgan, 1996. Available:
https://www.msci.com/documents/10199/5915b101-4206-4ba0-aee2-3449d5c7e95a.

[9] E. F. Fama and K. R. French, "Common risk factors in the returns on
stocks and bonds," *Journal of Financial Economics*, vol. 33, no. 1, pp.
3–56, 1993. doi:10.1016/0304-405X(93)90023-5.

[10] D. N. Joanes and C. A. Gill, "Comparing measures of sample skewness
and kurtosis," *Journal of the Royal Statistical Society: Series D (The
Statistician)*, vol. 47, no. 1, pp. 183–189, 1998.
doi:10.1111/1467-9884.00122.
