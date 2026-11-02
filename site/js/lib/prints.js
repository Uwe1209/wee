// Printed keepsakes built on 2D canvases: photobooth strips, instant photos,
// ticket stubs. Each returns a canvas that becomes a texture.
import {
  dateStamp, developing, drawCover, dust, grain, makeCanvas, mapPixels, monochrome, random, risograph, roughRect,
} from './paper.js';

const PAPER = { mono: '#f3f1ea', color: '#fbf6ec', riso: '#f6f1e6' };

const frameVignette = (ctx, x, y, w, h, strength = 0.35) => {
  const gradient = ctx.createRadialGradient(x + w / 2, y + h * 0.45, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
};

const warmColor = (ctx, x, y, w, h, { fade = 0.06, warmth = 1 } = {}) => {
  mapPixels(ctx, x, y, w, h, (r, g, b) => {
    const lift = 255 * fade;
    return [
      lift + r * (1 - fade) * (1 + 0.04 * warmth),
      lift * 0.95 + g * (1 - fade),
      lift * 0.8 + b * (1 - fade) * (1 - 0.08 * warmth),
    ];
  });
};

export const POSES = [
  { zoom: 1.0, focusX: 0.5, focusY: 0.44 },
  { zoom: 1.12, focusX: 0.46, focusY: 0.42, rotate: -0.05 },
  { zoom: 1.42, focusX: 0.5, focusY: 0.4 },
  { zoom: 1.05, focusX: 0.54, focusY: 0.45, rotate: 0.04 },
];

// A photobooth strip. `source` is one image (shot four times with POSES) or a
// list of frames, each { image, zoom, focusX, focusY, rotate }.
// `look` is mono, color or riso.
export const photoStrip = (source, {
  look = 'mono', width = 640, poses = POSES, develop = 1, stamp = null, label = '', labelFont = '500 17px "JetBrains Mono"', seed = 4,
  risoInk = '#0078bf',
} = {}) => {
  const frames = Array.isArray(source) ? source : poses.map((pose) => ({ image: source, ...pose }));
  const margin = Math.round(width * 0.0625);
  const gap = Math.round(width * 0.053);
  const fw = width - margin * 2;
  const fh = Math.round(fw * 0.86);
  const footer = label ? Math.round(width * 0.17) : margin;
  const height = margin + frames.length * fh + (frames.length - 1) * gap + footer;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = PAPER[look];
  ctx.fillRect(0, 0, width, height);

  frames.forEach(({ image, ...pose }, index) => {
    const x = margin;
    const y = margin + index * (fh + gap);
    if (look === 'riso') {
      const print = risograph(image, fw, fh, {
        ...pose,
        cell: 6,
        paper: PAPER.riso,
        inks: [{ color: risoInk, channel: (r, g, b) => 1 - (0.3 * r + 0.55 * g + 0.15 * b), angle: 0.78, offset: [0, 0] }],
        gamma: 1.25,
      });
      ctx.drawImage(print, x, y);
      return;
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, fw, fh);
    drawCover(ctx, image, x, y, fw, fh, pose);
    if (look === 'mono') monochrome(ctx, x, y, fw, fh, { contrast: 1.45, flash: 0.1, tone: [1.0, 0.985, 0.95] });
    else warmColor(ctx, x, y, fw, fh, { fade: 0.07 });
    frameVignette(ctx, x, y, fw, fh, look === 'mono' ? 0.42 : 0.25);
    grain(ctx, x, y, fw, fh, look === 'mono' ? 26 : 12, seed + index);
    dust(ctx, x, y, fw, fh, { count: 18, seed: seed * 7 + index });
    const isLast = index === frames.length - 1;
    if (isLast && develop < 1) developing(ctx, x, y, fw, fh, develop, seed + 9);
    if (stamp && index === 0) dateStamp(ctx, stamp, x + fw - fh * 0.48, y + fh - fh * 0.15, fh * 0.075);
  });

  if (label) {
    ctx.fillStyle = look === 'riso' ? risoInk : '#3a3835';
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, height - footer / 2 + 2);
  }
  return canvas;
};

// Instant photo: thin border, deep bottom lip with a handwritten caption.
export const instantPhoto = (image, {
  width = 900, ratio = 1.25, look = 'color', caption = '', font = '64px Caveat', ink = '#22306a', pose = {}, seed = 12, angleJitter = 0.02,
} = {}) => {
  const side = Math.round(width * 0.06);
  const top = Math.round(width * 0.07);
  const bottom = Math.round(width * 0.25);
  const iw = width - side * 2;
  const ih = Math.round(iw * ratio);
  const height = top + ih + bottom;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#f8f5ee';
  ctx.fillRect(0, 0, width, height);
  const sheen = ctx.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(0, 'rgba(255,255,255,0.4)');
  sheen.addColorStop(1, 'rgba(210,200,185,0.25)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#151515';
  ctx.fillRect(side, top, iw, ih);
  drawCover(ctx, image, side, top, iw, ih, pose);
  if (look === 'mono') monochrome(ctx, side, top, iw, ih, { contrast: 1.3, flash: 0.06 });
  else warmColor(ctx, side, top, iw, ih, { fade: 0.08 });
  frameVignette(ctx, side, top, iw, ih, 0.22);
  grain(ctx, side, top, iw, ih, 10, seed);

  if (caption) {
    const rand = random(seed);
    ctx.save();
    ctx.translate(width / 2, top + ih + bottom * 0.52);
    ctx.rotate((rand() - 0.5) * angleJitter * 2);
    ctx.fillStyle = ink;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, 0, 0);
    ctx.restore();
  }
  return canvas;
};

// "Admit one" ticket printed in a single riso ink with a perforated stub.
export const ticketStub = ({ width = 900, ink = '#0078bf', accent = '#ff48b0', lines = [], serial = 'Nº 000012', seed = 15 } = {}) => {
  const height = Math.round(width * 0.42);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 0, 0, width, height, { jitter: 1.2, step: 10, seed });
  ctx.fillStyle = '#f6efdf';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.strokeRect(22, 22, width - 44, height - 44);
  ctx.setLineDash([2, 12]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width * 0.73, 30);
  ctx.lineTo(width * 0.73, height - 30);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  lines.forEach(({ text, font, x, y, color }) => {
    ctx.font = font;
    ctx.fillStyle = color ?? ink;
    ctx.fillText(text, x * width, y * height);
  });
  ctx.save();
  ctx.translate(width * 0.865, height * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '700 34px "JetBrains Mono"';
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.fillText(serial, 0, 12);
  ctx.restore();
  ctx.restore();
  return canvas;
};
