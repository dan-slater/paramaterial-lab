// Climate analyzers. Series convention: strain = day-of-record index (0..N-1),
// stress = daily mean temperature in °C. 365 days/year, leap ignored.

export interface ClimateSeries {
	strain: number[];
	stress: number[];
}

const DAYS_PER_YEAR = 365;

function mean(xs: number[]): number {
	if (xs.length === 0) return NaN;
	let s = 0;
	for (const x of xs) s += x;
	return s / xs.length;
}

export function annualMean(series: ClimateSeries): number {
	return mean(series.stress);
}

/** max - min of per-year means (requires multiple years). */
export function annualRange(series: ClimateSeries): number {
	const y = series.stress;
	const n = y.length;
	const years = Math.floor(n / DAYS_PER_YEAR);
	if (years < 1) return 0;
	const yearMeans: number[] = [];
	for (let yr = 0; yr < years; yr++) {
		const slice = y.slice(yr * DAYS_PER_YEAR, (yr + 1) * DAYS_PER_YEAR);
		yearMeans.push(mean(slice));
	}
	return Math.max(...yearMeans) - Math.min(...yearMeans);
}

/**
 * (max monthly mean − min monthly mean) / 2, averaged across whole years.
 * Uses 12 months of ~30.42 days each within the year.
 */
export function seasonalAmplitude(series: ClimateSeries): number {
	const y = series.stress;
	const n = y.length;
	const years = Math.floor(n / DAYS_PER_YEAR);
	if (years < 1) return 0;
	const amps: number[] = [];
	for (let yr = 0; yr < years; yr++) {
		const start = yr * DAYS_PER_YEAR;
		const monthlyMeans: number[] = [];
		for (let m = 0; m < 12; m++) {
			const a = start + Math.floor((m * DAYS_PER_YEAR) / 12);
			const b = start + Math.floor(((m + 1) * DAYS_PER_YEAR) / 12);
			monthlyMeans.push(mean(y.slice(a, b)));
		}
		amps.push((Math.max(...monthlyMeans) - Math.min(...monthlyMeans)) / 2);
	}
	return mean(amps);
}

/** °C per year via least-squares linear fit on (dayIndex, temp). */
export function trendPerYear(series: ClimateSeries): number {
	const x = series.strain;
	const y = series.stress;
	const n = Math.min(x.length, y.length);
	if (n < 2) return 0;
	const mx = mean(x.slice(0, n));
	const my = mean(y.slice(0, n));
	let num = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		const dx = x[i] - mx;
		num += dx * (y[i] - my);
		den += dx * dx;
	}
	if (den === 0) return 0;
	const slopePerDay = num / den;
	return slopePerDay * DAYS_PER_YEAR;
}

/**
 * Mean temperature during summer months minus annual mean.
 * N hemisphere summer = Jun-Aug, S hemisphere summer = Dec-Feb.
 * Uses approximated month boundaries on a 365-day year.
 */
export function summerAnomaly(
	series: ClimateSeries,
	hemisphere: 'N' | 'S'
): number {
	const y = series.stress;
	const n = y.length;
	const years = Math.floor(n / DAYS_PER_YEAR);
	if (years < 1) return 0;
	// Month indices (0-based) for summer
	const summerMonths = hemisphere === 'N' ? [5, 6, 7] : [11, 0, 1];
	const monthBound = (yrStart: number, m: number) =>
		yrStart + Math.floor((m * DAYS_PER_YEAR) / 12);
	const summerVals: number[] = [];
	for (let yr = 0; yr < years; yr++) {
		const start = yr * DAYS_PER_YEAR;
		for (const m of summerMonths) {
			const a = monthBound(start, m);
			const b = monthBound(start, m + 1);
			for (let i = a; i < b && i < n; i++) summerVals.push(y[i]);
		}
	}
	return mean(summerVals) - annualMean(series);
}

export function extremeHotDays(
	series: ClimateSeries,
	threshold: number
): number {
	let c = 0;
	for (const v of series.stress) if (v > threshold) c++;
	return c;
}

export function extremeColdDays(
	series: ClimateSeries,
	threshold: number
): number {
	let c = 0;
	for (const v of series.stress) if (v < threshold) c++;
	return c;
}

/** Fit T(t) = a + b·t + c·cos(2π·t/365) + d·sin(2π·t/365) to the series by
 *  OLS on the day index. Returns coefficients plus R² and the peak-day of
 *  the seasonal cycle. b is in °C per day — multiply by 365 for °C per year. */
export interface HarmonicFit {
	a: number; // intercept (°C)
	b: number; // linear trend (°C/day)
	c: number; // cosine amplitude
	d: number; // sine amplitude
	amplitude: number; // sqrt(c² + d²)
	phase: number; // atan2(d, c) in radians; peak-day derived from this
	peakDay: number; // 0..364 day-of-year where the annual cycle peaks
	rSquared: number;
}

/** Solve a 4×4 symmetric positive-definite system A·x = y in-place via
 *  Gauss–Jordan elimination with partial pivoting. Returns null if the
 *  system is near-singular (any pivot below `eps`). */
function solve4x4(
	A: number[][],
	y: number[],
	eps = 1e-12
): number[] | null {
	// Build augmented 4×5 matrix.
	const M: number[][] = [];
	for (let i = 0; i < 4; i++) {
		M.push([A[i][0], A[i][1], A[i][2], A[i][3], y[i]]);
	}
	for (let col = 0; col < 4; col++) {
		// Partial pivot.
		let pivot = col;
		let best = Math.abs(M[col][col]);
		for (let r = col + 1; r < 4; r++) {
			const v = Math.abs(M[r][col]);
			if (v > best) {
				best = v;
				pivot = r;
			}
		}
		if (best < eps) return null;
		if (pivot !== col) {
			const tmp = M[col];
			M[col] = M[pivot];
			M[pivot] = tmp;
		}
		// Normalise pivot row.
		const p = M[col][col];
		for (let k = col; k < 5; k++) M[col][k] /= p;
		// Eliminate other rows.
		for (let r = 0; r < 4; r++) {
			if (r === col) continue;
			const f = M[r][col];
			if (f === 0) continue;
			for (let k = col; k < 5; k++) M[r][k] -= f * M[col][k];
		}
	}
	return [M[0][4], M[1][4], M[2][4], M[3][4]];
}

export function fitHarmonicTrend(series: ClimateSeries): HarmonicFit {
	const x = series.strain;
	const y = series.stress;
	const n = Math.min(x.length, y.length);
	const zero: HarmonicFit = {
		a: 0,
		b: 0,
		c: 0,
		d: 0,
		amplitude: 0,
		phase: 0,
		peakDay: 0,
		rSquared: 0
	};
	if (n < 4) return zero;

	const omega = (2 * Math.PI) / DAYS_PER_YEAR;
	// Accumulate normal-equation entries X^T X (4×4) and X^T y (4).
	// Columns of X are [1, t, cos(ωt), sin(ωt)].
	let S1 = 0,
		St = 0,
		Stt = 0,
		Sc = 0,
		Ss = 0,
		Stc = 0,
		Sts = 0,
		Scc = 0,
		Sss = 0,
		Scs = 0;
	let Sy = 0,
		Sty = 0,
		Scy = 0,
		Ssy = 0;
	let Syy = 0;
	let my = 0;
	for (let i = 0; i < n; i++) my += y[i];
	my /= n;
	for (let i = 0; i < n; i++) {
		const t = x[i];
		const yi = y[i];
		const ct = Math.cos(omega * t);
		const st = Math.sin(omega * t);
		S1 += 1;
		St += t;
		Stt += t * t;
		Sc += ct;
		Ss += st;
		Stc += t * ct;
		Sts += t * st;
		Scc += ct * ct;
		Sss += st * st;
		Scs += ct * st;
		Sy += yi;
		Sty += t * yi;
		Scy += ct * yi;
		Ssy += st * yi;
		const dy = yi - my;
		Syy += dy * dy;
	}
	const A: number[][] = [
		[S1, St, Sc, Ss],
		[St, Stt, Stc, Sts],
		[Sc, Stc, Scc, Scs],
		[Ss, Sts, Scs, Sss]
	];
	const rhs = [Sy, Sty, Scy, Ssy];
	const sol = solve4x4(A, rhs);
	if (!sol) return zero;
	const [a, b, c, d] = sol;

	// Residual sum of squares.
	let rss = 0;
	for (let i = 0; i < n; i++) {
		const t = x[i];
		const yhat = a + b * t + c * Math.cos(omega * t) + d * Math.sin(omega * t);
		const r = y[i] - yhat;
		rss += r * r;
	}
	const rSquared = Syy > 0 ? 1 - rss / Syy : 0;
	const amplitude = Math.sqrt(c * c + d * d);
	const phase = Math.atan2(d, c);
	// Peak of a·cos(ωt) + b·sin(ωt) as R·cos(ωt − φ) is at ωt = φ, so
	// peakDay = φ/ω mapped into [0, 365).
	let peakDay = phase / omega;
	peakDay = ((peakDay % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
	return { a, b, c, d, amplitude, phase, peakDay, rSquared };
}

/** Seasonal-cycle amplitude from the harmonic fit, in °C. */
export function harmonicAmplitude(series: ClimateSeries): number {
	return fitHarmonicTrend(series).amplitude;
}

/** Trend per year from the harmonic fit (i.e. b · 365), in °C/yr.
 *  More robust than the simple OLS trendPerYear because it removes the seasonal
 *  cycle rather than absorbing it into residuals. */
export function harmonicTrendPerYear(series: ClimateSeries): number {
	return fitHarmonicTrend(series).b * DAYS_PER_YEAR;
}
