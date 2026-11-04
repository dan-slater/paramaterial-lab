// Theme-aware plot colors sourced from the current `data-theme`.
// Read once at plot time; components already re-render on theme toggle.

export interface PlotTheme {
	axis: string;
	grid: string;
	tick: string;
	label: string;
}

export function getPlotTheme(): PlotTheme {
	if (typeof document === 'undefined') {
		return { axis: '#6b7280', grid: '#e5e4df', tick: '#d0cec7', label: '#4b5563' };
	}
	const theme = document.documentElement.getAttribute('data-theme');
	if (theme === 'dark') {
		return { axis: '#9ca3af', grid: '#27272a', tick: '#3f3f46', label: '#9ca3af' };
	}
	return { axis: '#6b7280', grid: '#e5e4df', tick: '#d0cec7', label: '#4b5563' };
}

/** The plasma ramp the stress–strain plot colours tests with. */
export const PLASMA = [
	'#6a00a8', '#8f0da4', '#b12a90', '#cc4778',
	'#e16462', '#f2844b', '#fca636', '#fcce25', '#f0f921'
];

/** Colour for one test's value of `key` among all tests (numeric → ramp, else categorical). */
export function plasmaColorFor(value: unknown, all: unknown[]): string {
	const nums = all.map(Number).filter((v) => !Number.isNaN(v));
	if (nums.length && !Number.isNaN(Number(value))) {
		let min = Infinity, max = -Infinity;
		for (const v of nums) { if (v < min) min = v; if (v > max) max = v; }
		const t = max === min ? 0.5 : (Number(value) - min) / (max - min);
		const idx = Math.min(PLASMA.length - 1, Math.max(0, Math.floor(t * (PLASMA.length - 1))));
		return PLASMA[idx];
	}
	const unique = Array.from(new Set(all.map(String)));
	return PLASMA[unique.indexOf(String(value)) % PLASMA.length];
}
