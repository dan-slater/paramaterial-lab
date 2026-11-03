// Record the lab walkthrough as timestamped frames.
// usage: node scripts/readme-media/record.mjs <A|B|C> [outdir]
// A = whole app 1280x800, B = report only 960x600, C = B + step captions
import { chromium } from 'playwright';
import fs from 'fs';

const OPT = process.argv[2] || 'B';
const OUT = process.argv[3] || new URL(`./out/frames-${OPT}`, import.meta.url).pathname;
const BASE = 'https://paramaterial.danielslater.dev';
const VIEW = OPT === 'A' ? { width: 1280, height: 800 } : { width: 960, height: 600 };
const CAPTIONS = OPT === 'C';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

// ---- overlay: fake cursor + optional caption pill -------------------------
const OVERLAY = `
(() => {
  if (document.getElementById('rec-cursor')) return;
  const c = document.createElement('div');
  c.id = 'rec-cursor';
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6.9 3.9 7.4-2.7 1.4-3.9-7.5L4 20z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999, pointerEvents: 'none',
    transform: 'translate(${VIEW.width * 0.55}px, ${VIEW.height * 0.6}px)', transition: 'transform 650ms cubic-bezier(.4,0,.2,1)',
    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' });
  document.body.appendChild(c);
  const r = document.createElement('div');
  r.id = 'rec-ripple';
  Object.assign(r.style, { position: 'fixed', width: '34px', height: '34px', marginLeft: '-17px', marginTop: '-17px', borderRadius: '50%',
    border: '2px solid #e879f9', zIndex: 99998, pointerEvents: 'none', opacity: 0, transition: 'opacity 350ms, transform 350ms' });
  document.body.appendChild(r);
  const cap = document.createElement('div');
  cap.id = 'rec-cap';
  Object.assign(cap.style, { position: 'fixed', right: '16px', top: '64px', zIndex: 99997, pointerEvents: 'none',
    font: '600 15px/1.2 Inter, system-ui, sans-serif', color: '#fff', background: 'rgba(192,38,211,.92)',
    padding: '8px 14px', borderRadius: '999px', boxShadow: '0 4px 16px rgba(0,0,0,.5)', opacity: 0, transition: 'opacity 300ms' });
  document.body.appendChild(cap);
})();`;
const cur = { x: VIEW.width * 0.55, y: VIEW.height * 0.6 };
async function overlay() { await page.evaluate(OVERLAY); await page.evaluate(([x, y]) => { const c = document.getElementById('rec-cursor'); c.style.transition = 'none'; c.style.transform = `translate(${x}px,${y}px)`; c.offsetHeight; c.style.transition = 'transform 650ms cubic-bezier(.4,0,.2,1)'; }, [cur.x, cur.y]); }
async function caption(text) {
  if (!CAPTIONS) return;
  await page.evaluate(t => { const c = document.getElementById('rec-cap'); c.textContent = t; c.style.opacity = t ? 1 : 0; }, text);
}
async function moveTo(loc, dx = 0.5, dy = 0.5) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  cur.x = b.x + b.width * dx; cur.y = b.y + b.height * dy;
  await page.evaluate(([x, y]) => { document.getElementById('rec-cursor').style.transform = `translate(${x - 4}px,${y - 2}px)`; }, [cur.x, cur.y]);
  await page.waitForTimeout(700);
}
async function ripple() {
  await page.evaluate(([x, y]) => { const r = document.getElementById('rec-ripple'); r.style.transition = 'none'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = 1; r.style.transform = 'scale(.4)'; r.offsetHeight; r.style.transition = 'opacity 450ms, transform 450ms'; r.style.opacity = 0; r.style.transform = 'scale(1.3)'; }, [cur.x, cur.y]);
  await page.waitForTimeout(180);
}
async function click(loc, dx, dy) { await moveTo(loc, dx, dy); await ripple(); await loc.click(); }
async function choose(sel, value) { await moveTo(sel, 0.75); await ripple(); await sel.selectOption(value); await page.waitForTimeout(250); }
// smooth scroll of the report pane so `loc` ends near `frac` of the viewport height
async function scrollTo(loc, frac = 0.12, ms = 1000) {
  const top = await loc.evaluate(e => e.getBoundingClientRect().top);
  await page.evaluate(async ([delta, ms]) => {
    const s = document.querySelector('.overflow-y-auto'); const y0 = s.scrollTop; const t0 = performance.now();
    await new Promise(res => { const step = t => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; s.scrollTop = y0 + delta * e; k < 1 ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
  }, [top - VIEW.height * frac, ms]);
  await page.waitForTimeout(100);
}
const hold = ms => page.waitForTimeout(ms);

// ---- capture loop ----------------------------------------------------------
let recording = false; const frames = []; let n = 0;
async function captureLoop() {
  while (recording) {
    const t = Date.now();
    const buf = await page.screenshot({ type: 'png' }).catch(() => null);
    if (buf) { const f = `${OUT}/f${String(n++).padStart(5, '0')}.png`; fs.writeFileSync(f, buf); frames.push({ t, f }); }
  }
}

// ---- the walkthrough --------------------------------------------------------
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await overlay();
await page.evaluate(() => document.fonts.ready);
recording = true; const loop = captureLoop(); const T0 = Date.now(); const marks = [];
const mark = s => marks.push([s, Date.now() - T0]);

mark('home');
await caption('1 · Pick a dataset');
await hold(900);
await click(page.getByRole('button', { name: /Materials — Uniaxial Tension/ }), 0.3, 0.4);
await page.waitForTimeout(700);
await overlay();
mark('add-curves');
await caption('2 · Add blocks');
await click(page.getByRole('button', { name: /Stress–strain$/ }));
await page.waitForTimeout(600);
await scrollTo(page.getByText(/stress vs strain/i).first(), 0.10, 900);
await hold(1700);

mark('scatter');
await click(page.getByRole('button', { name: /Parameter scatter/ }));
await page.waitForTimeout(600);
const ySel = page.locator('select:has(option[value="param:ProofStress"])').nth(0);
const xSel = page.locator('select:has(option[value="param:ProofStress"])').nth(1);
await scrollTo(ySel, 0.30, 1200);
await caption('3 · Scatter a parameter against a condition');
await choose(ySel, 'param:ProofStress');
await choose(xSel, 'meta:temperature');
await moveTo(page.locator('canvas').last(), 0.62, 0.45);
await hold(2600);

mark('import');
await caption('4 · Or import your own CSV');
await scrollTo(page.getByText('Laboratory report').first(), 0, 900);
await click(page.getByRole('button', { name: 'Change dataset' }));
await page.waitForTimeout(400);
await overlay();
await scrollTo(page.getByText(/import your own/i).first(), 0.15, 1000);
await click(page.getByRole('button', { name: /one tension test/ }));
await hold(1300);
await click(page.getByRole('button', { name: 'Import', exact: true }));
await page.waitForTimeout(600);
await overlay();
mark('imported');
await caption('Parsed in your browser');
await hold(600);
await scrollTo(page.locator('canvas').first(), 0.30, 900);
await hold(2600);
mark('end');

recording = false; await loop;
fs.writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ T0, frames, marks, view: VIEW }, null, 0));
console.log(`${frames.length} frames over ${((Date.now() - T0) / 1000).toFixed(1)}s, marks`, marks, 'errors', errors);
await browser.close();
