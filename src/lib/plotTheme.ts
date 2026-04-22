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
		return { axis: '#9ca3af', grid: '#27272a', tick: '#3f3f46', label: '#9ca3af' };
	}
	const theme = document.documentElement.getAttribute('data-theme');
	if (theme === 'light') {
		return { axis: '#6b7280', grid: '#e5e4df', tick: '#d0cec7', label: '#4b5563' };
	}
	return { axis: '#9ca3af', grid: '#27272a', tick: '#3f3f46', label: '#9ca3af' };
}
