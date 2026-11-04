// Every scroll-driven number on the page, in viewport heights (vh), so pacing
// is tuned in one place. Chapters and the DOM read from here and nowhere else.

export const TIMELINE = {
  total: 13.43,
  softness: 0.07, // a pin corner eases over 2 × softness vh (≥ 0.1 vh)

  // Where each DOM section starts and ends.
  sections: {
    hello: [0.0, 3.4],
    about: [3.4, 6.4],
    projects: [6.4, 10.43],
    scrapbook: [10.43, 12.33],
    contact: [12.33, 13.43],
  },

  // While scroll is inside a pin, that section's screen holds still.
  // hello starts already pinned (the pin began before the page did).
  pins: {
    hello: [-0.5, 3.25],
    projects: [6.75, 10.03],
    scrapbook: [10.58, 11.98],
  },

  // Unpinned blocks: the scroll value at which each block's top meets the top of the screen.
  blocks: {
    'about-intro': 5.31, // kicker rests on --chapter-top (11 vh) at the about state; it enters ~4.53, during the camera glide
    'about-goal': 5.62, // one block with the intro: all of it on screen together around 5.4
    contact: 13.43,
  },

  // Fades keyed to scroll: in [from, to], out [from, to].
  reveals: {
    'hello-cue': { out: [0.25, 0.7] },
    'flash-caption': { in: [2.6, 2.85], out: [3.05, 3.22] }, // gone before the taped state (3.25)
    'projects-head': { in: [6.5, 6.75] },
    'scrap-title': { in: [10.43, 10.68], out: [11.78, 12.01] },
    'scrap-coordinator': { in: [10.63, 10.88], out: [11.8, 12.03] },
    'scrap-facilitator': { in: [10.93, 11.18], out: [11.82, 12.05] },
    'scrap-skills': { in: [11.23, 11.48], out: [11.84, 12.07] },
    'contact-body': { in: [12.73, 13.08] },
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
    veil: 1, // peak opacity of the veil that blows the page's text out with the scene (opaque at the peak)
    reduced: 0.02, // reduced motion: the flash is only a faint lift of the frame and the page
  },

  about: {
    // Glide past the opening cluster (the wall drifts up with a gentle camera
    // drop) while the about copy starts to rise, land on the cluster's framing
    // by 4.9, then keep a slow drift and push while the copy scrolls, until the
    // light leak. The glide is short enough that the departing gators photo
    // clears the copy column before the copy reaches it (~80 px clearance).
    dolly: [3.25, 4.9, 6.25],
    // The sun swings right and down onto the copy column and the about window
    // fades in over the day's: in by the time the copy rises into view, out
    // once the light leak has hidden the wall.
    light: { in: [3.9, 4.5], fade: [3.9, 4.4], out: [6.42, 6.75] },
  },

  transitions: {
    wallToRoom: [6.15, 6.75],
    roomToDesk: [9.93, 10.48],
    deskToWall: [12.03, 12.53],
  },

  projects: {
    flight: [6.6, 9.98], // ~0.48 vh per card, seven cards
  },

  scrapbook: {
    settle: [10.38, 11.43],
    fadeIn: 0.3, // share of each memory's drop over which it fades in, so none pops into the air
  },

  contact: {
    strip: [12.38, 13.13],
    note: [13.18, 13.33], // the 'say hi' note lands once the title has risen past its spot
    dusk: [11.63, 13.43],
  },
};

// Named states for capture tools and deep links, in vh.
export const STATES = {
  hello: 0,
  countdown: 1.45,
  flash: 1.83,
  strip: 2.45,
  taped: 3.25,
  about: 5.4,
  'to-room': 6.45,
  spex: 6.82,
  buildup: 7.28,
  kacha: 7.76,
  haojia: 8.25,
  petaid: 8.73,
  herbarium: 9.21,
  bar: 9.7,
  'to-desk': 10.23,
  scrapbook: 11.53,
  'to-wall': 12.28,
  contact: 13.43,
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

// Wall to room is light, not a wipe. In fractions of the transition window:
// the glare builds to its peak exactly as the chapters cross (the swap is
// centred on the peak, `half` either side, 0.15 vh in all), then decays over
// the rest of the window and eases out, so the room's darkness arrives as a
// ramp that settles instead of stopping dead. `veil` is the peak opacity of
// the DOM veil that washes the page's text out with the flare.
export const LEAK = { peak: 0.3, half: 0.125, veil: 0.85 };
export const leakGlare = (p) => {
  if (p < LEAK.peak) return smooth(p / LEAK.peak) ** 0.45;
  const q = (p - LEAK.peak) / (1 - LEAK.peak);
  return (1 - q) ** 1.75 * (1 + 0.75 * q);
};
// The same glare keyed on scroll, 0 outside the window. The composite and the
// DOM veil both read it, so the text washes exactly with the scene.
export const wallLeak = (v) => leakGlare(progress(v, TIMELINE.transitions.wallToRoom));

// Critically damped approach, frame-rate independent.
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
