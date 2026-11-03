// temp probe: stills plus a frame with the about copy shifted back to the r4 layout
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const states = process.argv[3].split(',');
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
await page.goto('http://localhost:8080/site/index.html?capture&dpr=1', { waitUntil: 'load', timeout: 300000 });
const ready = () => window.__app && window.__app.ready;
await page.waitForFunction(ready, null, { timeout: 300000, polling: 250 });
for (const s of states) {
  await page.evaluate((v) => window.__app.goto(v), Number(s));
  await page.waitForFunction(ready, null, { timeout: 300000, polling: 100 });
  const op = await page.evaluate(() => [...document.querySelectorAll('body > canvas')].map((c) => c.style.opacity).join('|'));
  console.log(s, 'canvas opacities', op);
  await page.screenshot({ path: `${out}/${s}.png`, timeout: 300000 });
}
// shift the about copy 0.3 vh later (as in r4) and re-shoot the peak
for (const s of ['6.22', '6.3', '6.38']) {
  await page.evaluate(() => { for (const b of document.querySelectorAll('[data-block^="about-"]')) b.style.top = `${parseFloat(b.style.top) + 0.3 * window.innerHeight}px`; });
  await page.evaluate((v) => window.__app.goto(v), Number(s));
  await page.waitForFunction(ready, null, { timeout: 300000, polling: 100 });
  await page.screenshot({ path: `${out}/${s}-r4layout.png`, timeout: 300000 });
  await page.evaluate(() => { for (const b of document.querySelectorAll('[data-block^="about-"]')) b.style.top = `${parseFloat(b.style.top) - 0.3 * window.innerHeight}px`; });
  console.log('wrote', s, 'r4layout');
}
console.log('problems', problems);
await browser.close();
