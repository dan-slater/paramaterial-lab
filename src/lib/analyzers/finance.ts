/**
 * Finance analyzers.
 *
 * This module provides first-moment estimators (log returns, annualised return,
 * Sharpe ratio, drawdown) and second-moment estimators (rolling-window sample
 * volatility, RiskMetrics-style EWMA volatility, and a scalar index of
 * volatility clustering). The second-moment estimators are intended as a
 * lightweight model fit over the price path, not merely summary statistics.
 */

export type Series = { strain: number[]; stress: number[] };

const TRADING_DAYS = 252;

export function logReturns(series: Series): number[] {
  const p = series.stress;
  const r: number[] = [];
  for (let i = 1; i < p.length; i++) {
    r.push(Math.log(p[i] / p[i - 1]));
  }
  return r;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function stdev(xs: number[], m?: number): number {
  if (xs.length < 2) return 0;
  const mu = m ?? mean(xs);
  let s = 0;
  for (const x of xs) s += (x - mu) * (x - mu);
  return Math.sqrt(s / (xs.length - 1));
}

export function annualizedReturn(series: Series): number {
  const p = series.stress;
  if (p.length < 2) return 0;
  const totalLog = Math.log(p[p.length - 1] / p[0]);
  const years = (p.length - 1) / TRADING_DAYS;
  return Math.exp(totalLog / years) - 1;
}

export function annualizedVolatility(series: Series): number {
  const r = logReturns(series);
  return stdev(r) * Math.sqrt(TRADING_DAYS);
}

export function sharpeRatio(series: Series, riskFreeRate = 0.04): number {
  const ar = annualizedReturn(series);
  const av = annualizedVolatility(series);
  if (av === 0) return 0;
  return (ar - riskFreeRate) / av;
}

export function maxDrawdown(series: Series): { drawdown: number; peakIdx: number; troughIdx: number } {
  const p = series.stress;
  let peak = p[0];
  let peakIdx = 0;
  let bestPeakIdx = 0;
  let bestTroughIdx = 0;
  let maxDd = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > peak) {
      peak = p[i];
      peakIdx = i;
    }
    const dd = (peak - p[i]) / peak;
    if (dd > maxDd) {
      maxDd = dd;
      bestPeakIdx = peakIdx;
      bestTroughIdx = i;
    }
  }
  return { drawdown: maxDd, peakIdx: bestPeakIdx, troughIdx: bestTroughIdx };
}

export function skewness(series: Series): number {
  const r = logReturns(series);
  const n = r.length;
  if (n < 3) return 0;
  const mu = mean(r);
  const sd = stdev(r, mu);
  if (sd === 0) return 0;
  let s = 0;
  for (const x of r) s += ((x - mu) / sd) ** 3;
  return (n / ((n - 1) * (n - 2))) * s;
}

export function kurtosis(series: Series): number {
  const r = logReturns(series);
  const n = r.length;
  if (n < 4) return 0;
  const mu = mean(r);
  const sd = stdev(r, mu);
  if (sd === 0) return 0;
  let s = 0;
  for (const x of r) s += ((x - mu) / sd) ** 4;
  const a = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const b = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  return a * s - b;
}

/** Rolling annualised volatility over a centred window of `window` days. */
export function rollingVolatility(series: Series, window: number = 21): number[] {
  const r = logReturns(series);
  const n = r.length;
  const out: number[] = new Array(n).fill(0);
  if (n === 0 || window < 2) return out;
  const half = Math.floor(window / 2);
  for (let t = 0; t < n; t++) {
    const lo = Math.max(0, t - half);
    const hi = Math.min(n - 1, t + (window - 1 - half));
    const m = hi - lo + 1;
    if (m < 2) {
      out[t] = 0;
      continue;
    }
    let s = 0;
    for (let i = lo; i <= hi; i++) s += r[i];
    const mu = s / m;
    let ss = 0;
    for (let i = lo; i <= hi; i++) ss += (r[i] - mu) * (r[i] - mu);
    const varHat = ss / (m - 1);
    const sigma = Math.sqrt(Math.max(varHat, 0)) * Math.sqrt(TRADING_DAYS);
    out[t] = Number.isFinite(sigma) ? sigma : 0;
  }
  return out;
}

/** Exponentially-weighted moving average volatility (RiskMetrics-style).
 *  σ²_t = λ·σ²_{t-1} + (1−λ)·r²_t  with default λ = 0.94.
 *  Returns the annualised EWMA σ at each day (NaN for the first day). */
export function ewmaVolatility(series: Series, lambda: number = 0.94): number[] {
  const r = logReturns(series);
  const n = r.length;
  const out: number[] = new Array(n).fill(0);
  if (n === 0) return out;
  const lam = Math.min(Math.max(lambda, 0), 0.999999);
  // Seed: variance of r_0 relative to zero-mean assumption (RiskMetrics convention).
  let varPrev = r[0] * r[0];
  out[0] = Number.NaN;
  for (let t = 1; t < n; t++) {
    const v = lam * varPrev + (1 - lam) * r[t] * r[t];
    varPrev = v;
    const sigma = Math.sqrt(Math.max(v, 0)) * Math.sqrt(TRADING_DAYS);
    out[t] = Number.isFinite(sigma) ? sigma : 0;
  }
  return out;
}

/** Persistence of volatility clustering: Pearson r between |r_t| and |r_{t-1}|
 *  on log returns. Positive and ≥ ~0.1 is the stylised-fact signature. */
export function volClusteringIndex(series: Series): number {
  const r = logReturns(series);
  const n = r.length;
  if (n < 3) return 0;
  const a: number[] = new Array(n - 1);
  const b: number[] = new Array(n - 1);
  for (let i = 1; i < n; i++) {
    a[i - 1] = Math.abs(r[i]);
    b[i - 1] = Math.abs(r[i - 1]);
  }
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] - ma;
    const bi = b[i] - mb;
    num += ai * bi;
    da += ai * ai;
    db += bi * bi;
  }
  const denom = Math.sqrt(da * db);
  if (!Number.isFinite(denom) || denom === 0) return 0;
  const rho = num / denom;
  if (!Number.isFinite(rho)) return 0;
  return Math.max(-1, Math.min(1, rho));
}
