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
