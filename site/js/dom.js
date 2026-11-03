// The DOM half of the page: sections laid out from the timeline, pins,
// scroll-keyed reveals, the countdown, and project captions that follow the
// room's camera. Everything is driven from the same frame as WebGL.
import { LEAK, TIMELINE as T, clamp01, flashEnvelope, progress, smooth, softPin, wallLeak } from './motion/timeline.js';

const opacityStyle = (value) => value.toFixed(3);

// The flash veil matches the composite's flash at its peak: white-hot in the
// middle, only a breath warmer at the edges, and opaque edge to edge so the
// page's text whites out with the scene. The warmth of the build and decay
// comes from the composite showing through as the veil fades. Distances are
// in frame heights, as in the composite.
const VEIL = { centre: [255, 252, 244], edge: [251, 239, 218], falloff: 2, edgeOpacity: 1, origin: [0.5, 0.5], warmth: 1 };
// The light leak drives a second veil in the same way, painted with the
// leak's colours: centred on the wall's sun in the upper left (where the
// page's text sits), and clear across most of the frame so the scene keeps
// reading through the flare. It matches the composite's flare: near white at
// the source, turning gold quickly (`warmth` steepens the colour falloff).
const LEAK_VEIL = { centre: [253, 251, 242], edge: [250, 199, 132], falloff: 1.6, edgeOpacity: 0, origin: [0.1, 0.2], warmth: 3 };

export class Dom {
  constructor(doc, { reduced }) {
    this.reduced = reduced;
    this.root = doc.documentElement;
    this.sections = [...doc.querySelectorAll('[data-section]')];
    this.pins = [...doc.querySelectorAll('[data-pin]')];
    this.blocks = [...doc.querySelectorAll('[data-block]')];
    this.reveals = [...doc.querySelectorAll('[data-reveal]')].map((el) => ({ el, spec: T.reveals[el.dataset.reveal] }));
    this.counts = [...doc.querySelectorAll('[data-count]')];
    this.countdown = doc.querySelector('.countdown');
    this.veil = doc.querySelector('[data-flash-veil]');
    // Fixed over the whole frame: the text it washes scrolls through it.
    this.leakVeil = doc.createElement('canvas');
    this.leakVeil.setAttribute('aria-hidden', 'true');
    this.leakVeil.style.cssText = 'position: fixed; inset: 0; width: 100%; height: calc(var(--vh) * 100); pointer-events: none; opacity: 0; visibility: hidden; will-change: opacity;';
    doc.getElementById('content')?.after(this.leakVeil);
    this.intros = [...doc.querySelectorAll('[data-intro]')];
    this.projects = [...doc.querySelectorAll('[data-project]')];
    this.counter = doc.querySelector('[data-project-counter]');
    this.cache = new WeakMap();
    this.vh = window.innerHeight;
  }

  set(el, transform, opacity) {
    const last = this.cache.get(el);
    if (last && last.transform === transform && last.opacity === opacity) return;
    el.style.transform = transform;
    el.style.opacity = opacity;
    if (opacity !== '') el.style.visibility = opacity === '0.000' ? 'hidden' : 'visible';
    this.cache.set(el, { transform, opacity });
  }

  layout(vh) {
    this.vh = vh;
    this.root.style.setProperty('--vh', `${vh / 100}px`);
    this.sections.forEach((section) => {
      const [start, end] = T.sections[section.dataset.section];
      section.style.top = `${start * vh}px`;
      section.style.height = `${(end - start) * vh}px`;
    });
    this.blocks.forEach((block) => {
      const start = T.sections[block.closest('[data-section]').dataset.section][0];
      block.style.top = `${(T.blocks[block.dataset.block] - start) * vh}px`;
    });
    if (this.veil) this.paintVeil(this.veil, VEIL, Math.ceil(this.root.clientWidth / 2), Math.ceil(vh / 2));
    if (this.leakVeil.isConnected) this.paintVeil(this.leakVeil, LEAK_VEIL, Math.ceil(this.root.clientWidth / 2), Math.ceil(vh / 2));
    // The countdown's box is the strip's slot at a fixed layout size; each
    // frame scales it from that width to the slot's width on screen.
    this.countdownWidth = this.countdown?.offsetWidth ?? 0;
  }

  // Painted once per layout at half resolution, never per frame. The gradient
  // is long and slow, so about one level of triangular noise keeps it from
  // banding into rings. The falloff is separable: across times down.
  paintVeil(canvas, palette, width, height) {
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const image = context.createImageData(width, height);
    const { data } = image;
    const { centre, edge, falloff, edgeOpacity, origin: [ox, oy], warmth } = palette;
    const across = new Float32Array(width);
    for (let x = 0; x < width; x += 1) across[x] = Math.exp(-falloff * ((x + 0.5 - ox * width) / height) ** 2);
    let seed = 0x9e3779b9;
    for (let y = 0, i = 0; y < height; y += 1) {
      const down = Math.exp(-falloff * ((y + 0.5) / height - oy) ** 2);
      for (let x = 0; x < width; x += 1, i += 4) {
        const glow = across[x] * down;
        const tint = glow ** warmth;
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const dither = ((seed & 0xffff) + (seed >>> 16)) / 0xffff - 1;
        data[i] = edge[0] + (centre[0] - edge[0]) * tint + dither;
        data[i + 1] = edge[1] + (centre[1] - edge[1]) * tint + dither;
        data[i + 2] = edge[2] + (centre[2] - edge[2]) * tint + dither;
        data[i + 3] = 255 * (edgeOpacity + (1 - edgeOpacity) * glow) + dither;
      }
    }
    context.putImageData(image, 0, 0);
  }

  update(v, intro, room, wall) {
    const { vh } = this;
    this.pins.forEach((el) => {
      const [a, b] = T.pins[el.dataset.pin];
      const start = T.sections[el.dataset.pin][0];
      const offset = (a - start + softPin(v - a, b - a)) * vh;
      this.set(el, `translate3d(0, ${offset.toFixed(2)}px, 0)`, '');
    });

    this.reveals.forEach(({ el, spec }) => {
      const shown = spec.in ? smooth(progress(v, spec.in)) : 1;
      const gone = spec.out ? smooth(progress(v, spec.out)) : 0;
      const y = (1 - shown) * 18 - gone * 18;
      this.set(el, this.reduced ? '' : `translate3d(0, ${y.toFixed(2)}px, 0)`, opacityStyle(shown * (1 - gone)));
    });

    // 3, 2, 1, smile: each beat pops in and fades; all of it clears at the flash.
    const [c0, c1] = T.flash.countdown;
    const beat = (c1 - c0) / this.counts.length;
    const flashed = 1 - smooth(progress(v, [T.flash.fire - 0.02, T.flash.fire + 0.02]));
    this.counts.forEach((el, i) => {
      const local = (v - (c0 + i * beat)) / beat;
      const show = clamp01(local * 4) * (1 - clamp01((local - 0.92) * 6)) * (i === this.counts.length - 1 ? clamp01(flashed) : 1);
      const scale = 0.86 + 0.14 * smooth(clamp01(local * 3));
      this.set(el, this.reduced ? '' : `scale(${scale.toFixed(3)})`, opacityStyle(local < 0 ? 0 : show));
    });
    // The beats wait where the strip will land: the box is laid on the slot as
    // the wall camera sees it this frame (centre, tilt, width), so they stay
    // centred between the corner mounts while the camera pushes in, on any screen.
    if (wall?.ready && this.countdownWidth > 0 && v > c0 && v < T.flash.fire) {
      const slot = wall.slot();
      const fit = slot.width / this.countdownWidth;
      this.set(this.countdown, `translate3d(${slot.x.toFixed(2)}px, ${slot.y.toFixed(2)}px, 0) rotate(${slot.tilt.toFixed(4)}rad) scale(${fit.toFixed(4)})`, '');
    }

    // The text blows out with the scene: the veil rides the composite's flash
    // envelope, is fully opaque for the top of it (about 0.05 vh round the
    // peak, so nothing reads) and is gone before the strip drops in. Reduced motion keeps a gentle fade, as the composite does.
    if (this.veil) {
      const veil = T.flash.veil * smooth(progress(flashEnvelope(v), [0.05, 0.9])) * (this.reduced ? 0.05 : 1);
      this.set(this.veil, '', opacityStyle(veil));
    }
    // The leak washes the text out with the scene and lets it back as the room
    // settles. Reduced motion has no leak veil: its composite is a crossfade.
    const leak = this.reduced ? 0 : LEAK.veil * wallLeak(v) ** 1.5;
    this.set(this.leakVeil, '', opacityStyle(leak));

    // Load-in: each element has a delay (0..1) along the intro.
    this.intros.forEach((el) => {
      const delay = Number(el.dataset.intro);
      const t = this.reduced ? 1 : smooth(clamp01((intro - delay) / 0.35));
      this.set(el, this.reduced ? '' : `translate3d(0, ${((1 - t) * 22).toFixed(2)}px, 0)`, opacityStyle(t));
    });

    // Project captions follow the camera's focus in the room, and are all
    // hidden whenever the room isn't on screen.
    if (!room?.ready) {
      this.projects.forEach((el) => this.set(el, '', '0.000'));
    } else {
      this.projects.forEach((el, j) => {
        const focus = room.focus[j] ?? 0;
        this.set(el, this.reduced ? '' : `translate3d(0, ${((1 - focus) * 16).toFixed(2)}px, 0)`, opacityStyle(focus));
      });
      if (this.counter) {
        const label = `${String(room.active + 1).padStart(2, '0')} / ${String(this.projects.length).padStart(2, '0')}`;
        if (this.counter.textContent !== label) this.counter.textContent = label;
      }
    }
  }
}
