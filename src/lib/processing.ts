/**
 * Stress-strain analysis functions ported from paramaterial/processing.py.
 * Pure TypeScript, browser-safe, zero runtime dependencies.
 */

export interface Curve {
	strain: number[];
	stress: number[];
}

export interface FootCorrection {
	uplIdx: number;
	lplIdx: number;
	E: number;
	intercept: number;
	strainShift: number;
}

export interface RepresentativeCurve {
	key: string;
	strain: number[];
	mean: number[];
	std: number[];
	min: number[];
	max: number[];
	n: number;
}

interface FitResult {
	slope: number;
	intercept: number;
	r2: number;
}

function linfit(x: number[], y: number[], start: number, end: number): FitResult {
	const n = end - start;
	let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
	for (let i = start; i < end; i++) {
		const xi = x[i], yi = y[i];
		sx += xi; sy += yi; sxx += xi * xi; sxy += xi * yi; syy += yi * yi;
	}
	const denom = n * sxx - sx * sx;
	const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
	const intercept = (sy - slope * sx) / n;
	const ssTot = syy - (sy * sy) / n;
	const ssRes = syy - intercept * sy - slope * sxy;
	const r2 = ssTot <= 0 ? 0 : 1 - ssRes / ssTot;
	return { slope, intercept, r2 };
}

/** Find upper & lower proportional-limit indices via a sliding-window linear fit.
 *  Chooses the window with the maximum slope whose R² exceeds the tolerance. */
export function findUplLpl(
	c: Curve,
	opts?: { windowFraction?: number; toleranceMPa?: number }
): FootCorrection {
	const { strain, stress } = c;
	const n = strain.length;
	const windowFraction = opts?.windowFraction ?? 0.1;
	const r2Threshold = opts?.toleranceMPa ?? 0.995;
	const w = Math.max(5, Math.floor(windowFraction * n));

	let best: FitResult | null = null;
	let bestStart = 0;
	for (let i = 0; i + w <= n; i++) {
		const fit = linfit(strain, stress, i, i + w);
		if (fit.r2 < r2Threshold) continue;
		if (!best || fit.slope > best.slope) {
			best = fit;
			bestStart = i;
		}
	}
	// Fallback: if no window passed threshold, pick window with highest R².
	if (!best) {
		let bestR2 = -Infinity;
		for (let i = 0; i + w <= n; i++) {
			const fit = linfit(strain, stress, i, i + w);
			if (fit.r2 > bestR2) { bestR2 = fit.r2; best = fit; bestStart = i; }
		}
	}
	const lplIdx = bestStart;
	const uplIdx = bestStart + w - 1;
	const E = best!.slope;
	const intercept = best!.intercept;
	// x-intercept of the fitted line = strainShift (to zero the curve).
	const strainShift = -intercept / E;
	return { uplIdx, lplIdx, E, intercept, strainShift };
}

/** Ordinary least-squares slope through the slice [lpl, upl]. */
export function findE(c: Curve, upl: number, lpl: number): { E: number; intercept: number } {
	const a = Math.min(upl, lpl);
	const b = Math.max(upl, lpl) + 1;
	const fit = linfit(c.strain, c.stress, a, b);
	return { E: fit.slope, intercept: fit.intercept };
}

/** Ultimate tensile strength and the strain at which it occurs. */
export function findUTS(c: Curve): { UTS: number; idx: number; strainAtUTS: number } {
	let idx = 0, max = -Infinity;
	for (let i = 0; i < c.stress.length; i++) {
		if (c.stress[i] > max) { max = c.stress[i]; idx = i; }
	}
	return { UTS: max, idx, strainAtUTS: c.strain[idx] };
}

/** 0.2 %-offset proof stress: intersection of y = E·(x − offset) with the curve. */
export function findProofStress(
	c: Curve,
	E: number,
	offset: number = 0.002
): { proofStress: number; idx: number; strainAtPS: number } {
	const { strain, stress } = c;
	const n = strain.length;
	let lastCross = -1;
	let prevDiff = stress[0] - E * (strain[0] - offset);
	for (let i = 1; i < n; i++) {
		const diff = stress[i] - E * (strain[i] - offset);
		if ((prevDiff > 0 && diff <= 0) || (prevDiff < 0 && diff >= 0) || prevDiff === 0) {
			lastCross = i - 1;
		}
		prevDiff = diff;
	}
	if (lastCross < 0) return { proofStress: NaN, idx: -1, strainAtPS: NaN };

	// Solve intersection of data segment [cut, cut+1] with elastic line y = E(x - offset).
	const cut = lastCross;
	const x0 = strain[cut], y0 = stress[cut];
	const x1 = strain[cut + 1], y1 = stress[cut + 1];
	const m = (y1 - y0) / (x1 - x0);
	// y = m(x - x0) + y0 = E(x - offset)  =>  x = (y0 - m*x0 + E*offset) / (E - m)
	const denom = E - m;
	if (denom === 0) return { proofStress: NaN, idx: cut, strainAtPS: NaN };
	const xStar = (y0 - m * x0 + E * offset) / denom;
	const yStar = E * (xStar - offset);
	return { proofStress: yStar, idx: cut, strainAtPS: xStar };
}

/** Interpolate (srcX, srcY) onto `grid`; returns NaN outside the source x-range.
 *  Sorts the input by x first to tolerate noise/non-monotonicity. */
function interpOntoGrid(srcX: number[], srcY: number[], grid: number[]): number[] {
	const pairs: Array<[number, number]> = srcX.map((x, i) => [x, srcY[i]]);
	pairs.sort((a, b) => a[0] - b[0]);
	const xs = pairs.map(p => p[0]);
	const ys = pairs.map(p => p[1]);
	const out = new Array<number>(grid.length);
	const xMin = xs[0], xMax = xs[xs.length - 1];
	let j = 0;
	for (let i = 0; i < grid.length; i++) {
		const g = grid[i];
		if (g < xMin || g > xMax) { out[i] = NaN; continue; }
		while (j < xs.length - 2 && xs[j + 1] < g) j++;
		const x0 = xs[j], x1 = xs[j + 1];
		if (x1 === x0) { out[i] = ys[j]; continue; }
		const t = (g - x0) / (x1 - x0);
		out[i] = ys[j] + t * (ys[j + 1] - ys[j]);
	}
	return out;
}

/** Group tests by `groupBy` meta keys, interpolate onto a shared strain grid, and
 *  return per-group mean/std plus min/max envelope. */
export function computeRepresentative(
	tests: Array<{ meta: Record<string, unknown>; strain: number[]; stress: number[] }>,
	groupBy: string[],
	nPoints: number = 200
): RepresentativeCurve[] {
	const groups = new Map<string, typeof tests>();
	for (const t of tests) {
		const key = groupBy.map(k => String(t.meta[k])).join('|');
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(t);
	}

	const out: RepresentativeCurve[] = [];
	for (const [key, members] of groups) {
		// Common strain grid: intersection of each test's [min, max] range.
		let lo = -Infinity, hi = Infinity;
		for (const m of members) {
			let mn = Infinity, mx = -Infinity;
			for (const s of m.strain) { if (s < mn) mn = s; if (s > mx) mx = s; }
			if (mn > lo) lo = mn;
			if (mx < hi) hi = mx;
		}
		if (!isFinite(lo) || !isFinite(hi) || hi <= lo) {
			out.push({ key, strain: [], mean: [], std: [], min: [], max: [], n: members.length });
			continue;
		}
		const grid = new Array<number>(nPoints);
		for (let i = 0; i < nPoints; i++) grid[i] = lo + (hi - lo) * i / (nPoints - 1);

		const resampled = members.map(m => interpOntoGrid(m.strain, m.stress, grid));
		const mean = new Array<number>(nPoints);
		const std = new Array<number>(nPoints);
		const mins = new Array<number>(nPoints);
		const maxs = new Array<number>(nPoints);
		for (let i = 0; i < nPoints; i++) {
			let s = 0, s2 = 0, cnt = 0, mn = Infinity, mx = -Infinity;
			for (const col of resampled) {
				const v = col[i];
				if (!Number.isFinite(v)) continue;
				s += v; s2 += v * v; cnt++;
				if (v < mn) mn = v;
				if (v > mx) mx = v;
			}
			const mu = cnt > 0 ? s / cnt : NaN;
			const variance = cnt > 1 ? Math.max(0, s2 / cnt - mu * mu) : 0;
			mean[i] = mu;
			std[i] = cnt > 0 ? Math.sqrt(variance) : NaN;
			mins[i] = cnt > 0 ? mn : NaN;
			maxs[i] = cnt > 0 ? mx : NaN;
		}
		out.push({ key, strain: grid, mean, std, min: mins, max: maxs, n: members.length });
	}
	return out;
}

/* Example usage (not executed):
 *
 * import raw from '../../static/data/basic-usage.json';
 * const t = raw.tests[0];
 * const curve = { strain: t.strain, stress: t.stress };
 *
 * const foot = findUplLpl(curve);
 * const { E } = findE(curve, foot.uplIdx, foot.lplIdx);
 * const uts = findUTS(curve);
 * const ps  = findProofStress(curve, E, 0.002);
 *
 * const rep = computeRepresentative(
 *   raw.tests.map(t => ({ meta: t.meta, strain: t.strain, stress: t.stress })),
 *   ['temperature'],
 *   200
 * );
 */
