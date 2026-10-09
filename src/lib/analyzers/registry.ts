import type { Domain } from '$lib/datasets';
import * as finance from './finance';
import * as climate from './climate';
import * as battery from './battery';
import { findUTS, findUplLpl, findProofStress } from '$lib/processing';

type Series = { strain: number[]; stress: number[] };
export type ParameterExtractor = (s: Series, meta?: Record<string, unknown>) => number | null;

export interface ParameterDef {
	key: string;
	label: string;
	unit?: string;
	extract: ParameterExtractor;
}

function safe(fn: (s: Series, meta?: Record<string, unknown>) => number | null | undefined): ParameterExtractor {
	return (s, meta) => {
		try {
			const v = fn(s, meta);
			return typeof v === 'number' && Number.isFinite(v) ? v : null;
		} catch {
			return null;
		}
	};
}

const materialsParams: ParameterDef[] = [
	{
		key: 'UTS',
		label: 'Ultimate tensile strength',
		unit: 'MPa',
		extract: safe((s) => findUTS(s).UTS)
	},
	{
		key: 'E',
		label: "Young's modulus",
		unit: 'MPa',
		extract: safe((s) => findUplLpl(s).E)
	},
	{
		key: 'ProofStress',
		label: '0.2% proof stress',
		unit: 'MPa',
		extract: safe((s) => findProofStress(s, findUplLpl(s).E).proofStress)
	}
];

const financeParams: ParameterDef[] = [
	{ key: 'AnnReturn', label: 'Annualized return', extract: safe((s) => finance.annualizedReturn(s)) },
	{ key: 'AnnVol', label: 'Annualized volatility', extract: safe((s) => finance.annualizedVolatility(s)) },
	{ key: 'Sharpe', label: 'Sharpe ratio', extract: safe((s) => finance.sharpeRatio(s)) },
	{
		key: 'MaxDD',
		label: 'Max drawdown',
		extract: safe((s) => finance.maxDrawdown(s).drawdown)
	},
	{ key: 'Skew', label: 'Return skewness', extract: safe((s) => finance.skewness(s)) },
	{ key: 'ExKurt', label: 'Excess kurtosis', extract: safe((s) => finance.kurtosis(s)) },
	{
		key: 'VolCluster',
		label: 'Vol clustering (|r_t| vs |r_t-1|)',
		extract: safe((s) => finance.volClusteringIndex(s))
	}
];

const climateParams: ParameterDef[] = [
	{ key: 'AnnMean', label: 'Annual mean', unit: '°C', extract: safe((s) => climate.annualMean(s)) },
	{
		key: 'SeasAmp',
		label: 'Seasonal amplitude',
		unit: '°C',
		extract: safe((s) => climate.seasonalAmplitude(s))
	},
	{
		key: 'Trend',
		label: 'Trend per year',
		unit: '°C/yr',
		extract: safe((s) => climate.trendPerYear(s))
	},
	{
		key: 'SummerAnom',
		label: 'Summer anomaly',
		unit: '°C',
		extract: safe((s, meta) => climate.summerAnomaly(s, (meta?.hemisphere as 'N' | 'S') ?? 'N'))
	},
	{
		key: 'HotDays30',
		label: 'Days > 30°C',
		extract: safe((s) => climate.extremeHotDays(s, 30))
	},
	{
		key: 'ColdDays0',
		label: 'Days < 0°C',
		extract: safe((s) => climate.extremeColdDays(s, 0))
	},
	{
		key: 'HarmAmp',
		label: 'Harmonic amplitude',
		unit: '°C',
		extract: safe((s) => climate.harmonicAmplitude(s))
	},
	{
		key: 'HarmTrend',
		label: 'Harmonic trend per year',
		unit: '°C/yr',
		extract: safe((s) => climate.harmonicTrendPerYear(s))
	}
];

const batteryParams: ParameterDef[] = [
	{
		key: 'C0',
		label: 'Initial capacity',
		unit: 'Ah',
		extract: safe((s) => battery.initialCapacity(s))
	},
	{
		key: 'Cnow',
		label: 'Current capacity',
		unit: 'Ah',
		extract: safe((s) => battery.currentCapacity(s))
	},
	{
		key: 'FadePerCycle',
		label: 'Fade per cycle',
		unit: 'Ah/cycle',
		extract: safe((s) => battery.fadePerCycle(s))
	},
	{
		key: 'Cyc80',
		label: 'Cycles to 80% SoH',
		extract: safe((s) => battery.cyclesTo80Pct(s))
	},
	{
		key: 'Knee',
		label: 'Knee cycle',
		extract: safe((s) => battery.kneeCycle(s))
	},
	{
		key: 'Ret500',
		label: 'Retention @ cycle 500',
		extract: safe((s) => battery.retentionAt(s, 500))
	},
	{
		key: 'FadeExp',
		label: 'Fade exponent α',
		extract: safe((s) => battery.fadeExponent(s))
	},
	{
		key: 'FadeK',
		label: 'Fade rate constant k',
		extract: safe((s) => battery.fadeRateConstant(s))
	}
];

/** Wording for the series blocks (plot titles, axis labels, help text). The x/y labels
 *  come from the dataset when it carries them; the rest is keyed on the domain. An
 *  imported CSV gets neutral wording built from its column names. */
export interface SeriesLabels {
	/** Eyebrow above the series plot, and its palette label. */
	name: string;
	/** Series plot heading. */
	title: string;
	/** Plural noun for one dataset's series ("curves", "tickers", ...). */
	noun: string;
	x: string;
	y: string;
	/** Palette help text for the series plot. */
	toolHint: string;
	/** Example chat prompt shown in empty states. */
	chatHint: string;
	/** The 0.2% offset line only means something for stress-strain curves. */
	offsetLine: boolean;
}

type LabelSource = { id?: string; domain?: Domain; x_label?: string; y_label?: string };

const DOMAIN_LABELS: Record<Domain, Omit<SeriesLabels, 'offsetLine'>> = {
	materials: {
		name: 'Stress–strain',
		title: 'All tests: stress vs strain',
		noun: 'curves',
		x: 'Strain',
		y: 'Stress (MPa)',
		toolHint: 'Plot all tests σ vs ε, color by any metadata field.',
		chatHint: 'plot stress strain'
	},
	finance: {
		name: 'Price series',
		title: 'All tickers: adjusted close by trading day',
		noun: 'tickers',
		x: 'Trading day',
		y: 'Adjusted close (USD)',
		toolHint: 'Plot every ticker’s adjusted close, color by sector or any metadata field.',
		chatHint: 'plot the price series by sector'
	},
	climate: {
		name: 'Daily temperature',
		title: 'All stations: daily mean temperature',
		noun: 'stations',
		x: 'Day of record',
		y: 'Daily mean temperature (°C)',
		toolHint: 'Plot every station’s daily mean temperature, color by hemisphere or any metadata field.',
		chatHint: 'plot temperature by hemisphere'
	},
	battery: {
		name: 'Capacity fade',
		title: 'All cells: discharge capacity vs cycle',
		noun: 'cells',
		x: 'Cycle number',
		y: 'Discharge capacity (Ah)',
		toolHint: 'Plot every cell’s discharge capacity per cycle, color by any metadata field.',
		chatHint: 'plot capacity fade by batch'
	},
	generic: {
		name: 'Series',
		title: 'All series: y vs x',
		noun: 'series',
		x: 'x',
		y: 'y',
		toolHint: 'Plot every series, color by any metadata field.',
		chatHint: 'plot the series'
	}
};

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function getSeriesLabels(ds: LabelSource | null | undefined): SeriesLabels {
	const domain: Domain = ds?.domain ?? 'materials';
	const offsetLine = domain === 'materials';
	if (ds?.id === 'upload') {
		const x = ds.x_label || 'x';
		const y = ds.y_label || 'y';
		return {
			...DOMAIN_LABELS.generic,
			title: `All series: ${y} vs ${x}`,
			x,
			y,
			offsetLine
		};
	}
	const base = DOMAIN_LABELS[domain];
	return {
		...base,
		x: ds?.x_label ? capitalise(ds.x_label) : base.x,
		y: ds?.y_label ? capitalise(ds.y_label) : base.y,
		offsetLine
	};
}

export function getParameterDefs(domain: Domain | undefined): ParameterDef[] {
	switch (domain) {
		case 'finance':
			return financeParams;
		case 'climate':
			return climateParams;
		case 'battery':
			return batteryParams;
		case 'materials':
		default:
			return materialsParams;
	}
}
