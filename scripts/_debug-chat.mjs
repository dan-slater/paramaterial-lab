import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const html = await page.evaluate(() => {
  const aside = document.querySelector('aside');
  return { asides: document.querySelectorAll('aside').length, testid: document.querySelector('[data-testid="chat-mode"]')?.outerHTML ?? null, bodyStart: document.body.innerHTML.slice(0, 800) };
});
console.log(JSON.stringify(html, null, 2));
console.log('errors:', errors.slice(0, 5));
await browser.close();
