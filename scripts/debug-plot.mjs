import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext(devices['iPhone 13']);
const page = await ctx.newPage();
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log(`[pageerror]`, e.message));
await page.goto('http://localhost:8080/');
await page.click('button:has-text("Basic Usage")');
await page.waitForURL('**/prepare');
await page.waitForTimeout(2500);

const inspect = await page.evaluate(() => {
	const p = window.__plot;
	const data = window.__data;
	if (!p) return { err: 'no plot on window' };
	const scales = p.scales;
	const seriesMeta = p.series.slice(0, 4).map((s) => ({
		label: s.label,
		show: s.show,
		stroke: typeof s.stroke === 'function' ? 'fn' : s.stroke,
		width: s.width,
		alpha: s.alpha,
		hasPaths: !!s.paths,
		_paths: s._paths ? { stroke: !!s._paths.stroke, fill: !!s._paths.fill } : null
	}));
	return {
		scales: {
			x: { min: scales.x?.min, max: scales.x?.max, distr: scales.x?.distr, time: scales.x?.time },
			y: { min: scales.y?.min, max: scales.y?.max, distr: scales.y?.distr }
		},
		data0_len: data?.[0]?.length,
		data1_len: data?.[1]?.length,
		data1_sample: data?.[1]?.slice(0, 5),
		nSeries: p.series.length,
		seriesMeta,
		valToPos_example: {
			x_0: p.valToPos(0, 'x', true),
			y_100: p.valToPos(100, 'y', true)
		},
		over: { width: p.over?.clientWidth, height: p.over?.clientHeight }
	};
});
console.log('INSPECT:', JSON.stringify(inspect, null, 2));

await browser.close();
