// 2D canvas kit for everything printed on paper: photos, strips, tape,
// stickers, risograph halftones, film date stamps and paper textures.
// Every generator takes a seed so a texture bakes the same way every time.

export const makeCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
};

export const loadImage = async (url) => {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
};

export const random = (seed = 1) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const fract = (x) => x - Math.floor(x);
const hash2 = (x, y, seed) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
const smooth = (t) => t * t * (3 - 2 * t);

export const valueNoise = (x, y, seed = 0) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export const fbm = (x, y, { octaves = 5, seed = 0, lacunarity = 2, gain = 0.5 } = {}) => {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, seed + octave * 13);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
};

// object-fit: cover, with zoom, focus point and a small rotation.
export const drawCover = (ctx, image, x, y, w, h, { zoom = 1, focusX = 0.5, focusY = 0.5, rotate = 0 } = {}) => {
  const scale = Math.max(w / image.width, h / image.height) * zoom;
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotate);
  ctx.drawImage(image, -dw * focusX, -dh * focusY, dw, dh);
  ctx.restore();
};

export const mapPixels = (ctx, x, y, w, h, fn) => {
  const data = ctx.getImageData(x, y, w, h);
  const px = data.data;
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const i = (row * w + col) * 4;
      const out = fn(px[i], px[i + 1], px[i + 2], col / w, row / h);
      px[i] = out[0];
      px[i + 1] = out[1];
      px[i + 2] = out[2];
    }
  }
  ctx.putImageData(data, x, y);
};

const sCurve = (v, contrast) => {
  const centered = v - 0.5;
  return 0.5 + centered * contrast / (1 + Math.abs(centered) * (contrast - 1) * 2);
};

// Silver-gelatin look: luminance, contrast curve, toned paper, flash hotspot.
export const monochrome = (ctx, x, y, w, h, { contrast = 1.35, lift = 0.02, tone = [1, 1, 1], flash = 0.12, fade = 0 } = {}) => {
  mapPixels(ctx, x, y, w, h, (r, g, b, u, v) => {
    let l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const dx = u - 0.5;
    const dy = v - 0.42;
    l += flash * Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.8);
    l = sCurve(Math.min(1, l), contrast);
    l = lift + l * (1 - lift);
    l = l * (1 - fade) + fade * 0.92;
    return [l * 255 * tone[0], l * 255 * tone[1], l * 255 * tone[2]];
  });
};

// Half-developed print: image fades into a cool chemical haze from one edge.
export const developing = (ctx, x, y, w, h, progress, seed = 3) => {
  mapPixels(ctx, x, y, w, h, (r, g, b, u, v) => {
    const wave = fbm(u * 3, v * 3, { octaves: 3, seed }) * 0.35;
    const reveal = Math.min(1, Math.max(0, (progress - (1 - v) * 0.6 - wave + 0.3) * 2.2));
    const haze = [205, 210, 214];
    return [haze[0] + (r - haze[0]) * reveal, haze[1] + (g - haze[1]) * reveal, haze[2] + (b - haze[2]) * reveal];
  });
};

export const grain = (ctx, x, y, w, h, amount = 18, seed = 7) => {
  const rand = random(seed);
  mapPixels(ctx, x, y, w, h, (r, g, b) => {
    const n = (rand() + rand() - 1) * amount;
    return [r + n, g + n, b + n];
  });
};

export const dust = (ctx, x, y, w, h, { count = 40, seed = 11, color = 'rgba(255,255,255,0.55)' } = {}) => {
  const rand = random(seed);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  for (let k = 0; k < count; k += 1) {
    const px = x + rand() * w;
    const py = y + rand() * h;
    if (rand() < 0.85) {
      ctx.beginPath();
      ctx.arc(px, py, rand() * 1.4 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.bezierCurveTo(px + rand() * 14 - 7, py + rand() * 14 - 7, px + rand() * 18 - 9, py + rand() * 18 - 9, px + rand() * 24 - 12, py + rand() * 24 - 12);
      ctx.stroke();
    }
  }
  ctx.restore();
};

// Classic orange film date imprint drawn as seven-segment digits.
const SEGMENTS = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd',
  6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '', '-': 'g',
};
export const dateStamp = (ctx, text, x, y, height, { color = '#ff8a1c', glow = 'rgba(255,120,20,0.9)' } = {}) => {
  const w = height * 0.5;
  const t = height * 0.12;
  const gap = height * 0.18;
  const segment = (sx, sy, horizontal) => {
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(sx + t * 0.5, sy);
      ctx.lineTo(sx + w - t * 0.5, sy);
    } else {
      ctx.moveTo(sx, sy + t * 0.5);
      ctx.lineTo(sx, sy + height / 2 - t * 0.5);
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = t;
  ctx.lineCap = 'round';
  ctx.shadowColor = glow;
  ctx.shadowBlur = height * 0.35;
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  let cursor = x + y * 0.12;
  for (const ch of text) {
    if (ch === "'") {
      ctx.beginPath();
      ctx.moveTo(cursor + t, y);
      ctx.lineTo(cursor + t * 0.6, y + height * 0.22);
      ctx.stroke();
      cursor += t * 2.6;
      continue;
    }
    const on = SEGMENTS[ch] ?? '';
    if (on.includes('a')) segment(cursor, y, true);
    if (on.includes('b')) segment(cursor + w, y, false);
    if (on.includes('c')) segment(cursor + w, y + height / 2, false);
    if (on.includes('d')) segment(cursor, y + height, true);
    if (on.includes('e')) segment(cursor, y + height / 2, false);
    if (on.includes('f')) segment(cursor, y, false);
    if (on.includes('g')) segment(cursor, y + height / 2, true);
    cursor += w + gap;
  }
  ctx.restore();
};

// A rectangle whose edges wobble like torn or hand-cut paper.
export const roughRect = (ctx, x, y, w, h, { jitter = 2, step = 6, seed = 5 } = {}) => {
  const rand = random(seed);
  const edge = (x0, y0, x1, y1) => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.round(length / step));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const nx = -(y1 - y0) / length;
      const ny = (x1 - x0) / length;
      const offset = s === steps ? 0 : (rand() - 0.5) * 2 * jitter;
      ctx.lineTo(x0 + (x1 - x0) * t + nx * offset, y0 + (y1 - y0) * t + ny * offset);
    }
  };
  ctx.beginPath();
  ctx.moveTo(x, y);
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
  ctx.closePath();
};

// Masking or washi tape: translucent strip with torn short ends.
export const tapeCanvas = (width, height, { color = 'rgba(232,220,188,0.82)', stripes = null, seed = 9 } = {}) => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rand = random(seed);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= width; x += width / 14) ctx.lineTo(x, rand() * height * 0.06);
  ctx.lineTo(width, 0);
  for (let y = 0; y <= height; y += height / 9) ctx.lineTo(width - rand() * width * 0.035, y);
  for (let x = width; x >= 0; x -= width / 14) ctx.lineTo(x, height - rand() * height * 0.06);
  for (let y = height; y >= 0; y -= height / 9) ctx.lineTo(rand() * width * 0.035, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (stripes) {
    ctx.strokeStyle = stripes;
    ctx.lineWidth = height * 0.12;
    for (let x = -height; x < width + height; x += height * 0.34) {
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height, 0);
      ctx.stroke();
    }
  }
  const data = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    const n = (rand() - 0.5) * 18;
    data.data[i] += n;
    data.data[i + 1] += n;
    data.data[i + 2] += n;
  }
  ctx.putImageData(data, 0, 0);
  ctx.restore();
  return canvas;
};

export const starPath = (ctx, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) => {
  ctx.beginPath();
  for (let k = 0; k < points * 2; k += 1) {
    const r = k % 2 === 0 ? outer : inner;
    const a = rotation + (k * Math.PI) / points;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
};

export const heartPath = (ctx, cx, cy, size) => {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.8, cy - s * 1.25, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.25, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
};

export const sparklePath = (ctx, cx, cy, r) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.12, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.12, cy + r * 0.12, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.12, cy + r * 0.12, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.12, cy - r * 0.12, cx, cy - r);
  ctx.closePath();
};

// Puffy vinyl sticker: white die-cut border, glossy fill, soft highlight.
export const stickerCanvas = (shape, size, fill, { seed = 1 } = {}) => {
  const pad = size * 0.22;
  const canvas = makeCanvas(size + pad * 2, size + pad * 2);
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const draw = () => {
    if (shape === 'star') starPath(ctx, cx, cy, size * 0.5, size * 0.24, 5, -Math.PI / 2 + (random(seed)() - 0.5) * 0.4);
    else if (shape === 'heart') heartPath(ctx, cx, cy + size * 0.04, size);
    else sparklePath(ctx, cx, cy, size * 0.5);
  };
  ctx.lineJoin = 'round';
  draw();
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const shine = ctx.createLinearGradient(cx - size * 0.4, cy - size * 0.5, cx + size * 0.3, cy + size * 0.4);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.0)');
  shine.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas;
};

// Risograph print: two spot inks laid down as rotated halftone screens with a
// little misregistration, multiplied onto paper.
export const risograph = (source, width, height, {
  inks = [
    { color: '#ff48b0', channel: (r, g, b) => 1 - (0.2 * r + 0.5 * g + 0.3 * b), angle: 0.26, offset: [0, 0] },
    { color: '#0078bf', channel: (r, g, b) => 1 - (0.6 * r + 0.3 * g + 0.1 * b), angle: 1.31, offset: [3, 2] },
  ],
  cell = 7,
  paper = '#f6f1e6',
  zoom = 1,
  focusX = 0.5,
  focusY = 0.5,
  gamma = 1.1,
} = {}) => {
  const sample = makeCanvas(width, height);
  const sctx = sample.getContext('2d', { willReadFrequently: true });
  drawCover(sctx, source, 0, 0, width, height, { zoom, focusX, focusY });
  const pixels = sctx.getImageData(0, 0, width, height).data;

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'multiply';
  inks.forEach((ink) => {
    const layer = makeCanvas(width, height);
    const lctx = layer.getContext('2d');
    lctx.fillStyle = ink.color;
    const cos = Math.cos(ink.angle);
    const sin = Math.sin(ink.angle);
    const reach = Math.hypot(width, height);
    for (let gy = -reach; gy < reach; gy += cell) {
      for (let gx = -reach; gx < reach; gx += cell) {
        const px = width / 2 + gx * cos - gy * sin;
        const py = height / 2 + gx * sin + gy * cos;
        if (px < -cell || py < -cell || px > width + cell || py > height + cell) continue;
        const sx = Math.min(width - 1, Math.max(0, Math.round(px)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(py)));
        const i = (sy * width + sx) * 4;
        const coverage = Math.pow(Math.min(1, Math.max(0, ink.channel(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255))), gamma);
        const radius = Math.sqrt(coverage) * cell * 0.62;
        if (radius < 0.35) continue;
        lctx.beginPath();
        lctx.arc(px + ink.offset[0], py + ink.offset[1], radius, 0, Math.PI * 2);
        lctx.fill();
      }
    }
    ctx.drawImage(layer, 0, 0);
  });
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
};

// Paper stock with fibres, optional dot grid. Returns a canvas.
export const paperCanvas = (width, height, { base = [243, 238, 227], fibres = 260, grid = null, seed = 21, mottle = 10 } = {}) => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const px = image.data;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const n = fbm(x / 180, y / 180, { octaves: 4, seed }) - 0.5;
      const fine = hash2(x, y, seed) - 0.5;
      const v = n * mottle + fine * 6;
      const i = (y * width + x) * 4;
      px[i] = base[0] + v;
      px[i + 1] = base[1] + v;
      px[i + 2] = base[2] + v * 0.9;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const rand = random(seed);
  ctx.lineWidth = 0.6;
  for (let k = 0; k < fibres; k += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const length = 6 + rand() * 22;
    const angle = rand() * Math.PI;
    ctx.strokeStyle = `rgba(${rand() < 0.5 ? '120,100,80' : '255,255,255'},${0.08 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle) * length * 0.5 + rand() * 4, y + Math.sin(angle) * length * 0.5 + rand() * 4, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  if (grid) {
    ctx.fillStyle = grid.color;
    for (let y = grid.step / 2; y < height; y += grid.step) {
      for (let x = grid.step / 2; x < width; x += grid.step) {
        ctx.beginPath();
        ctx.arc(x, y, grid.dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvas;
};

// Height field to tangent-space normal map.
export const normalFromHeight = (heights, width, height, strength = 2) => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const at = (x, y) => heights[((y + height) % height) * width + ((x + width) % width)];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * width + x) * 4;
      image.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      image.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      image.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

// Lime plaster: warm colour variation plus a height field for the normal map.
export const plaster = (width, height, { base = [236, 226, 208], seed = 31 } = {}) => {
  const color = makeCanvas(width, height);
  const ctx = color.getContext('2d');
  const image = ctx.createImageData(width, height);
  const heights = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const broad = fbm(x / 260, y / 260, { octaves: 4, seed });
      const trowel = fbm(x / 60 + broad * 2, y / 90, { octaves: 3, seed: seed + 5 });
      const pores = hash2(x, y, seed) > 0.985 ? -0.6 : 0;
      const h = broad * 0.6 + trowel * 0.4 + pores * 0.15;
      heights[y * width + x] = h;
      const shade = (broad - 0.5) * 22 + (trowel - 0.5) * 10 + (hash2(x, y, seed + 1) - 0.5) * 5;
      const i = (y * width + x) * 4;
      image.data[i] = base[0] + shade;
      image.data[i + 1] = base[1] + shade * 0.95;
      image.data[i + 2] = base[2] + shade * 0.85;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { color, normal: normalFromHeight(heights, width, height, 3.5) };
};
