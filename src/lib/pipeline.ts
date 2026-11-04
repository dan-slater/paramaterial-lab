/**
 * Report pipeline: processing blocks (Trim → Foot correction → Screen) transform
 * the dataset for every block below them, in report order, the way the thesis
 * notebook processes a DataSet. Pure functions, no Svelte, so scripts can run them.
 *
 * Values a step measures are carried on each test's meta under `pm:` keys (the
 * lab's version of paramaterial's info-table columns UTS_1, E, foot correction …),
 * so a later step or parameter can use them the way the notebook does: UTS is
 * measured before the trim, proof stress uses the E from the foot correction.
 */

import type { Dataset, Test } from './datasets.ts';
import {
	correctFoot,
	findProofStress,
	findUplLpl,
	findUplLplPreload,
	findUTS,
	trimCurve,
	type TrimOptions
} from './processing.ts';

export const PROCESSING_TYPES = ['trim', 'foot-correction', 'screen'] as const;
export type ProcessingType = (typeof PROCESSING_TYPES)[number];

/** Carried meta keys. Kept out of info_columns; shown in tooltips only on request. */
export const PM = {
	UTS: 'pm:UTS',
	strainAtUTS: 'pm:strainAtUTS',
	fractureStrain: 'pm:fractureStrain',
	E: 'pm:E',
	footShift: 'pm:footShift',
	footFailed: 'pm:footFailed'
} as const;

export function isCarriedKey(k: string): boolean {
	return k.startsWith('pm:');
}

/** Processing steps act on stress–strain data only; other domains pass through. */
export function processingApplies(ds: Dataset | null | undefined): boolean {
	return !!ds && (ds.domain ?? 'materials') === 'materials';
}

interface StageBlock {
	type: string;
	config: Record<string, unknown>;
}

/** True when this block changes the data below it. A foot-correction block only
 *  applies its shift when `config.apply === true`: blocks seeded by the shipped
 *  templates (no `apply` key) stay the per-test diagnostic they were. */
export function isActiveStage(b: StageBlock): boolean {
	if (b.type === 'trim' || b.type === 'screen') return true;
	if (b.type === 'foot-correction') return b.config.apply === true;
	return false;
}

/** The config fields that change a stage's output (not view state like the inspected test). */
export function stageKey(b: StageBlock): string {
	const c = b.config;
	switch (b.type) {
		case 'trim': {
			const t = trimConfig(c);
			return `trim:${t.maxStrain}:${t.minStrain}:${t.stressFloor}:${t.cut}`;
		}
		case 'foot-correction':
			return `foot:${footPreload(c)}`;
		case 'screen':
			return `screen:${screenRejected(c).slice().sort().join(',')}`;
		default:
			return b.type;
	}
}

// ---- config readers (defaults mirror the notebook) ---------------------------

const num = (v: unknown, d: number | null): number | null =>
	v === null ? null : typeof v === 'number' && Number.isFinite(v) ? v : d;

export const TRIM_DEFAULTS: Required<TrimOptions> = {
	maxStrain: 0.01,
	minStrain: null,
	stressFloor: null,
	cut: 'none'
};

export function trimConfig(c: Record<string, unknown>): Required<TrimOptions> {
	const cut = c.cut === 'uts' || c.cut === 'fracture' ? c.cut : 'none';
	return {
		maxStrain: 'maxStrain' in c ? num(c.maxStrain, TRIM_DEFAULTS.maxStrain) : TRIM_DEFAULTS.maxStrain,
		minStrain: num(c.minStrain, null),
		stressFloor: num(c.stressFloor, null),
		cut
	};
}

export const FOOT_DEFAULT_PRELOAD = 36;
export function footPreload(c: Record<string, unknown>): number {
	return num(c.preload, FOOT_DEFAULT_PRELOAD) ?? FOOT_DEFAULT_PRELOAD;
}

export function screenRejected(c: Record<string, unknown>): string[] {
	return Array.isArray(c.rejected) ? c.rejected.filter((x): x is string => typeof x === 'string') : [];
}

// ---- stages -------------------------------------------------------------------

function withTests(ds: Dataset, tests: Test[]): Dataset {
	return { ...ds, tests };
}

/** Trim every test. UTS and fracture strain are measured on the untrimmed curve
 *  first (notebook: find_UTS / find_fracture_point before the trim) and carried. */
export function applyTrim(ds: Dataset, opts: Required<TrimOptions>): Dataset {
	return withTests(
		ds,
		ds.tests.map((t) => {
			const meta = { ...t.meta };
			if (meta[PM.UTS] == null && t.stress.length) {
				const u = findUTS(t);
				meta[PM.UTS] = u.UTS;
				meta[PM.strainAtUTS] = u.strainAtUTS;
				let mx = -Infinity;
				for (const e of t.strain) if (e > mx) mx = e;
				meta[PM.fractureStrain] = mx;
			}
			const c = trimCurve(t, opts);
			return { ...t, meta, strain: c.strain, stress: c.stress };
		})
	);
}

/** find_upl_and_lpl(preload) + correct_foot on every test. A test whose fit fails
 *  passes through unshifted and is marked so the Screen block can flag it. */
export function applyFoot(ds: Dataset, preload: number): Dataset {
	return withTests(
		ds,
		ds.tests.map((t) => {
			const fit = findUplLplPreload(t, preload);
			if (!fit || !Number.isFinite(fit.strainShift)) {
				return { ...t, meta: { ...t.meta, [PM.footFailed]: true } };
			}
			const c = correctFoot(t, fit);
			return {
				...t,
				meta: { ...t.meta, [PM.E]: fit.E, [PM.footShift]: -fit.strainShift },
				strain: c.strain,
				stress: c.stress
			};
		})
	);
}

export function applyScreen(ds: Dataset, rejected: string[]): Dataset {
	if (!rejected.length) return ds;
	const out = new Set(rejected);
	return withTests(
		ds,
		ds.tests.filter((t) => !out.has(t.test_id))
	);
}

export function applyStage(b: StageBlock, ds: Dataset): Dataset {
	if (!processingApplies(ds)) return ds;
	switch (b.type) {
		case 'trim':
			return applyTrim(ds, trimConfig(b.config));
		case 'foot-correction':
			return applyFoot(ds, footPreload(b.config));
		case 'screen':
			return applyScreen(ds, screenRejected(b.config));
		default:
			return ds;
	}
}

// ---- parameters that respect carried values ---------------------------------

type Series = { strain: number[]; stress: number[] };
const carried = (meta: Record<string, unknown> | undefined, k: string): number | null => {
	const v = meta?.[k];
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

/** UTS: measured before any trim when a Trim block ran, else the curve maximum. */
export function utsOf(s: Series, meta?: Record<string, unknown>): number {
	return carried(meta, PM.UTS) ?? findUTS(s).UTS;
}

/** E: the foot-correction fit when one ran (notebook: E_key='E'), else the
 *  sliding-window fit the analyzers have always used. */
export function modulusOf(s: Series, meta?: Record<string, unknown>): number {
	return carried(meta, PM.E) ?? findUplLpl(s).E;
}

export function proofStressOf(s: Series, meta?: Record<string, unknown>, offset = 0.002): number {
	return findProofStress(s, modulusOf(s, meta), offset).proofStress;
}

// ---- screening flags --------------------------------------------------------

export const MIN_POINTS = 20;

export interface ScreenFlag {
	test_id: string;
	reasons: string[];
}

function median(v: number[]): number {
	const s = v.slice().sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Group key for the E check: test type and temperature when the dataset has
 *  them (E falls with temperature, so a global median flags every hot test). */
function eGroup(t: Test): string {
	const type = t.meta.test_type ?? t.meta['test type'] ?? '';
	const temp = t.meta.temperature ?? t.meta.temp ?? '';
	return `${type}|${temp}`;
}

/** Below / above this fraction of its group's median E, a test is flagged. */
export const E_BAND: [number, number] = [0.75, 1.33];

/** Suggested rejections (never applied on their own): too few points, foot fit
 *  failed, E not positive or outside E_BAND × the median E of its temperature
 *  group, proof stress not found or ≈ 0. */
export function screenFlags(tests: Test[]): Map<string, string[]> {
	const out = new Map<string, string[]>();
	const add = (id: string, r: string) => {
		const a = out.get(id);
		if (a) a.push(r);
		else out.set(id, [r]);
	};
	const groups = new Map<string, Array<[string, number]>>();
	for (const t of tests) {
		if (t.strain.length < MIN_POINTS) {
			add(t.test_id, `${t.strain.length} points`);
			continue;
		}
		if (t.meta[PM.footFailed]) add(t.test_id, 'foot fit failed');
		let E = NaN;
		try {
			E = modulusOf(t, t.meta);
		} catch {
			/* E stays NaN */
		}
		if (!Number.isFinite(E) || E <= 0) add(t.test_id, 'E ≤ 0');
		else {
			const g = eGroup(t);
			const arr = groups.get(g);
			if (arr) arr.push([t.test_id, E]);
			else groups.set(g, [[t.test_id, E]]);
		}
		let ps = NaN;
		try {
			if (Number.isFinite(E) && E > 0) ps = proofStressOf(t, t.meta);
		} catch {
			/* ps stays NaN */
		}
		if (!Number.isFinite(ps)) add(t.test_id, 'no proof stress');
		else if (ps <= 0.5) add(t.test_id, 'proof stress ≈ 0');
	}
	for (const members of groups.values()) {
		if (members.length < 4) continue;
		const med = median(members.map(([, e]) => e));
		for (const [id, e] of members) {
			if (e < E_BAND[0] * med) add(id, 'E low for group');
			else if (e > E_BAND[1] * med) add(id, 'E high for group');
		}
	}
	return out;
}
