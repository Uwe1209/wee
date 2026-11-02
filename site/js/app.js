// One renderer, one clock, one scroll value. Each chapter renders into its own
// HDR target; the pipeline blends chapters, blooms, tone maps and presents.
import * as THREE from 'three';
import { Pipeline } from './post/pipeline.js';
import { STATES, TIMELINE as T, clamp01, easeInOut, flashEnvelope, lerp, progress, smooth } from './motion/timeline.js';
import { SmoothScroll } from './motion/scroll.js';
import { pendingUploads, uploadOne } from './engine/textures.js';
import { WallChapter } from './chapters/wall.js';
import { RoomChapter, PROJECTS } from './chapters/room.js';
import { DeskChapter } from './chapters/desk.js';
import { Dom } from './dom.js';

const params = new URLSearchParams(location.search);
export const FLAGS = {
  capture: params.has('capture'),
  debug: params.has('debug'),
  reduced: params.has('reduced'),
  dpr: params.get('dpr'),
  state: params.get('state'),
};

const LOOK_NUMBERS = ['bloom', 'halation', 'exposure', 'saturation', 'contrast', 'grain', 'vignette'];
const mixLook = (a, b, t) => {
  const out = { ...a };
  LOOK_NUMBERS.forEach((key) => { out[key] = lerp(a[key], b[key], t); });
  ['lift', 'gain'].forEach((key) => { out[key] = a[key].map((x, i) => lerp(x, b[key][i], t)); });
  return out;
};

const FALLBACK = new THREE.Color(0xd9c7ad);
const CROSSFADE = 4;

// Wall to room is light, not a wipe. In fractions of the transition window:
// the glare builds to its peak exactly as the chapters cross (the swap is
// centred on the peak, `half` either side, 0.15 vh in all), then decays over
// the rest of the window and eases out, so the room's darkness arrives as a
// ramp that settles instead of stopping dead.
const LEAK = { peak: 0.3, half: 0.125 };
const leakGlare = (p) => {
  if (p < LEAK.peak) return smooth(p / LEAK.peak) ** 0.6;
  const q = (p - LEAK.peak) / (1 - LEAK.peak);
  return (1 - q) ** 1.75 * (1 + 0.75 * q);
};
// The glare opens the lens: exposure lifts, bloom and halation spread its
// energy, and the vignette eases (the shader vignettes only the scene).
const glareLook = (look, g) => ({
  ...look,
  exposure: look.exposure * (1 + 0.06 * g),
  bloom: lerp(look.bloom, 0.12, g),
  halation: lerp(look.halation, 0.35, g),
  vignette: look.vignette * (1 - g),
});

export class App {
  constructor() {
    this.reduced = FLAGS.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gl'), antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: FLAGS.capture,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // filtered by each light's shadow.radius
    this.renderer.setClearColor(FALLBACK, 1);
    this.pipeline = new Pipeline(this.renderer, { bloomLevels: 6, layers: false });
    this.slots = [0, 1].map(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true }));
    this.scroll = new SmoothScroll({ content: document.getElementById('content'), space: document.getElementById('scroll-space'), reduced: this.reduced });
    this.dom = new Dom(document, { reduced: this.reduced });
    this.chapters = { wall: new WallChapter(this), room: new RoomChapter(this), desk: new DeskChapter(this) };
    this.failed = new Set();
    this.time = 0;
    this.intro = 0;
    this.last = null;
    this.quality = 1;
    this.slow = 0;
    this.v = 0;
    this.vh = window.innerHeight;
    this.drawn = new Set();
    this.api = {
      ready: false,
      layout: null,
      states: STATES,
      info: {},
      goto: (state) => this.goto(state),
      setScroll: (vh) => this.setScroll(vh),
      rails: () => this.chapters.wall.report?.(),
      failed: () => [...this.failed],
      // Film recorder: start the motion clock over (intro plays from frame one).
      restart: () => {
        this.time = 0;
        this.last = null;
        this.scroll.setTarget(0, { instant: true });
      },
      scroll: () => ({ v: this.v, target: this.scroll.target / this.vh }),
    };
  }

  async start() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    await document.fonts.ready;
    await this.build('wall');
    this.loop = (now) => {
      this.frame(now);
      requestAnimationFrame(this.loop);
    };
    requestAnimationFrame(this.loop);
    // The room and desk build in the background while the opening plays.
    this.whenBuilt = Promise.all(['room', 'desk'].map((name) => this.build(name)));
    await this.whenBuilt;
    if (FLAGS.state) await this.goto(FLAGS.state);
    this.api.ready = true;
  }

  async build(name) {
    const chapter = this.chapters[name];
    try {
      await chapter.build();
      chapter.resize(this.aspect);
      this.renderer.setRenderTarget(this.slots[0]);
      await this.renderer.compileAsync(chapter.scene, chapter.camera);
    } catch (error) {
      this.failed.add(name);
      console.error(`chapter ${name} disabled:`, error);
    }
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const v = this.scroll.current / this.vh;
    this.vh = height;
    this.aspect = width / height;
    const dpr = FLAGS.dpr ? Number(FLAGS.dpr) : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr * this.quality);
    this.renderer.setSize(width, height, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.slots.forEach((slot) => slot.setSize(size.x, size.y));
    this.pipeline.setSize(size.x, size.y);
    Object.values(this.chapters).forEach((chapter) => chapter.ready && chapter.resize(this.aspect));
    this.dom.layout(height);
    this.scroll.setLength((T.total + 1) * height);
    if (v > 0) this.scroll.setTarget(v * height, { instant: true });
    this.api.layout = { vh: height, width, total: T.total, dpr, buffer: [size.x, size.y], sections: T.sections };
  }

  frame(now) {
    const dt = this.last === null ? 1 / 60 : Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.intro = this.reduced ? 1 : clamp01(this.time / T.hello.intro);
    this.v = this.scroll.update(dt) / this.vh;
    uploadOne(this.renderer);
    this.render(this.v);
    this.dom.update(this.v, this.intro, this.drawn.has('room') ? this.chapters.room : null, this.drawn.has('wall') ? this.chapters.wall : null);
    this.adapt(dt);
    if (FLAGS.debug) this.debug(dt);
  }

  plan(v) {
    const tr = T.transitions;
    if (v < tr.wallToRoom[0]) return { a: 'wall' };
    if (v < tr.wallToRoom[1]) {
      const p = progress(v, tr.wallToRoom);
      return { a: 'wall', b: 'room', mix: smooth(progress(p, [LEAK.peak - LEAK.half, LEAK.peak + LEAK.half])), glare: leakGlare(p), type: 1 };
    }
    if (v < tr.roomToDesk[0]) return { a: 'room' };
    if (v < tr.roomToDesk[1]) return { a: 'room', b: 'desk', mix: easeInOut(progress(v, tr.roomToDesk)), type: 2 };
    if (v < tr.deskToWall[0]) return { a: 'desk' };
    if (v < tr.deskToWall[1]) return { a: 'desk', b: 'wall', mix: easeInOut(progress(v, tr.deskToWall)), type: 3 };
    return { a: 'wall' };
  }

  // Reduced motion: each chapter holds one still composition.
  stillV(name, v) {
    if (name === 'wall') {
      if (v < T.sections.about[0]) return T.flash.tape[1];
      return v < T.transitions.deskToWall[0] ? T.about.dolly[2] : T.total;
    }
    if (name === 'room') {
      const count = PROJECTS.length;
      const index = Math.min(count - 1, Math.floor(progress(v, T.projects.flight) * count));
      return lerp(T.projects.flight[0], T.projects.flight[1], (index + 0.5) / count);
    }
    return T.scrapbook.settle[1] + 0.3;
  }

  draw(name, v, slot) {
    const chapter = this.chapters[name];
    this.renderer.setRenderTarget(slot);
    if (!chapter.ready || this.failed.has(name)) {
      this.renderer.clear();
      return null;
    }
    try {
      chapter.update(this.reduced ? this.stillV(name, v) : v, this.time, this.intro);
      this.renderer.render(chapter.scene, chapter.camera);
      return chapter;
    } catch (error) {
      this.failed.add(name);
      console.error(`chapter ${name} disabled:`, error);
      this.renderer.setRenderTarget(slot);
      this.renderer.clear();
      return null;
    }
  }

  render(v) {
    const plan = this.plan(v);
    this.drawn = new Set([plan.a, plan.b].filter(Boolean));
    const a = this.draw(plan.a, v, this.slots[0]);
    let source = this.slots[0];
    let look = (a ?? this.chapters.wall).look;
    if (plan.b) {
      const b = this.draw(plan.b, v, this.slots[1]);
      const glare = this.reduced ? 0 : plan.glare ?? 0;
      source = this.pipeline.transition(this.slots[0], this.slots[1], plan.mix, this.reduced ? CROSSFADE : plan.type, this.time, glare);
      look = mixLook(look, (b ?? this.chapters.wall).look, plan.mix);
      if (glare > 0) look = glareLook(look, glare);
    }
    const flash = flashEnvelope(v) * (this.reduced ? 0.05 : 1);
    this.pipeline.setLook({ ...look, exposure: look.exposure * (1 + 1.5 * flash), flash: flash * T.flash.peak });
    this.pipeline.present({ time: this.time, source });
  }

  setScroll(vh) {
    this.scroll.setTarget(vh * this.vh);
  }

  async goto(state) {
    const v = typeof state === 'number' ? state : STATES[state] ?? (Number.isFinite(Number(state)) ? Number(state) : undefined);
    if (v === undefined) throw new Error(`unknown state ${state}`);
    this.api.ready = false;
    await this.whenBuilt;
    while (pendingUploads()) uploadOne(this.renderer);
    this.time = Math.max(this.time, T.hello.intro + 0.5);
    this.intro = 1;
    this.scroll.setTarget(v * this.vh, { instant: true });
    this.v = this.scroll.update(0) / this.vh;
    this.render(this.v);
    this.dom.update(this.v, 1, this.drawn.has('room') ? this.chapters.room : null, this.drawn.has('wall') ? this.chapters.wall : null);
    this.api.info = { state, v: this.v, failed: [...this.failed] };
    this.api.ready = true;
    return this.v;
  }

  // Drops resolution in steps if frames run long; never in capture mode.
  adapt(dt) {
    if (FLAGS.capture) return;
    this.slow = dt > 1 / 40 ? this.slow + 1 : Math.max(0, this.slow - 2);
    if (this.slow > 45 && this.quality > 0.6) {
      this.quality = Math.max(0.6, this.quality * 0.85);
      this.slow = 0;
      this.resize();
    }
  }

  debug(dt) {
    if (!this.debugEl) {
      this.debugEl = document.createElement('pre');
      this.debugEl.className = 'debug';
      document.body.append(this.debugEl);
      console.table(this.api.rails());
    }
    this.fps = lerp(this.fps ?? 60, 1 / Math.max(dt, 1e-3), 0.05);
    this.debugEl.textContent = `v ${this.v.toFixed(3)}  fps ${this.fps.toFixed(0)}  q ${this.quality.toFixed(2)}  ${[...this.failed].join(' ')}`;
  }
}
