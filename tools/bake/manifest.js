// Every texture the site uses, baked once by `node tools/bake.mjs` into
// site/assets/tex/. Each entry draws a canvas with the shared paper kit.
import {
  loadImage, makeCanvas, paperCanvas, plaster, random, risograph, roughRect, stickerCanvas, tapeCanvas,
} from '../../site/js/lib/paper.js';
import { instantPhoto, photoStrip, ticketStub } from '../../site/js/lib/prints.js';

const IMG = '../../site/assets/img/';
const INK = '#1f2c66';
const CAPTION = '600 66px Caveat';
const PINK = { color: '#ff48b0', channel: (r, g, b) => 1 - (0.15 * r + 0.55 * g + 0.3 * b), angle: 0.26, offset: [0, 0] };
const BLUE = { color: '#0078bf', channel: (r, g, b) => 1 - (0.62 * r + 0.3 * g + 0.08 * b), angle: 1.31, offset: [3, 2] };

const PHOTOS = {
  portrait: 'portrait.jpg',
  poster: 'memories/spex-poster.jpg',
  certificate: 'memories/certificate.jpg',
  coaching: 'memories/coaching.jpg',
  gators: 'memories/gators.jpg',
  stage: 'memories/uriis-stage.jpg',
  pitch: 'memories/uriis-pitch.jpg',
  game: 'memories/game.jpg',
  team: 'memories/outreach-team.jpg',
  spexMap: 'projects/spex-map.jpg',
  kacha: 'projects/kacha-camera.jpg',
  herbarium: 'projects/herbarium.jpg',
  aws: 'projects/aws-architecture.jpg',
  bar: 'projects/bar.jpg',
  lemon: 'projects/little-lemon.jpg',
};

export const loadPhotos = async () => Object.fromEntries(
  await Promise.all(Object.entries(PHOTOS).map(async ([key, file]) => [key, await loadImage(IMG + file)])),
);

const memoryFrames = (p) => [
  { image: p.portrait, zoom: 1.0, focusX: 0.5, focusY: 0.44 },
  { image: p.poster, zoom: 1.75, focusX: 0.75, focusY: 0.4 },
  { image: p.certificate, zoom: 1.0, focusX: 0.5, focusY: 0.3 },
  { image: p.coaching, zoom: 1.0, focusX: 0.5, focusY: 0.31 },
];

const cutOut = (source, { pad = 28, seed = 3 } = {}) => {
  const canvas = makeCanvas(source.width + pad * 2, source.height + pad * 2);
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, { jitter: 3, step: 9, seed });
  ctx.fillStyle = '#fbf8f1';
  ctx.fill();
  ctx.drawImage(source, pad, pad);
  return canvas;
};

// Torn paper note with a handwritten line or two.
const note = (lines, { width = 640, font = '600 70px Caveat', ink = INK, seed = 51, lineHeight = 1.05, paper = '#fbf6ea' } = {}) => {
  const rows = Array.isArray(lines) ? lines : [lines];
  const size = parseInt(font.match(/(\d+)px/)[1], 10);
  const height = Math.round(size * lineHeight * rows.length + size * 1.1);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 6, 6, width - 12, height - 12, { jitter: 2.5, step: 12, seed });
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = height / 2 - ((rows.length - 1) * size * lineHeight) / 2;
  rows.forEach((row, i) => ctx.fillText(row, width / 2, top + i * size * lineHeight + 4));
  return canvas;
};

// Ruled index card: a mono heading, then handwritten lines.
const indexCard = (heading, lines, { width = 980, seed = 61, font = '600 54px Caveat' } = {}) => {
  const lineGap = 64;
  const height = 150 + lines.length * lineGap + 50;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 4, 4, width - 8, height - 8, { jitter: 1.2, step: 16, seed });
  ctx.fillStyle = '#fbf8f0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,72,176,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 118);
  ctx.lineTo(width, 118);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,120,191,0.28)';
  ctx.lineWidth = 2;
  for (let y = 118 + lineGap; y < height; y += lineGap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#2a1a10';
  ctx.font = '700 30px "JetBrains Mono"';
  ctx.fillText(heading.toUpperCase(), 48, 80);
  ctx.fillStyle = INK;
  ctx.font = font;
  lines.forEach((line, i) => ctx.fillText(line, 48, 118 + lineGap * (i + 1) - 14));
  return canvas;
};

// Round riso badge: big number or word, small ring text.
const badge = (big, small, { size = 420, ink = '#ff48b0', paper = '#fff3f9', bigFont = '800 150px "Bricolage Grotesque"', seed = 81 } = {}) => {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size / 2 - 10;
  const rand = random(seed);
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 60) {
    const wobble = r + (rand() - 0.5) * 3;
    ctx.lineTo(size / 2 + Math.cos(a) * wobble, size / 2 + Math.sin(a) * wobble);
  }
  ctx.closePath();
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = bigFont;
  ctx.fillText(big, size / 2, size / 2 - 8);
  ctx.font = '700 30px "JetBrains Mono"';
  ctx.fillText(small.toUpperCase(), size / 2, size / 2 + 92);
  return canvas;
};

// A project card made of type alone, for projects with no screenshot yet.
const typeCard = (title, lines, { width = 900, ratio = 0.62, ink = '#0078bf', accent = '#ff48b0', seed = 91 } = {}) => {
  const side = Math.round(width * 0.06);
  const top = Math.round(width * 0.07);
  const bottom = Math.round(width * 0.25);
  const ih = Math.round((width - side * 2) * ratio);
  const canvas = makeCanvas(width, top + ih + bottom);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8f5ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const inner = makeCanvas(width - side * 2, ih);
  const ictx = inner.getContext('2d');
  ictx.fillStyle = '#f6f1e6';
  ictx.fillRect(0, 0, inner.width, inner.height);
  ictx.globalCompositeOperation = 'multiply';
  ictx.fillStyle = accent;
  ictx.fillRect(0, inner.height * 0.62, inner.width, inner.height * 0.38);
  ictx.fillStyle = ink;
  ictx.font = '800 108px "Bricolage Grotesque"';
  ictx.fillText(title, 46, 150);
  ictx.font = '600 40px "JetBrains Mono"';
  lines.forEach((line, i) => ictx.fillText(line.toUpperCase(), 50, 232 + i * 56));
  ictx.globalCompositeOperation = 'source-over';
  ctx.drawImage(inner, side, top);
  return canvas;
};

const instant = (p, key, caption, options = {}) => instantPhoto(p[key], { width: 860, caption, font: CAPTION, ink: INK, ...options });
const riso = (p, key, w, h, options = {}) => cutOut(risograph(p[key], w, h, { cell: 6, inks: [PINK, BLUE], ...options }), { seed: options.seed ?? 9 });

// Window light: two columns of panes, mullions, leaves along one side, softened.
// `nudge` moves single leaves ({ index: [dx, dy] } px) without reseeding the rest.
const windowGobo = ({ blur = 9, leaves = 60, nudge = {} } = {}) => {
  const canvas = makeCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = '#fff';
  const pane = { x: 170, y: 120, w: 300, h: 240, bar: 30 };
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) ctx.fillRect(pane.x + col * (pane.w + pane.bar), pane.y + row * (pane.h + pane.bar), pane.w, pane.h);
  }
  const rand = random(5);
  ctx.fillStyle = '#000';
  for (let k = 0; k < leaves; k += 1) {
    ctx.save();
    const [nx, ny] = nudge[k] ?? [0, 0];
    ctx.translate(560 + rand() * 520 + nx, rand() * 1024 + ny);
    ctx.rotate(rand() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 + rand() * 34, 8 + rand() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const soft = makeCanvas(1024, 1024);
  const sctx = soft.getContext('2d');
  sctx.filter = `blur(${blur}px)`;
  sctx.drawImage(canvas, 0, 0);
  return soft;
};

// Faint pencil ticks at the corners of a w × h px rectangle, gone over twice,
// marking where something will be stuck. Transparent around the strokes.
const cornerTicks = (w, h, { arm = 64, pad = 14, seed = 41 } = {}) => {
  const canvas = makeCanvas(w + pad * 2, h + pad * 2);
  const ctx = canvas.getContext('2d');
  const rand = random(seed);
  const wobble = (size) => (rand() - 0.5) * size;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgb(58, 54, 52)';
  [[0, 0], [w, 0], [w, h], [0, h]].forEach(([x, y]) => {
    const sx = x ? -1 : 1;
    const sy = y ? -1 : 1;
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.globalAlpha = pass ? 0.4 : 0.72;
      ctx.lineWidth = pass ? 2.6 : 3.6;
      const over = 4 + rand() * 6;
      ctx.beginPath();
      ctx.moveTo(pad + x - sx * over, pad + y + wobble(2));
      ctx.lineTo(pad + x + sx * arm * (0.85 + rand() * 0.3), pad + y + wobble(3));
      ctx.moveTo(pad + x + wobble(2), pad + y - sy * over);
      ctx.lineTo(pad + x + wobble(3), pad + y + sy * arm * 1.3 * (0.85 + rand() * 0.3));
      ctx.stroke();
    }
  });
  // Graphite skips on the plaster's tooth.
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] *= 0.55 + 0.45 * rand();
  ctx.putImageData(image, 0, 0);
  return canvas;
};

// name -> { make(photos) -> canvas, type, quality }
export const TEXTURES = {
  // --- surfaces and light
  gobo: { make: () => windowGobo(), quality: 0.9 },
  'window-panes': { make: () => windowGobo({ blur: 2, leaves: 24 }), quality: 0.9 },
  plaster: { make: () => plaster(2048, 1252, { base: [236, 224, 205] }).color, quality: 0.86 },
  'plaster-n': { make: () => plaster(2048, 1252, { base: [236, 224, 205] }).normal, quality: 0.94 },
  paper: { make: () => paperCanvas(2048, 1260, { base: [245, 240, 229], grid: { step: 34, dot: 1.5, color: 'rgba(0,120,191,0.22)' } }), quality: 0.86 },

  // --- tape and stickers
  'tape-cream': { make: () => tapeCanvas(360, 104, { color: 'rgba(233,221,190,0.82)', seed: 71 }) },
  'tape-pink': { make: () => tapeCanvas(360, 104, { color: 'rgba(255,120,190,0.8)', stripes: 'rgba(255,255,255,0.55)', seed: 11 }) },
  'tape-blue': { make: () => tapeCanvas(360, 104, { color: 'rgba(120,180,240,0.8)', stripes: 'rgba(255,255,255,0.45)', seed: 12 }) },
  'tape-yellow': { make: () => tapeCanvas(360, 104, { color: 'rgba(255,214,90,0.82)', seed: 13 }) },
  'sticker-star': { make: () => stickerCanvas('star', 220, '#ffc83d', { seed: 1 }) },
  'sticker-heart': { make: () => stickerCanvas('heart', 220, '#ff5fa2', { seed: 2 }) },
  'sticker-sparkle': { make: () => stickerCanvas('sparkle', 220, '#3d7bf0', { seed: 3 }) },
  'sticker-star-pink': { make: () => stickerCanvas('star', 220, '#ff5fa2', { seed: 4 }) },
  'badge-cgpa': { make: () => badge('3.49', 'cgpa · y3s2', { ink: '#0078bf', paper: '#eef6fc' }) },
  'badge-top5': { make: () => badge('TOP 5', 'uriis 2026', { bigFont: '800 112px "Bricolage Grotesque"' }) },
  'ticket-admit': {
    make: () => ticketStub({
      lines: [
        { text: 'ADMIT ONE', font: '800 132px "Bricolage Grotesque"', x: 0.06, y: 0.52 },
        { text: 'PHOTOBOOTH · KUCHING, SARAWAK', font: '700 30px "JetBrains Mono"', x: 0.065, y: 0.72 },
        { text: '4 POSES — RM 0 — KEEP THIS ONE', font: '500 25px "JetBrains Mono"', x: 0.065, y: 0.84, color: '#ff48b0' },
      ],
    }),
  },

  // --- the wall: hello
  'poster-instant': { make: (p) => instant(p, 'poster', 'SPEX poster day!', { ratio: 1.24, pose: { zoom: 1.35, focusX: 0.66, focusY: 0.45 }, seed: 40 }) },
  'strip-color': { make: (p) => photoStrip(memoryFrames(p), { look: 'color', stamp: "'26 11 02", seed: 8 }) },
  'stage-riso': { make: (p) => riso(p, 'stage', 900, 600) },
  'note-uriis': { make: () => note('URIIS 2026 · top 5') },
  'gators-instant': { make: (p) => instant(p, 'gators', 'gators dc, rawr', { ratio: 0.75, seed: 44 }) },
  // The strip's empty spot: pencil ticks at 360 px per wall unit (0.70 × 3.10),
  // a waiting piece of masking tape, and the window light with the one leaf
  // that fell across the spot nudged right (used until the flash).
  'spot-ticks': { make: () => cornerTicks(252, 1116) },
  'tape-masking': { make: () => tapeCanvas(360, 104, { color: 'rgba(222,197,146,0.86)', seed: 73 }) },
  'gobo-hello': { make: () => windowGobo({ nudge: { 5: [20, 0] } }), quality: 0.9 },

  // --- the flash: the fresh strip, black and white
  'strip-mono': { make: (p) => photoStrip(memoryFrames(p), { look: 'mono', stamp: "'26 11 02", label: 'YOU WEE LIEW  ·  KUCHING  ·  02 11 26', seed: 4 }) },

  // --- the wall: about
  'portrait-instant': { make: (p) => instant(p, 'portrait', 'me (official version)', { ratio: 1.24, pose: { zoom: 1.0, focusY: 0.44 }, seed: 46 }) },
  'card-swinburne': {
    make: () => indexCard('Swinburne University of Technology Sarawak', [
      'Bachelor of Computer Science', '2024 — now  ·  year 3, sem 2', 'final year!',
    ], { seed: 62 }),
  },
  'card-courses': {
    make: () => indexCard('Coursework', [
      'cloud computing architecture', 'advanced web development', 'interface design & development',
      'software dev for mobile devices', 'software deployment & evolution', 'software architectures & design',
      'software testing & reliability',
    ], { seed: 63, font: '600 48px Caveat' }),
  },
  'note-looking': { make: () => note(['looking for: a full-stack role', 'frontend · backend · database'], { width: 860, font: '600 62px Caveat', seed: 52 }) },

  // --- projects
  'card-spex': { make: (p) => instant(p, 'spexMap', 'SPEX: catch it in the animals', { ratio: 0.7, seed: 101 }) },
  'card-buildup': { make: (p) => instant(p, 'pitch', 'BuildUp at URIIS 2026', { ratio: 0.66, pose: { zoom: 1.15, focusX: 0.52, focusY: 0.42 }, seed: 102 }) },
  'card-kacha': { make: (p) => instant(p, 'kacha', 'kacha! a photobooth', { ratio: 1.0, seed: 103 }) },
  'card-haojia': { make: () => typeCard('HaoJia HR', ['teams · outlets · workers', 'work-pass expiry alerts', 'row-level security'], { seed: 104 }) },
  'card-petaid': { make: () => typeCard('PetAid', ['first aid for pets', 'owners · vets · admins', 'react + express'], { ink: '#ff48b0', accent: '#0078bf', seed: 105 }) },
  'card-herbarium': { make: (p) => instant(p, 'herbarium', 'herbarium project', { ratio: 0.6, seed: 106 }) },
  'card-aws': { make: (p) => instant(p, 'aws', 'AWS, drawn properly', { ratio: 0.8, seed: 107 }) },
  'card-bar': { make: (p) => instant(p, 'bar', 'Bar: drinks shop', { ratio: 0.62, seed: 108 }) },
  'card-lemon': { make: (p) => instant(p, 'lemon', 'little lemon', { ratio: 0.62, seed: 109 }) },

  // --- scrapbook
  'gators-riso': { make: (p) => riso(p, 'gators', 900, 675, { seed: 21 }) },
  'game-riso': { make: (p) => riso(p, 'game', 900, 600, { seed: 22 }) },
  'team-instant': { make: (p) => instant(p, 'team', 'outreach crew', { ratio: 0.8, seed: 110 }) },
  'certificate-instant': { make: (p) => instant(p, 'certificate', 'facilitator! 11 april', { ratio: 1.2, pose: { focusY: 0.32 }, seed: 111 }) },
  'coaching-instant': { make: (p) => instant(p, 'coaching', 'warm-ups first', { ratio: 1.3, pose: { focusY: 0.34 }, seed: 112 }) },

  // --- contact
  'strip-contact': {
    make: (p) => photoStrip([
      { image: p.coaching, focusY: 0.31 }, { image: p.certificate, focusY: 0.3 },
      { image: p.poster, zoom: 1.75, focusX: 0.75, focusY: 0.4 }, { image: p.portrait, focusY: 0.44 },
    ], { look: 'color', stamp: "'26 11 02", seed: 9 }),
  },
  'note-hello': { make: () => note('say hi! ↓', { width: 420, font: '600 76px Caveat', seed: 53 }) },
};
