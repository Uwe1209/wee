#!/usr/bin/env node
// Frame-perfect film of the full scroll.
//
//   node tools/film.mjs --out workbench/film/full.mp4 --w 1920 --h 1080 --dpr 1
//   node tools/film.mjs --out /tmp/fast.mp4 --w 960 --h 540            # fast low-res pass
//   node tools/film.mjs --out /tmp/smoke.mp4 --w 480 --h 270 --limit 30  # smoke test (first 30 frames)
//   node tools/film.mjs --out /tmp/range.mp4 --w 960 --h 540 --from 900 --to 1100  # frames [900, 1100) of the full plan
//
// A range jumps to the plan's value --pre frames (default 90) before --from and
// plays those frames unrecorded, so the damped scroll arrives at --from moving
// exactly as it does in the full film. The .json log keeps the full-plan frame
// number as `g` next to the film-local `f`.
//
// Playwright's fake clock is paused once the page is ready, so time only moves
// when we say: exactly one 16 ms animation frame per video frame. Scroll is fed
// as an exact fractional value (window.__app.setScroll) and only on frames where
// it changes. Frames are PNG piped into x264 (crf 13, yuv420p, faststart).
//
// Pacing: hold 6 s on the intro, scroll at ~0.75 vh/s, slow to ~0.4 vh/s
// through the signature moments, with speed ramps at least 0.5 vh long.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, i, all) => (token.startsWith('--') ? [...pairs, [token.slice(2), all[i + 1]]] : pairs), []));
const width = Number(args.w ?? 1920);
const height = Number(args.h ?? 1080);
const dpr = Number(args.dpr ?? 1);
const out = args.out ?? 'workbench/film/full.mp4';
const base = args.base ?? 'http://localhost:8080';
const site = args.site ?? 'site';
const crf = args.crf ?? '13';
const FRAME_MS = 16;
const FPS = 60;

// Slow zones (vh): the flash, the three chapter transitions.
const SLOW = [[1.0, 3.3], [6.1, 6.85], [10.8, 11.5], [12.9, 13.55]];
const RAMP = 0.5;
const FAST = 0.75;
const SLOWEST = 0.4;
const smooth = (t) => t * t * (3 - 2 * t);
const slowness = (v) => Math.max(...SLOW.map(([a, b]) => {
  if (v >= a && v <= b) return 1;
  const d = v < a ? a - v : v - b;
  return d >= RAMP ? 0 : smooth(1 - d / RAMP);
}));
const speed = (v) => FAST - (FAST - SLOWEST) * slowness(v);

const plan = (total, holdStart = 6, holdEnd = 2) => {
  const frames = [];
  const dt = 1 / FPS;
  for (let i = 0; i < holdStart * FPS; i += 1) frames.push(0);
  // Ease out of the hold over 0.5 s so the first move isn't a jolt.
  let v = 0;
  let ramp = 0;
  while (v < total) {
    ramp = Math.min(1, ramp + dt / 0.5);
    v = Math.min(total, v + speed(v) * smooth(ramp) * dt);
    frames.push(v);
  }
  for (let i = 0; i < holdEnd * FPS; i += 1) frames.push(total);
  return frames;
};

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (error) => problems.push(error.message));
await page.clock.install({ time: new Date('2026-11-02T17:00:00+08:00') });
await page.goto(`${base}/${site}/index.html?capture&dpr=${dpr}`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__app?.ready, null, { timeout: 300000, polling: 250 });
await page.clock.pauseAt(new Date('2026-11-02T17:10:00+08:00'));
const total = await page.evaluate(() => window.__app.layout.total);
await page.evaluate(() => window.__app.restart());

const fullPlan = plan(total);
const from = Number(args.from ?? 0);
const to = args.to !== undefined ? Number(args.to) : args.limit ? from + Number(args.limit) : fullPlan.length;
const schedule = fullPlan.slice(from, to);
if (from > 0) {
  const pre = Math.min(from, Number(args.pre ?? 90));
  await page.evaluate((v) => window.__app.goto(v), fullPlan[from - pre]);
  for (let f = from - pre; f < from; f += 1) {
    await page.evaluate((v) => window.__app.setScroll(v), fullPlan[f]);
    await page.clock.runFor(FRAME_MS);
  }
  console.log(`film: pre-rolled ${pre} frames from v ${fullPlan[from - pre].toFixed(3)}`);
}
console.log(`film: ${schedule.length} frames (${(schedule.length / FPS).toFixed(1)} s) at ${width * dpr}x${height * dpr}`);
const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });

const log = [];
let last = from > 0 ? fullPlan[from - 1] : -1;
const started = Date.now();
for (let f = 0; f < schedule.length; f += 1) {
  const target = schedule[f];
  if (target !== last) {
    await page.evaluate((v) => window.__app.setScroll(v), target);
    last = target;
  }
  await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), f * FRAME_MS);
  await page.clock.runFor(FRAME_MS);
  const png = await page.screenshot({ type: 'png' });
  if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
  const state = await page.evaluate(() => window.__app.scroll());
  log.push({ f, g: f + from, target: +target.toFixed(4), v: +state.v.toFixed(4) });
  if (f % 120 === 0) {
    const rate = (f + 1) / ((Date.now() - started) / 1000);
    console.log(`frame ${f}/${schedule.length}  v ${state.v.toFixed(2)}  ${rate.toFixed(2)} fps  eta ${((schedule.length - f) / rate / 60).toFixed(1)} min`);
  }
}
ffmpeg.stdin.end();
await new Promise((resolve) => ffmpeg.on('close', resolve));
writeFileSync(out.replace(/\.mp4$/, '.json'), `${JSON.stringify({ width, height, dpr, fps: FPS, frameMs: FRAME_MS, frames: log, problems }, null, 0)}\n`);
console.log(`wrote ${out} in ${((Date.now() - started) / 60000).toFixed(1)} min (${((Date.now() - started) / schedule.length).toFixed(0)} ms/frame)${problems.length ? `, ${problems.length} page errors` : ''}`);
await browser.close();
