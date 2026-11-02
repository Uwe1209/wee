// Every scroll-driven number on the page, in viewport heights (vh), so pacing
// is tuned in one place. Chapters and the DOM read from here and nowhere else.

export const TIMELINE = {
  total: 14.4,
  softness: 0.07, // a pin corner eases over 2 × softness vh (≥ 0.1 vh)

  // Where each DOM section starts and ends.
  sections: {
    hello: [0.0, 3.4],
    about: [3.4, 6.4],
    projects: [6.4, 11.4],
    scrapbook: [11.4, 13.3],
    contact: [13.3, 14.4],
  },

  // While scroll is inside a pin, that section's screen holds still.
  // hello starts already pinned (the pin began before the page did).
  pins: {
    hello: [-0.5, 3.25],
    projects: [6.75, 11.0],
    scrapbook: [11.55, 12.95],
  },

  // Unpinned blocks: the scroll value at which each block's top meets the top of the screen.
  blocks: {
    'about-intro': 5.74,
    'about-goal': 6.08,
    contact: 14.4,
  },

  // Fades keyed to scroll: in [from, to], out [from, to].
  reveals: {
    'hello-cue': { out: [0.25, 0.7] },
    'flash-caption': { in: [2.6, 2.85], out: [3.05, 3.22] }, // gone before the taped state (3.25)
    'projects-head': { in: [6.5, 6.75] },
    'scrap-title': { in: [11.4, 11.65], out: [12.75, 12.98] },
    'scrap-coordinator': { in: [11.6, 11.85], out: [12.77, 13.0] },
    'scrap-facilitator': { in: [11.9, 12.15], out: [12.79, 13.02] },
    'scrap-skills': { in: [12.2, 12.45], out: [12.81, 13.04] },
    'contact-body': { in: [13.7, 14.05] },
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
    // Glide past the opening cluster at about the copy's speed (the wall drifts up
    // with a gentle camera drop), then settle by the about cluster. Lengthened by
    // 0.8 vh so the copy never sits on a photo and peak wall speed stays ~1.2x the copy's.
    dolly: [3.25, 5.9, 6.25],
  },

  transitions: {
    wallToRoom: [6.15, 6.75],
    roomToDesk: [10.9, 11.45],
    deskToWall: [13.0, 13.5],
  },

  projects: {
    flight: [6.6, 10.95],
  },

  scrapbook: {
    settle: [11.35, 12.4],
  },

  contact: {
    strip: [13.35, 14.1],
    dusk: [12.6, 14.4],
  },
};

// Named states for capture tools and deep links, in vh.
export const STATES = {
  hello: 0,
  countdown: 1.45,
  flash: 1.83,
  strip: 2.45,
  taped: 3.25,
  about: 5.6,
  'to-room': 6.45,
  spex: 6.95,
  buildup: 7.4,
  kacha: 7.85,
  haojia: 8.35,
  petaid: 8.8,
  herbarium: 9.25,
  aws: 9.75,
  bar: 10.2,
  lemon: 10.65,
  'to-desk': 11.2,
  scrapbook: 12.5,
  'to-wall': 13.25,
  contact: 14.4,
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
