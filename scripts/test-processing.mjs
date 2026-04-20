import { readFileSync } from 'node:fs';
import { findUTS, findE, findUplLpl, findProofStress } from '../src/lib/processing.ts';

const raw = JSON.parse(readFileSync(new URL('../static/data/basic-usage.json', import.meta.url)));
for (const t of raw.tests.slice(0, 3)) {
	const c = { strain: t.strain, stress: t.stress };
	const foot = findUplLpl(c);
	const { E } = findE(c, foot.uplIdx, foot.lplIdx);
	const uts = findUTS(c);
	const ps = findProofStress(c, E, 0.002);
	console.log(t.test_id, { UTS: uts.UTS.toFixed(2), E: E.toFixed(1), PS: ps.proofStress.toFixed(2) });
}
