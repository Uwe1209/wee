// Every scroll-driven number on the page, in viewport heights (vh), so pacing
// is tuned in one place. Chapters and the DOM read from here and nowhere else.

export const TIMELINE = {
  total: 13.6,
  softness: 0.07, // a pin corner eases over 2 × softness vh (≥ 0.1 vh)

  // Where each DOM section starts and ends.
  sections: {
    hello: [0.0, 3.4],
    about: [3.4, 5.6],
    projects: [5.6, 10.6],
    scrapbook: [10.6, 12.5],
    contact: [12.5, 13.6],
  },

  // While scroll is inside a pin, that section's screen holds still.
  // hello starts already pinned (the pin began before the page did).
  pins: {
    hello: [-0.5, 3.25],
    projects: [5.95, 10.2],
    scrapbook: [10.75, 12.15],
  },

  // Unpinned blocks: the scroll value at which each block's top meets the top of the screen.
  blocks: {
    'about-intro': 4.2,
    'about-goal': 4.95,
    contact: 13.6,
  },

  // Fades keyed to scroll: in [from, to], out [from, to].
  reveals: {
    'hello-cue': { out: [0.25, 0.7] },
    'flash-caption': { in: [2.6, 2.85], out: [3.05, 3.22] }, // gone before the taped state (3.25)
    'projects-head': { in: [5.7, 5.95] },
    'scrap-title': { in: [10.6, 10.85], out: [11.95, 12.18] },
    'scrap-coordinator': { in: [10.8, 11.05], out: [11.97, 12.2] },
    'scrap-facilitator': { in: [11.1, 11.35], out: [11.99, 12.22] },
    'scrap-skills': { in: [11.4, 11.65], out: [12.01, 12.24] },
    'contact-body': { in: [12.9, 13.25] },
  },

  hello: {
    intro: 2.4, // seconds of load-in animation, on the clock not the scroll
  },

  flash: {
    countdown: [1.06, 1.74], // 3, 2, 1, smile
    fire: 1.8, // flash peak
    rise: 0.035, // vh from dark to peak
    fade: 0.32, // vh from peak back to normal
    print: [1.9, 2.5], // the strip slides out of the top of frame
    develop: [2.12, 2.95], // frames develop top to bottom
    tape: [2.95, 3.2], // settles and gets taped
    push: [1.0, 1.8], // camera eases toward the empty spot
    peak: 9, // HDR flash intensity
    veil: 0.95, // peak opacity of the warm veil that blows the page's text out with the scene
  },

  about: {
    dolly: [3.25, 4.4, 5.45], // leave the opening cluster, then drift slowly past the about cluster
  },

  transitions: {
    wallToRoom: [5.35, 5.95],
    roomToDesk: [10.1, 10.65],
    deskToWall: [12.2, 12.7],
  },

  projects: {
    flight: [5.8, 10.15],
  },

  scrapbook: {
    settle: [10.55, 11.6],
  },

  contact: {
    strip: [12.55, 13.3],
    dusk: [11.8, 13.6],
  },
};

// Named states for capture tools and deep links, in vh.
export const STATES = {
  hello: 0,
  countdown: 1.45,
  flash: 1.83,
  strip: 2.45,
  taped: 3.25,
  about: 4.5,
  'to-room': 5.65,
  spex: 6.15,
  buildup: 6.6,
  kacha: 7.05,
  haojia: 7.55,
  petaid: 8.0,
  herbarium: 8.45,
  aws: 8.95,
  bar: 9.4,
  lemon: 9.85,
  'to-desk': 10.4,
  scrapbook: 11.7,
  'to-wall': 12.45,
  contact: 13.6,
};

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const progress = (v, [a, b]) => clamp01((v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

// Offset that holds a block still for `length` vh after it reaches the top,
// with quadratic corners `s` wide so it never stops dead or launches.
export const softPin = (x, length, s = TIMELINE.softness) => {
  if (x <= -s) return 0;
  if (x < s) return ((x + s) ** 2) / (4 * s);
  if (x <= length - s) return x;
  if (x < length + s) return length - ((length + s - x) ** 2) / (4 * s);
  return length;
};

// Flash envelope: fast rise to the peak, slower fall. 0..1.
export const flashEnvelope = (v, { fire, rise, fade } = TIMELINE.flash) => (v < fire
  ? smooth(progress(v, [fire - rise, fire]))
  : (1 - smooth(progress(v, [fire, fire + fade]))) ** 2);

// Critically damped approach, frame-rate independent.
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
