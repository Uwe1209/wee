// The DOM half of the page: sections laid out from the timeline, pins,
// scroll-keyed reveals, the countdown, and project captions that follow the
// room's camera. Everything is driven from the same frame as WebGL.
import { TIMELINE as T, clamp01, progress, smooth, softPin } from './motion/timeline.js';

const opacityStyle = (value) => value.toFixed(3);

export class Dom {
  constructor(doc, { reduced }) {
    this.reduced = reduced;
    this.root = doc.documentElement;
    this.sections = [...doc.querySelectorAll('[data-section]')];
    this.pins = [...doc.querySelectorAll('[data-pin]')];
    this.blocks = [...doc.querySelectorAll('[data-block]')];
    this.reveals = [...doc.querySelectorAll('[data-reveal]')].map((el) => ({ el, spec: T.reveals[el.dataset.reveal] }));
    this.counts = [...doc.querySelectorAll('[data-count]')];
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
  }

  update(v, intro, room) {
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

    // Load-in: each element has a delay (0..1) along the intro.
    this.intros.forEach((el) => {
      const delay = Number(el.dataset.intro);
      const t = this.reduced ? 1 : smooth(clamp01((intro - delay) / 0.35));
      this.set(el, this.reduced ? '' : `translate3d(0, ${((1 - t) * 22).toFixed(2)}px, 0)`, opacityStyle(t));
    });

    // Project captions follow the camera's focus in the room.
    if (room?.ready) {
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
