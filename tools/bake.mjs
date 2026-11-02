#!/usr/bin/env node
// Bakes every texture in tools/bake/manifest.js to site/assets/tex/<name>.webp
// and writes site/assets/tex/index.json with their sizes.
//
//   node tools/bake.mjs                  # needs `python3 tools/serve.py . 8080` running
//   node tools/bake.mjs --only plaster,strip-mono
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:8080';
const outDir = 'site/assets/tex';
mkdirSync(outDir, { recursive: true });
const indexPath = `${outDir}/index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => console.error('pageerror:', error.message));
page.on('console', (message) => { if (message.type() === 'error') console.error(message.text()); });
await page.exposeFunction('__save', (name, dataUrl, width, height) => {
  writeFileSync(`${outDir}/${name}.webp`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  index[name] = { w: width, h: height };
});
await page.goto(`${base}/tools/bake/index.html${only ? `?only=${only}` : ''}`);
await page.waitForFunction(() => window.__bake?.done, null, { timeout: 600000, polling: 500 });
const report = await page.evaluate(() => window.__bake.report);
writeFileSync(indexPath, `${JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 1)}\n`);
for (const row of report) console.log(row.error ? `${row.name}: ${row.error}` : `${row.name.padEnd(20)} ${row.w}x${row.h}  ${row.ms} ms`);
await browser.close();
