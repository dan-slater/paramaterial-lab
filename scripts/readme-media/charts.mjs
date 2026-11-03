import { chromium } from 'playwright';
import fs from 'fs';
const OUT = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
await p.goto('https://paramaterial.danielslater.dev/', { waitUntil: 'networkidle' });
console.log(await p.evaluate(() => {
  const g = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return { font: c.fontFamily, color: c.color, bg: c.backgroundColor, bgi: c.backgroundImage }; };
  return { body: g('body'), h1: g('h1'), logo: g('header a span, header a div'), links: [...document.querySelectorAll('link[rel=stylesheet],link[href*=font]')].map(l => l.href) };
}));
await p.getByRole('button', { name: /Materials — Uniaxial Tension/ }).click();
await p.waitForTimeout(500);
await p.getByRole('button', { name: /Stress–strain$/ }).click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: /Parameter scatter/ }).click();
await p.waitForTimeout(800);
const s = p.locator('select:has(option[value="param:ProofStress"])');
await s.nth(0).selectOption('param:ProofStress'); await s.nth(1).selectOption('meta:temperature');
await p.waitForTimeout(800);
await p.addStyleTag({ content: '.fixed, [class*="sticky"] { display:none !important }' });
const canv = p.locator('canvas');
console.log('canvases', await canv.count());
// screenshot the chart frames (parent of the uPlot root)
const frames = p.locator('.uplot');
console.log('uplots', await frames.count());
await frames.nth(0).screenshot({ path: OUT + 'curves.png', omitBackground: true });
await frames.nth(1).screenshot({ path: OUT + 'scatter.png', omitBackground: true });
await b.close();
