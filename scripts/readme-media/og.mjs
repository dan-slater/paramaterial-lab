import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 })).newPage();
const dir = new URL('./', import.meta.url).pathname;
const [opts, repos] = [process.argv[2]?.split(',') || ['p2'], process.argv[3]?.split(',') || ['lab','pkg']];
for (const o of opts) for (const r of repos) {
  await p.goto(`file://${dir}og.html?opt=${o}&repo=${r}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}out/og-${o}-${r}.png` });
}
await b.close();
