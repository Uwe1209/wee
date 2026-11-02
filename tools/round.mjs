#!/usr/bin/env node
// One critic capture for one element, from a frozen snapshot of the site.
//
//   node tools/round.mjs <element>              # next round number
//   node tools/round.mjs <element> --round 3
//
// 1. copies site/ to workbench/rounds/<element>/r<N>/snapshot (frozen; the
//    code copy also serves as the backup of that round)
// 2. captures the element's named states and its scroll strip from the snapshot
// 3. writes <state>.jpg, strip.jpg (contact sheet), compare.jpg (bar beside frames)
//    and capture.json
// Needs `python3 tools/serve.py . 8080` running.
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { chromium } = createRequire(import.meta.url)('playwright');
const [id, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : fallback);
const base = flag('base', 'http://localhost:8080');
const { elements, bar } = JSON.parse(readFileSync('workbench/elements.json', 'utf8'));
const element = elements.find((e) => e.id === id);
if (!element) {
  console.error(`unknown element ${id}. Known: ${elements.map((e) => e.id).join(', ')}`);
  process.exit(1);
}

const root = `workbench/rounds/${id}`;
mkdirSync(root, { recursive: true });
const done = readdirSync(root).filter((name) => /^r\d+$/.test(name)).map((name) => Number(name.slice(1)));
const round = Number(flag('round', (done.length ? Math.max(...done) : 0) + 1));
const dir = `${root}/r${round}`;
if (existsSync(`${dir}/capture.json`) && !rest.includes('--force')) {
  console.error(`${dir} already captured; pass --force to redo`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });
rmSync(`${dir}/snapshot`, { recursive: true, force: true });
cpSync('site', `${dir}/snapshot`, { recursive: true });

const [width, height, dpr = 1] = element.viewport ?? [1920, 1080, 1];
const query = `capture&dpr=${dpr}${element.query ? `&${element.query}` : ''}`;
const url = `${base}/${dir}/snapshot/index.html?${query}`;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

const started = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__app?.ready, null, { timeout: 300000, polling: 250 });

const shoot = async (state, file) => {
  await page.evaluate((s) => window.__app.goto(s), state);
  await page.waitForFunction(() => window.__app.ready, null, { timeout: 120000, polling: 100 });
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
};

const frames = [];
for (const state of element.states ?? []) {
  const file = `${dir}/${String(state).replace(/[^\w.-]/g, '_')}.jpg`;
  await shoot(state, file);
  frames.push(file);
}
const strip = [];
if (element.strip) {
  const { from, to, count } = element.strip;
  for (let i = 0; i < count; i += 1) {
    const v = +(from + ((to - from) * i) / (count - 1)).toFixed(3);
    const file = `${dir}/strip-${String(i).padStart(2, '0')}-v${v}.jpg`;
    await shoot(v, file);
    strip.push(file);
  }
}
const failed = await page.evaluate(() => window.__app.failed?.() ?? []);
await browser.close();

const sheet = (out, files, cols, labels) => execFileSync('python3', ['tools/sheet.py', out, ...files, '--cols', String(cols), '--width', '640', ...(labels ? ['--labels', labels.join(',')] : [])]);
if (strip.length) sheet(`${dir}/strip.jpg`, strip, 4, strip.map((f) => f.match(/v[\d.]+/)[0]));
const barFiles = (element.bar ?? []).map((name) => (name === 'art-bible' ? bar : name)).filter((f) => existsSync(f));
if (frames.length) sheet(`${dir}/compare.jpg`, [...barFiles, ...frames], Math.min(3, barFiles.length + frames.length), [...barFiles.map(() => 'BAR'), ...element.states.map(String)]);

// Keep the code as this round's backup; drop the heavy asset copy.
rmSync(`${dir}/snapshot/assets`, { recursive: true, force: true });
rmSync(`${dir}/snapshot/vendor`, { recursive: true, force: true });

const capture = { element: id, round, url, viewport: [width, height, dpr], frames, strip, failed, problems: problems.slice(0, 20), ms: Date.now() - started, at: new Date().toISOString() };
writeFileSync(`${dir}/capture.json`, `${JSON.stringify(capture, null, 1)}\n`);
console.log(JSON.stringify({ dir, frames: frames.length, strip: strip.length, failed, problems: problems.length, seconds: Math.round(capture.ms / 1000) }));
