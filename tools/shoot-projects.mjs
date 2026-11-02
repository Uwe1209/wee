#!/usr/bin/env node
// Screenshots of the user's static project sites, served locally. CDN scripts
// the sandbox can't reach are answered from local copies.
//   node tools/shoot-projects.mjs <name> <url> [--vue path/to/vue.global.js] [--w 1440 --h 900 --wait 1500]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [name, url, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.reduce((pairs, token, i, all) => (token.startsWith('--') ? [...pairs, [token.slice(2), all[i + 1]]] : pairs), []));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(opt.w ?? 1440), height: Number(opt.h ?? 900) }, deviceScaleFactor: 1 });
if (opt.vue) {
  const body = readFileSync(opt.vue, 'utf8');
  await page.route(/unpkg\.com\/vue@3/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body }));
}
if (opt.bootstrap) {
  const css = readFileSync(`${opt.bootstrap}/css/bootstrap.min.css`, 'utf8');
  const js = readFileSync(`${opt.bootstrap}/js/bootstrap.bundle.min.js`, 'utf8');
  await page.route(/cdn\.jsdelivr\.net\/npm\/bootstrap@[^/]+\/dist\/css\/bootstrap\.min\.css/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/bootstrap@[^/]+\/dist\/js\/bootstrap\.bundle\.min\.js/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: js }));
}
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.continue());
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(Number(opt.wait ?? 1500));
const out = `site/assets/img/projects/${name}.jpg`;
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
console.log('wrote', out);
await browser.close();
