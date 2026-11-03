// Every texture the site uses, baked once by `node tools/bake.mjs` into
// site/assets/tex/. Each entry draws a canvas with the shared paper kit.
import {
  fbm, loadImage, makeCanvas, paperCanvas, plaster, random, risograph, roughRect, stickerCanvas, tapeCanvas,
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

// A project card made of type alone, for projects with no screenshot yet:
// a riso-printed title card on instant-photo stock, with a handwritten lip.
const typeCard = (title, lines, {
  width = 900, ratio = 0.62, ink = '#0078bf', accent = '#ff48b0', caption = '', seed = 91,
} = {}) => {
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
  // The accent band sits below the last line of text, never under it.
  const textBottom = 232 + (lines.length - 1) * 56 + 22;
  const bandTop = Math.max(textBottom + 34, Math.round(inner.height * 0.74));
  ictx.fillStyle = accent;
  ictx.fillRect(0, bandTop, inner.width, inner.height - bandTop);
  const rand = random(seed);
  ictx.fillStyle = ink;
  for (let y = bandTop + 8; y < inner.height; y += 9) {
    for (let x = 6 + ((y / 9) % 2) * 4.5; x < inner.width; x += 9) {
      ictx.beginPath();
      ictx.arc(x, y, 1.1 + rand() * 0.6, 0, Math.PI * 2);
      ictx.fill();
    }
  }
  // Title with a little misregistration, the way the opening's "Liew" sits.
  ictx.font = '800 108px "Bricolage Grotesque"';
  ictx.fillStyle = accent;
  ictx.fillText(title, 50, 154);
  ictx.fillStyle = ink;
  ictx.fillText(title, 46, 150);
  ictx.font = '600 40px "JetBrains Mono"';
  lines.forEach((line, i) => ictx.fillText(line.toUpperCase(), 50, 232 + i * 56));
  ictx.globalCompositeOperation = 'source-over';
  ctx.drawImage(inner, side, top);
  if (caption) {
    ctx.save();
    ctx.translate(width / 2, top + ih + bottom * 0.52);
    ctx.rotate((rand() - 0.5) * 0.04);
    ctx.fillStyle = INK;
    ctx.font = CAPTION;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 0, 0);
    ctx.restore();
  }
  return canvas;
};

const instant = (p, key, caption, options = {}) => instantPhoto(p[key], { width: 860, caption, font: CAPTION, ink: INK, ...options });
const riso = (p, key, w, h, options = {}) => cutOut(risograph(p[key], w, h, { cell: 6, inks: [PINK, BLUE], ...options }), { seed: options.seed ?? 9 });

// Window light: two columns of panes, mullions, leaves along one side, softened.
// `rows` is each row's pane height (px, top to bottom). `nudge` moves single
// leaves ({ index: [dx, dy] } px) without reseeding the rest.
const windowGobo = ({ blur = 9, leaves = 60, nudge = {}, rows = [240, 240, 240], bridges = [], open = [] } = {}) => {
  const canvas = makeCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = '#fff';
  const pane = { x: 170, y: 120, w: 300, bar: 30 };
  let top = pane.y;
  for (const h of rows) {
    for (let col = 0; col < 2; col += 1) ctx.fillRect(pane.x + col * (pane.w + pane.bar), top, pane.w, h);
    top += h + pane.bar;
  }
  // A bridge [col, row] fills the bar under that row in that column, so the
  // two panes either side of it read as one tall pane.
  for (const [col, row] of bridges) {
    const barTop = pane.y + rows.slice(0, row + 1).reduce((sum, h) => sum + h, 0) + row * pane.bar;
    ctx.fillRect(pane.x + col * (pane.w + pane.bar), barTop, pane.w, pane.bar);
  }
  // Extra light: [x, y, w, h] rects opened in the frame (for example to thin a bar).
  for (const [x, y, w, h] of open) ctx.fillRect(x, y, w, h);
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

// Photo-album corner mount: a pocket of glossy black paper whose front is a
// right triangle, right angle at the top left (the scene turns a copy to each
// corner). The long edge is the pocket's lip and catches the light; `pad`
// leaves room for a soft contact shadow.
const photoCorner = (size = 256, { pad = 19, seed = 43 } = {}) => {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const leg = size - pad * 2;
  const pocket = () => {
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad + leg, pad);
    ctx.lineTo(pad, pad + leg);
    ctx.closePath();
  };
  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = 'rgba(46, 28, 14, 0.4)';
  pocket();
  ctx.fill();
  ctx.restore();
  pocket();
  ctx.fillStyle = '#1b1512';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1b1512';
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const sheen = ctx.createLinearGradient(pad, pad, pad + leg * 0.5, pad + leg * 0.5);
  sheen.addColorStop(0, 'rgba(255, 238, 218, 0.1)');
  sheen.addColorStop(0.6, 'rgba(255, 238, 218, 0.01)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  // The lip, wide enough to survive being drawn ~40 px across.
  ctx.strokeStyle = 'rgba(176, 154, 134, 0.7)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(pad + leg - 9, pad + 3);
  ctx.lineTo(pad + 3, pad + leg - 9);
  ctx.stroke();
  ctx.restore();
  const rand = random(seed);
  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (rand() - 0.5) * 9;
    image.data[i] += n;
    image.data[i + 1] += n;
    image.data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

// Ballpoint straight onto the plaster, the way you'd write on an album page:
// handwritten lines (gone over once, `weight` units thicker, so they hold up
// when the wall is drawn small) and a hand-drawn arrow. Positions are in wall
// units from the top left, at `scale` px per unit. Transparent around the ink.
const wallNote = ({ w, h, lines, arrow, scale = 400, size = 0.24, weight = 0.008, ink = INK, seed = 47 }) => {
  const canvas = makeCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  const px = ([x, y]) => [x * scale, y * scale];
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.font = `600 ${Math.round(size * scale)}px Caveat`;
  ctx.lineWidth = weight * scale;
  lines.forEach(({ text, at }) => {
    ctx.fillText(text, ...px(at));
    ctx.strokeText(text, ...px(at));
  });
  const { from, bend, to, head = 0.08 } = arrow;
  ctx.lineWidth = 0.022 * scale;
  ctx.beginPath();
  ctx.moveTo(...px(from));
  ctx.quadraticCurveTo(...px(bend), ...px(to));
  ctx.stroke();
  const back = Math.atan2(bend[1] - to[1], bend[0] - to[0]);
  const barb = (turn) => px([to[0] + Math.cos(back + turn) * head, to[1] + Math.sin(back + turn) * head]);
  ctx.beginPath();
  ctx.moveTo(...barb(0.5));
  ctx.lineTo(...px(to));
  ctx.lineTo(...barb(-0.45));
  ctx.stroke();
  // The ball skips a little on the plaster's tooth.
  const rand = random(seed);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] *= 0.88 + 0.12 * rand();
  ctx.putImageData(image, 0, 0);
  return canvas;
};

// Floorboards for the projects room: planks run down the hall (texture v),
// `plank` px wide, with staggered butt joints, long grain streaks, a slower
// figure, and dark seams. Mirrored repeat keeps the grain continuous.
const floorboards = (width = 1024, height = 2048, { plank = 128, seed = 77 } = {}) => {
  const rand = random(seed);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const boards = Array.from({ length: Math.ceil(width / plank) }, () => {
    const list = [];
    for (let y = -rand() * 1100; y < height; y += 700 + rand() * 900) list.push({ y, tone: rand(), grain: rand() * 100 });
    return list;
  });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const column = Math.floor(x / plank);
      const across = x - column * plank;
      const list = boards[column];
      let k = list.length - 1;
      while (k > 0 && list[k].y > y) k -= 1;
      const board = list[k];
      const streak = fbm(x / 3 + board.grain, y / 90, { octaves: 3, seed: 5 });
      const figure = fbm(x / 40 + board.grain, y / 300, { octaves: 2, seed: 9 });
      let shade = 0.8 + board.tone * 0.3 + (streak - 0.5) * 0.4 + (figure - 0.5) * 0.3;
      const seam = Math.min(across, plank - 1 - across);
      if (seam < 2) shade *= 0.3;
      else if (seam < 5) shade *= 0.82;
      const butt = Math.min(y - board.y, k + 1 < list.length ? list[k + 1].y - y : Infinity);
      if (butt < 2) shade *= 0.35;
      const i = (y * width + x) * 4;
      image.data[i] = 128 * shade;
      image.data[i + 1] = 86 * shade;
      image.data[i + 2] = 56 * shade;
      image.data[i + 3] = 255;
    }
  }
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
  // Kraft masking tape for the flash strip: warmer and darker than the cream, so
  // it reads against the strip's white border and the sunlit wall (the bar's tape).
  'tape-masking': { make: () => tapeCanvas(360, 104, { color: 'rgba(204,166,112,0.8)', seed: 73 }) },
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
  // The strip's empty spot: an album corner mount (one per corner), a
  // ballpoint note under the spot (1.15 × 1.0 wall units, laid out in the
  // spot's own frame: x from -0.02, y down from -1.38), and the window light
  // with the one leaf that fell across the spot nudged right (until the flash).
  'photo-corner': { make: () => photoCorner() },
  'note-spot': {
    make: () => wallNote({
      w: 1.15,
      h: 1.0,
      lines: [{ text: 'the photo', at: [0.1, 0.64] }, { text: 'lands here!', at: [0.15, 0.93] }],
      arrow: { from: [0.27, 0.42], bend: [0.08, 0.33], to: [0.12, 0.05] },
    }),
  },
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
  'card-kacha': { make: (p) => instant(p, 'kacha', 'kacha! a photobooth', { ratio: 1.0, pose: { zoom: 1.9 }, seed: 103 }) },
  'card-haojia': { make: () => typeCard('HaoJia HR', ['teams · outlets · workers', 'work-pass expiry alerts', 'phase one, in progress'], { caption: 'haojia hr, still building', seed: 104 }) },
  'card-petaid': { make: () => typeCard('PetAid', ['first aid for pets', 'owners · vets · admins', 'react + express'], { ink: '#ff48b0', accent: '#0078bf', caption: 'petaid', seed: 105 }) },
  'card-herbarium': { make: (p) => instant(p, 'herbarium', 'herbarium project', { ratio: 0.6, pose: { focusX: 0 }, seed: 106 }) },
  'card-aws': { make: (p) => instant(p, 'aws', 'AWS, drawn properly', { ratio: 0.8, seed: 107 }) },
  'card-bar': { make: (p) => instant(p, 'bar', 'Bar: drinks shop', { ratio: 0.62, seed: 108 }) },
  'card-lemon': { make: (p) => instant(p, 'lemon', 'little lemon', { ratio: 0.62, seed: 109 }) },
  'room-floor': { make: () => floorboards(), quality: 0.86 },

  // --- scrapbook
  // gamma > 1 thins the dots, so the team reads in light paper, not a purple slab.
  'gators-riso': { make: (p) => riso(p, 'gators', 900, 675, { seed: 21, gamma: 1.55 }) },
  'ticket-outreach': {
    make: () => ticketStub({
      serial: 'Nº 110426',
      seed: 23,
      lines: [
        { text: 'OUTREACH', font: '800 112px "Bricolage Grotesque"', x: 0.06, y: 0.5 },
        { text: 'SSDC DODGEBALL · TUNKU PUTRA-HELP', font: '700 26px "JetBrains Mono"', x: 0.065, y: 0.7 },
        { text: '11 APRIL 2026 — FACILITATOR', font: '500 25px "JetBrains Mono"', x: 0.065, y: 0.83, color: '#ff48b0' },
      ],
    }),
  },
  'game-riso': { make: (p) => riso(p, 'game', 900, 600, { seed: 22 }) },
  'team-instant': { make: (p) => instant(p, 'team', 'outreach crew', { ratio: 0.8, seed: 110 }) },
  'certificate-instant': { make: (p) => instant(p, 'certificate', 'facilitator! 11 april', { ratio: 1.2, pose: { focusY: 0.32 }, seed: 111 }) },
  'coaching-instant': { make: (p) => instant(p, 'coaching', 'warm-ups first', { ratio: 1.3, pose: { focusY: 0.34 }, seed: 112 }) },
  // The desk's window light: a taller middle pane, so the bar under it falls
  // below the text column (down in the page's bottom-left corner) for the whole pin.
  'gobo-desk': { make: () => windowGobo({ rows: [240, 310, 170] }), quality: 0.9 },

  // --- contact
  'strip-contact': {
    make: (p) => photoStrip([
      { image: p.coaching, focusY: 0.31 }, { image: p.certificate, focusY: 0.3 },
      { image: p.poster, zoom: 1.75, focusX: 0.75, focusY: 0.4 }, { image: p.portrait, focusY: 0.44 },
    ], { look: 'color', stamp: "'26 11 02", seed: 9 }),
  },
  // The contact note sits between the strip and the links; its ballpoint arrow
  // leaves the note's left end and hooks up and left, at the email.
  'note-hello': {
    make: () => {
      const canvas = makeCanvas(500, 190);
      const ctx = canvas.getContext('2d');
      roughRect(ctx, 6, 6, 488, 178, { jitter: 2.5, step: 12, seed: 53 });
      ctx.fillStyle = '#fbf6ea';
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.strokeStyle = INK;
      ctx.font = '600 80px Caveat';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('say hi!', 330, 102);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(196, 128);
      ctx.quadraticCurveTo(110, 150, 52, 58);
      ctx.stroke();
      const back = Math.atan2(150 - 58, 110 - 52);
      ctx.beginPath();
      ctx.moveTo(52 + Math.cos(back + 0.55) * 34, 58 + Math.sin(back + 0.55) * 34);
      ctx.lineTo(52, 58);
      ctx.lineTo(52 + Math.cos(back - 0.5) * 34, 58 + Math.sin(back - 0.5) * 34);
      ctx.stroke();
      return canvas;
    },
  },
  // The dusk window, thrown at a grazing angle: the left column is one tall pane
  // (both bars bridged), widened to the left, so the call to action sits in one
  // long patch of sun; the right column's bars and leaves rake across the strip.
  'gobo-dusk': { make: () => windowGobo({ rows: [220, 280, 220], bridges: [[0, 0], [0, 1]], open: [[60, 120, 110, 880], [170, 900, 300, 100]] }), quality: 0.9 },

  // --- the wall: about
  // The about window: the left column is one tall pane (both its bars gone) so
  // the copy column rises in sun, the mullion is thinned to 14 px so it fits
  // the gap between the copy and the cluster, and the leaf that fell on the
  // portrait (5) is moved out of the frame. The right column's middle pane
  // holds the cluster, with its two bars just above and below it. The wall
  // cross-fades into this window, so nothing switches.
  'gobo-about': {
    make: () => windowGobo({ bridges: [[0, 0], [0, 1]], open: [[470, 120, 8, 780], [492, 120, 8, 780]], nudge: { 5: [0, 2000] } }),
    quality: 0.9,
  },
};
