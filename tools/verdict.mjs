#!/usr/bin/env node
// Records a critic's verdict for one round and updates workbench/progress.json.
//
//   node tools/verdict.mjs <element> <round> --score 6.5 --gap "the single biggest gap" [--notes "..."]
//   node tools/verdict.mjs <element> --final "met the bar at 8.5"      # closes the element
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [id, roundArg, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const all = [roundArg, ...rest];
  return all.includes(`--${name}`) ? all[all.indexOf(`--${name}`) + 1] : undefined;
};
const progressPath = 'workbench/progress.json';
const progress = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, 'utf8')) : { elements: {} };
const entry = progress.elements[id] ?? { rounds: [], status: 'open' };

if (flag('final')) {
  entry.status = 'done';
  entry.final = flag('final');
} else {
  const round = Number(roundArg);
  const score = Number(flag('score'));
  const gap = flag('gap');
  if (!round || Number.isNaN(score) || !gap) {
    console.error('usage: verdict.mjs <element> <round> --score N --gap "..." [--notes "..."]');
    process.exit(1);
  }
  const dir = `workbench/rounds/${id}/r${round}`;
  const verdict = { element: id, round, score, gap, notes: flag('notes') ?? '', at: new Date().toISOString() };
  writeFileSync(`${dir}/verdict.json`, `${JSON.stringify(verdict, null, 1)}\n`);
  const capture = existsSync(`${dir}/capture.json`) ? JSON.parse(readFileSync(`${dir}/capture.json`, 'utf8')) : {};
  entry.rounds = entry.rounds.filter((r) => r.round !== round);
  entry.rounds.push({ ...verdict, compare: `rounds/${id}/r${round}/compare.jpg`, strip: capture.strip?.length ? `rounds/${id}/r${round}/strip.jpg` : null });
  entry.rounds.sort((a, b) => a.round - b.round);
  entry.status = 'open';
}
progress.elements[id] = entry;
progress.updated = new Date().toISOString();
writeFileSync(progressPath, `${JSON.stringify(progress, null, 1)}\n`);
console.log(JSON.stringify(entry.rounds.map((r) => [r.round, r.score])), entry.status);
