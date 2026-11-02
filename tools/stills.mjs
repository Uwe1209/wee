#!/usr/bin/env node
// Captures still frames from a page once it reports ready.
//
//   node tools/stills.mjs --out shot.png --url "http://localhost:8080/workbench/style-frames/?dir=a"
//   node tools/stills.mjs --url http://localhost:8080/site/ --states hero,flash --out-dir workbench/rounds/r1
//
// --ready is a JS expression polled until truthy (default: __frame or __app ready).
// --states drives window.__app.goto(name) and writes <out-dir>/<state>.png for each.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, token, index, all) => {
    if (token.startsWith('--')) pairs.push([token.slice(2), all[index + 1]?.startsWith('--') ? true : all[index + 1]]);
    return pairs;
  }, []),
);
const width = Number(args.w ?? 1920);
const height = Number(args.h ?? 1080);
const dpr = Number(args.dpr ?? 1);
const ready = args.ready ?? '(window.__frame && window.__frame.ready) || (window.__app && window.__app.ready)';
const timeout = Number(args.timeout ?? 180000);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
const problems = [];
page.on('console', (message) => {
  if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
});
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

const started = Date.now();
await page.goto(args.url, { waitUntil: 'load', timeout });
await page.waitForFunction(ready, null, { timeout, polling: 250 });

if (args.states) {
  const dir = args['out-dir'] ?? '.';
  mkdirSync(dir, { recursive: true });
  for (const raw of String(args.states).split(',')) {
    const state = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    await page.evaluate((name) => window.__app.goto(name), state);
    await page.waitForFunction(ready, null, { timeout, polling: 100 });
    const file = join(dir, `${raw}.png`);
    await page.screenshot({ path: file });
    console.log(`wrote ${file}`);
  }
} else {
  mkdirSync(dirname(args.out), { recursive: true });
  await page.screenshot({ path: args.out });
  console.log(`wrote ${args.out}`);
}

const info = await page.evaluate(() => window.__frame ?? window.__app?.info ?? null);
console.log(`ready after ${Date.now() - started} ms`, info ? JSON.stringify(info) : '');
if (problems.length) console.log(problems.slice(0, 20).join('\n'));
await browser.close();
