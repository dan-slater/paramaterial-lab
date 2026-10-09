export type Series = { strain: number[]; stress: number[] };

function isNum(v: number): boolean {
  return typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v);
}

export function initialCapacity(series: Series): number {
  const y = series.stress;
  const vals: number[] = [];
  for (let i = 0; i < y.length && vals.length < 3; i++) {
    if (isNum(y[i])) vals.push(y[i]);
  }
  if (vals.length === 0) return 0;
  let s = 0;
  for (const v of vals) s += v;
  return s / vals.length;
}

export function currentCapacity(series: Series): number {
  const y = series.stress;
  for (let i = y.length - 1; i >= 0; i--) {
    if (isNum(y[i])) return y[i];
  }
  return 0;
}

export function fadePerCycle(series: Series): number {
  const x = series.strain;
  const y = series.stress;
  let firstI = -1;
  let lastI = -1;
  for (let i = 0; i < y.length; i++) {
    if (isNum(y[i])) {
      if (firstI < 0) firstI = i;
      lastI = i;
    }
  }
  if (firstI < 0 || lastI <= firstI) return 0;
  const dy = y[firstI] - y[lastI];
  const dx = x[lastI] - x[firstI];
  if (dx === 0) return 0;
  return dy / dx;
}

export function cyclesTo80Pct(series: Series): number | null {
  const x = series.strain;
  const y = series.stress;
  const c0 = initialCapacity(series);
  if (c0 === 0) return null;
  const threshold = 0.8 * c0;
  for (let i = 0; i < y.length; i++) {
    if (isNum(y[i]) && y[i] < threshold) return x[i];
  }
  return null;
}

export function retentionAt(series: Series, cycle: number): number {
  const x = series.strain;
  const y = series.stress;
  const c0 = initialCapacity(series);
  if (c0 === 0) return 0;
  // find closest index to cycle with finite y
  let bestI = -1;
  let bestD = Infinity;
  for (let i = 0; i < x.length; i++) {
    if (!isNum(y[i])) continue;
    const d = Math.abs(x[i] - cycle);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestI < 0) return 0;
  // No extrapolation: a cycle past the end of the record has no retention.
  if (cycle > x[x.length - 1]) return NaN;
  return y[bestI] / c0;
}

// Least-squares linear fit; returns slope.
function slope(xs: number[], ys: number[], lo: number, hi: number): number {
  const n = hi - lo;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = lo; i < hi; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

function sse(xs: number[], ys: number[], lo: number, hi: number): number {
  const n = hi - lo;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = lo; i < hi; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  let s = 0;
  for (let i = lo; i < hi; i++) {
    const r = ys[i] - (m * xs[i] + b);
    s += r * r;
  }
  return s;
}

export function kneeCycle(series: Series): number | null {
  const xAll = series.strain;
  const yAll = series.stress;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < yAll.length; i++) {
    if (isNum(yAll[i])) {
      xs.push(xAll[i]);
      ys.push(yAll[i]);
    }
  }
  const n = xs.length;
  if (n < 20) return null;

  const minSeg = Math.max(5, Math.floor(n * 0.1));
  let bestK = -1;
  let bestSSE = Infinity;
  // Search over candidate breakpoints at ~2% stride for efficiency
  const stride = Math.max(1, Math.floor(n / 100));
  for (let k = minSeg; k < n - minSeg; k += stride) {
    const s = sse(xs, ys, 0, k) + sse(xs, ys, k, n);
    if (s < bestSSE) {
      bestSSE = s;
      bestK = k;
    }
  }
  if (bestK < 0) return null;

  const s1 = slope(xs, ys, 0, bestK); // expected negative
  const s2 = slope(xs, ys, bestK, n); // expected more negative
  // capacity is decreasing → slopes negative. "Second at least 2x first"
  // means |s2| >= 2*|s1|.
  if (s1 >= 0 || s2 >= 0) return null;
  if (Math.abs(s2) >= 2 * Math.abs(s1)) return xs[bestK];
  return null;
}

/** Fit C(n) = C0 · exp(-k · n^alpha) to the per-cycle capacity record by a
 *  single closed-form OLS on the log-log linearisation
 *  ln(ln(C0 / C(n))) = ln(k) + alpha · ln(n). C0 is the mean of the first three
 *  capacities (nudged up by 0.05 % so C(n) < C0 holds); points with n < 1 or
 *  C(n) >= C0 are dropped. No iterative refinement. R² is reported on the
 *  original capacity residuals. Returns NaN coefficients with rSquared = 0 on
 *  fit failure (fewer than 3 usable points, or k <= 0). */
export interface StretchedExpFit {
  C0: number;
  k: number;
  alpha: number;
  rSquared: number;
}

const FIT_FAIL: StretchedExpFit = { C0: NaN, k: NaN, alpha: NaN, rSquared: 0 };

export function fitStretchedExp(series: Series): StretchedExpFit {
  const xAll = series.strain;
  const yAll = series.stress;
  if (!xAll || !yAll || xAll.length !== yAll.length) return { ...FIT_FAIL };

  // Collect finite (n, C) pairs.
  const ns: number[] = [];
  const cs: number[] = [];
  for (let i = 0; i < yAll.length; i++) {
    const n = xAll[i];
    const c = yAll[i];
    if (isNum(n) && isNum(c) && c > 0) {
      ns.push(n);
      cs.push(c);
    }
  }
  if (ns.length < 5) return { ...FIT_FAIL };

  // Estimate C0 as mean of first three finite capacities.
  const head: number[] = [];
  for (let i = 0; i < cs.length && head.length < 3; i++) head.push(cs[i]);
  let C0 = 0;
  for (const v of head) C0 += v;
  C0 /= head.length;
  if (!isNum(C0) || C0 <= 0) return { ...FIT_FAIL };

  // Log-log linearisation: ln(ln(C0/C(n))) = ln(k) + α · ln(n), for n≥1 and C<C0.
  // Clamp C0 upward slightly so that C(n) < C0 always (first-cycle noise can push C(n) above C0).
  const C0lin = C0 * 1.0005;
  const lx: number[] = [];
  const ly: number[] = [];
  for (let i = 0; i < ns.length; i++) {
    const n = ns[i];
    const c = cs[i];
    if (n < 1) continue;
    const ratio = C0lin / c;
    if (!isNum(ratio) || ratio <= 1) continue;
    const inner = Math.log(ratio);
    if (!isNum(inner) || inner <= 0) continue;
    const outer = Math.log(inner);
    const lnN = Math.log(n);
    if (!isNum(outer) || !isNum(lnN)) continue;
    lx.push(lnN);
    ly.push(outer);
  }
  if (lx.length < 3) return { ...FIT_FAIL };

  // OLS on (lx, ly): ly = alpha · lx + ln(k)
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const m = lx.length;
  for (let i = 0; i < m; i++) {
    sx += lx[i];
    sy += ly[i];
    sxx += lx[i] * lx[i];
    sxy += lx[i] * ly[i];
  }
  const denom = m * sxx - sx * sx;
  if (denom === 0) return { ...FIT_FAIL };
  const alpha = (m * sxy - sx * sy) / denom;
  const lnK = (sy - alpha * sx) / m;
  const k = Math.exp(lnK);
  if (!isNum(alpha) || !isNum(k) || k <= 0) return { ...FIT_FAIL };

  // R² on the original (not log-log) residuals.
  let meanC = 0;
  for (const v of cs) meanC += v;
  meanC /= cs.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < ns.length; i++) {
    const n = ns[i];
    const c = cs[i];
    const nPow = n >= 1 ? Math.pow(n, alpha) : 0;
    const pred = C0 * Math.exp(-k * nPow);
    const r = c - pred;
    ssRes += r * r;
    const d = c - meanC;
    ssTot += d * d;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const r2 = isNum(rSquared) ? rSquared : 0;

  return { C0, k, alpha, rSquared: r2 };
}

/** Fitted α exponent from the stretched-exponential fade model. */
export function fadeExponent(series: Series): number {
  const fit = fitStretchedExp(series);
  return fit.alpha;
}

/** Fitted k rate constant from the stretched-exponential fade model. */
export function fadeRateConstant(series: Series): number {
  const fit = fitStretchedExp(series);
  return fit.k;
}
