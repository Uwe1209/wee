// The room: a long, dim gallery the camera walks down. Late sun comes in
// through a row of windows in the right-hand wall and lands on the floorboards
// as warm, window-shaped patches; the shafts in between carry glowing dust.
// Project cards hang down the hall; the camera flies past them, slowing at
// each, and each photo develops as it comes close. The cards are curled, glossy
// prints: their coat reflects the windows, and they shade the sunbeams (the lit
// dust and the floor patches) and some of the windows' light on the floor.
import * as THREE from 'three';
import { TIMELINE as T, clamp01, progress, smooth } from '../motion/timeline.js';
import { texture } from '../engine/textures.js';
import { card, instantRect, sticker, tapeTop } from '../engine/paper3d.js';
import { makeCanvas, random } from '../lib/paper.js';

export const PROJECTS = [
  { key: 'spex', tex: 'card-spex', ratio: 0.7, width: 2.8, tape: 'pink' },
  { key: 'buildup', tex: 'card-buildup', ratio: 0.66, width: 2.8, tape: 'yellow', badge: 'badge-top5' },
  { key: 'kacha', tex: 'card-kacha', ratio: 1.0, width: 2.25, tape: 'blue' },
  { key: 'haojia', tex: 'card-haojia', ratio: 0.62, width: 2.6, tape: 'cream', typeCard: true },
  { key: 'petaid', tex: 'card-petaid', ratio: 0.62, width: 2.6, tape: 'pink', typeCard: true },
  { key: 'herbarium', tex: 'card-herbarium', ratio: 0.6, width: 2.7, tape: 'yellow' },
  { key: 'aws', tex: 'card-aws', ratio: 0.8, width: 2.5, tape: 'blue' },
  { key: 'bar', tex: 'card-bar', ratio: 0.62, width: 2.7, tape: 'cream' },
  { key: 'lemon', tex: 'card-lemon', ratio: 0.62, width: 2.7, tape: 'yellow' },
];

// Cards hang SPACING apart; the camera rests STAND in front of each one, so the card
// just passed is already 0.9 behind the lens at every stop and has left the frame
// (never nearer than ~1.1 while on screen) before the next caption is up.
const SPACING = 7.4;
const STAND = 6.5;
const DWELL = 0.85; // 0 = constant speed; 0.85 = 0.15× speed at each card
const SIZE = new THREE.Vector2();

// The hall, in world units: side walls at x = left and right, floor and ceiling
// heights, and its two ends (behind the first camera key, far past the last card).
const HALL = { left: -3.6, right: 4.6, floor: -2.6, ceiling: 5, near: 14, far: -130 };
// One window per bay in the right-hand wall, halfway between two cards. `gobo` is
// the part of the gobo texture (px of 1024, y down) the opening maps onto: the
// pane block and a margin of wall around it.
const WINDOW = { z: -2 + SPACING / 2, width: 2.6, sill: -1.3, head: 3.3, gobo: [120, 70, 850, 980] };
// Toward the sun: low on the right and a little ahead, so the beams slant toward
// the viewer. The light crosses the hall leftward and lands on the floor short of
// the left wall, so the caption side of the frame stays in shade.
const SUN = new THREE.Vector3(0.8, 0.75, -0.55).normalize();
const SUN_LIGHT = new THREE.Color(0xffc28a).multiplyScalar(7);
// World size of one tile of the floorboard texture (eight planks across).
const PLANKS = [2.88, 5.76];
// Where the middle of each window's light lands across the floor: walls are lit
// by the bounce off this line.
const POOL_X = HALL.right - ((WINDOW.sill + WINDOW.head) / 2 - HALL.floor) * (SUN.x / SUN.y);

// The cards' paper, in card space (z toward the viewer): the right part bows back
// (`bend` is its slope at the right edge) and the top-right corner lifts away
// further. The bowed side's coat faces back up the hall and the corner's faces up
// as well, toward the windows the camera has just passed, so that is where the
// glossy reflection lands.
const CURL = { from: -0.2, bend: 0.3, corner: 0.18 };
const curlZ = (x, y, width, height) => {
  const start = CURL.from * width / 2;
  const bow = Math.max(0, x - start);
  const corner = Math.max(0, x / (width / 2) + y / (height / 2) - 1);
  return (-CURL.bend * bow * bow) / (2 * (width / 2 - start)) - CURL.corner * corner * corner;
};
// The sun slants toward the viewer, so a card's shadow (on the floor, in the
// haze, on the dust) lies at most this far in front of it, never behind it.
const SHADE_REACH = 3.6;
// Share of the floor's sky and bounce light that a card can take where it hides
// a window completely.
const SKY_SHADE = 0.5;

export const ROOM_LOOK = {
  bloom: 0.08, halation: 0.3, exposure: 1.18, saturation: 1.0, contrast: 1.05,
  lift: [0.02, 0.012, 0.008], gain: [1.03, 0.99, 0.94], grain: 0.055, vignette: 0.45,
};

// A card's caption (0..1) at flight offset d = c - j. It comes up on the way in,
// while the card is still far and small, and goes out just after the rest: once the
// camera moves on, the card grows and slides off the right edge (from d = 0.19), so
// the caption is half gone by the time the card is 10% wider than at rest, and gone
// by d = 0.16 while the card is still whole in frame.
const focusOn = (d) => (d < 0
  ? 1 - smooth(clamp01((-d - 0.16) / 0.3))
  : 1 - smooth(clamp01((d - 0.02) / 0.14)));

// A card the camera has just looked at is filed away, so it never hangs across
// the lens as a blank slab while the camera passes it. After its caption starts
// fading (d = c - j past its rest), it swings on its window-side edge toward the
// wall and recedes down the hall; once the caption is gone it lifts and slides
// toward the windows, out of frame by the time the next card is in view. Everything
// is a function of d, so scrolling back unfiles it. Measured: a passed card never
// covers more of the frame than at its rest (18-22%), under 5% from d = 0.3 and
// ~0% from d = 0.5. The named states all sit at d < 0.09, so their framing holds.
const FILE = { from: 0.08, span: 0.2, turn: 1.4, recede: 2.5, driftFrom: 0.14, driftSpan: 0.28, lift: 1.8, slide: 1 };
const fileAway = (mesh, d) => {
  const turn = smooth(clamp01((d - FILE.from) / FILE.span));
  const drift = smooth(clamp01((d - FILE.driftFrom) / FILE.driftSpan));
  if (turn <= 0 && drift <= 0) return;
  const half = mesh.userData.size.width / 2;
  const rest = mesh.userData.yaw;
  const yaw = rest + turn * FILE.turn;
  mesh.rotation.y = yaw;
  mesh.position.x += (Math.cos(rest) - Math.cos(yaw)) * half + drift * FILE.slide;
  mesh.position.y += drift * FILE.lift;
  mesh.position.z += (Math.sin(yaw) - Math.sin(rest)) * half - turn * FILE.recede;
};

const cardSpot = (index) => new THREE.Vector3(1.6 + (index % 2 ? 0.08 : -0.08), ((index % 3) - 1) * 0.35, -2 - SPACING * index);

// Cubic from 0 to 1 over x in [0, 1] with slope a at the start and b at the end.
const hermite = (x, a, b) => a * (x * x * x - 2 * x * x + x) + (3 * x * x - 2 * x * x * x) + b * (x * x * x - x * x);

const glowTexture = (width, height, draw) => {
  const canvas = makeCanvas(width, height);
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// The same test in JS, without the leaves: is this point in a sunbeam?
const inBeam = (x, y, z, margin = 0) => {
  const travel = (HALL.right - x) / SUN.x;
  const along = z + travel * SUN.z - WINDOW.z;
  const u = (along - Math.round(along / SPACING) * SPACING) / WINDOW.width + 0.5;
  const v = (y + travel * SUN.y - WINDOW.sill) / (WINDOW.head - WINDOW.sill);
  return u > margin && u < 1 - margin && v > margin && v < 1 - margin;
};

// Sunlight through the windows, shared by every surface, the haze and the dust.
// The sun ray from a point is followed back to the window wall; the window cells
// repeat down the hall, every other one mirrored so the leaves don't line up.
const SUN_GLSL = /* glsl */ `
#define CARDS ${PROJECTS.length}
#define CARD_Z0 (${cardSpot(0).z.toFixed(3)})
#define CARD_BAY (${SPACING.toFixed(3)})
#define SHADE_LEAD (${((SHADE_REACH - 0.5) / 2).toFixed(3)})
// Width of the soft edge of a card's shadow in the haze.
#define SHADE_SOFT 0.3
uniform sampler2D uGobo;
uniform vec4 uSun;      // xyz: toward the sun; w: 1 / x
uniform vec4 uBays;     // window wall x, centre z of one window, bay length, 1 / bay length
uniform vec4 uOpening;  // 1 / width, sill, head, 1 / (head - sill)
uniform vec4 uGoboRect; // the opening's corners in the gobo (uv)
uniform float uSoft;    // penumbra growth per unit the light has travelled
uniform float uHalfWidth;
uniform mat4 uCards[CARDS];   // world to card space
uniform vec3 uCardSun[CARDS]; // toward the sun, in card space
uniform vec2 uCardHalf[CARDS];
#define FLOOR (${HALL.floor.toFixed(3)})
#define POOL_X (${POOL_X.toFixed(3)})
#define PLANKS vec2(${PLANKS.map((n) => n.toFixed(3)).join(', ')})

vec2 sunCell(vec3 p, out float travel) {
  travel = max(uBays.x - p.x, 0.0) * uSun.w;
  float along = p.z + travel * uSun.z - uBays.y;
  float cell = floor(along * uBays.w + 0.5);
  vec2 local = vec2((along - cell * uBays.z) * uOpening.x + 0.5, (p.y + travel * uSun.y - uOpening.y) * uOpening.w);
  local.x = mod(cell, 2.0) > 0.5 ? 1.0 - local.x : local.x;
  return local;
}

float inOpening(vec2 local) {
  vec2 edge = step(vec2(0.0), local) * step(local, vec2(1.0));
  return edge.x * edge.y;
}

// Sun reaching p (0..1) at an explicit blur level: for the haze and the dust.
float sunAt(vec3 p, float lod) {
  float travel;
  vec2 local = sunCell(p, travel);
  return textureLod(uGobo, mix(uGoboRect.xy, uGoboRect.zw, local), lod + log2(1.0 + travel * uSoft)).r * inOpening(local);
}

// How much of the sun a card takes from p (0..1). Only one card can: the one
// hanging up to SHADE_REACH beyond p. The ray toward the sun meets its plane, and
// the edge softens with the distance behind the card, like the window's light.
float cardShade(vec3 p) {
  float slot = floor((CARD_Z0 + SHADE_LEAD - p.z) / CARD_BAY + 0.5);
  if (slot < 0.0 || slot > float(CARDS - 1)) return 0.0;
  int k = int(slot);
  vec3 q = (uCards[k] * vec4(p, 1.0)).xyz;
  vec3 s = uCardSun[k];
  if (q.z <= 0.0 || s.z > -0.05) return 0.0;
  float t = q.z / -s.z;
  vec2 hit = abs(q.xy + t * s.xy);
  vec2 soft = vec2(0.02 + t * uSoft * 0.25);
  vec2 inside = smoothstep(-soft, soft, uCardHalf[k] - hit);
  return inside.x * inside.y;
}
`;

// Sunlit haze between the eye and a surface. Along an eye ray, the point where
// each sample's sun ray meets the window wall moves in a straight line, so the
// stretches of the ray lit through each window can be solved for: first the band
// between sill and head, then each window's width in turn, nearest first. All
// the taps land inside those stretches, a few per window, jittered per pixel
// (and per window, so the windows' errors don't line up).
const HAZE_GLSL = /* glsl */ `
uniform vec3 uHaze;      // scattered light per unit of sunlit path
uniform float uHazeReach;
#define HAZE_WINDOWS 6
#define HAZE_TAPS 6

// Ray parameter where a + s * b reaches the value v (b kept away from zero).
float reach(float v, float a, float b) {
  return (v - a) / (b >= 0.0 ? max(b, 1e-4) : min(b, -1e-4));
}

// The share of the eye ray between s0 and s1 that a card keeps the sun from,
// solved along the ray (point taps would make the shadow's edge grainy). The
// card is the one that can shade the stretch's middle. In card space, the sun
// ray from the eye ray's point s meets the card's plane at h0 + s * hd; the
// shadow is where that lies inside the card while the point is in front of it.
// Its edge is softened by averaging a smaller and a larger outline.
float shadeAlong(vec3 dir, float s0, float s1) {
  float slot = floor((CARD_Z0 + SHADE_LEAD - cameraPosition.z - dir.z * 0.5 * (s0 + s1)) / CARD_BAY + 0.5);
  if (slot < 0.0 || slot > float(CARDS - 1)) return 0.0;
  int k = int(slot);
  vec3 sun = uCardSun[k];
  vec3 a = (uCards[k] * vec4(cameraPosition, 1.0)).xyz;
  vec3 b = mat3(uCards[k]) * dir;
  float lift = 1.0 / max(-sun.z, 0.05);
  vec2 h0 = a.xy + a.z * lift * sun.xy;
  vec2 hd = b.xy + b.z * lift * sun.xy;
  float plane = reach(0.0, a.z, b.z);
  float lo = b.z >= 0.0 ? max(s0, plane) : s0;
  float hi = b.z >= 0.0 ? s1 : min(s1, plane);
  float shade = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 extent = uCardHalf[k] + (float(i) - 0.5) * SHADE_SOFT;
    vec2 e0 = vec2(reach(-extent.x, h0.x, hd.x), reach(-extent.y, h0.y, hd.y));
    vec2 e1 = vec2(reach(extent.x, h0.x, hd.x), reach(extent.y, h0.y, hd.y));
    vec2 enter = min(e0, e1);
    vec2 leave = max(e0, e1);
    shade += max(min(hi, min(leave.x, leave.y)) - max(lo, max(enter.x, enter.y)), 0.0);
  }
  return 0.5 * shade / max(s1 - s0, 1e-4);
}

vec3 sunHaze(vec3 p) {
  vec3 ray = p - cameraPosition;
  float dist = length(ray);
  vec3 dir = ray / max(dist, 1e-4);
  vec3 wall = cameraPosition + (uBays.x - cameraPosition.x) * uSun.w * uSun.xyz;
  vec3 slide = dir - dir.x * uSun.w * uSun.xyz;
  float ya = reach(uOpening.y, wall.y, slide.y);
  float yb = reach(uOpening.z, wall.y, slide.y);
  float s0 = max(0.0, min(ya, yb));
  float s1 = min(min(dist, uHazeReach), max(ya, yb));
  if (s1 <= s0) return vec3(0.0);
  float z0 = wall.z - uBays.y;
  float cell = floor((z0 + s0 * slide.z) * uBays.w + 0.5);
  float onward = slide.z >= 0.0 ? 1.0 : -1.0;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float sum = 0.0;
  for (int i = 0; i < HAZE_WINDOWS; i++) {
    float centre = (cell + onward * float(i)) * uBays.z;
    float za = reach(centre - uHalfWidth, z0, slide.z);
    float zb = reach(centre + uHalfWidth, z0, slide.z);
    float a = max(s0, min(za, zb));
    float b = min(s1, max(za, zb));
    if (a >= s1) break;
    float stride = max(b - a, 0.0) / float(HAZE_TAPS);
    float phase = fract(jitter + float(i) * 0.618034);
    for (int j = 0; j < HAZE_TAPS; j++) {
      float lit = 1.0 - shadeAlong(dir, a + float(j) * stride, a + float(j + 1) * stride);
      sum += sunAt(cameraPosition + dir * (a + (float(j) + phase) * stride), 1.0) * lit * stride;
    }
  }
  return uHaze * sum;
}
`;

// The haze pass: the hall alone, from the room's camera, at half resolution.
const HAZE_FRAG = /* glsl */ `
${SUN_GLSL}
${HAZE_GLSL}
varying vec3 vWorld;
void main() {
  gl_FragColor = vec4(sunHaze(vWorld), 1.0);
}`;

const SURFACE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// Walls, floor and ceiling: texture from world position, a hemisphere fill, warm
// bounce off the nearest sunlit floor, the sun itself through the windows (on the
// floor, less what the cards shade), the window glass on the window wall, then
// the haze in front (from the haze pass; cards cover it where they hang in front
// of a wall).
const SURFACE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
${SUN_GLSL}
#define SKY_SHADE (${SKY_SHADE.toFixed(3)})
uniform sampler2D uHazeMap;
uniform vec2 uScreen;
uniform sampler2D uMap;
uniform sampler2D uBump;
uniform sampler2D uPanes;
uniform vec3 uTint;
uniform vec3 uFace;
uniform vec3 uAxisU;
uniform vec3 uAxisV;
uniform vec2 uTile;
uniform float uBumpScale;
uniform vec3 uSunLight;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uBounce;
uniform vec3 uGlass;
uniform float uGlassOn;
uniform sampler2D uBoards;
uniform float uDado;
uniform float uShaded;
varying vec3 vWorld;

// Sun on a surface: the gobo at the screen's own mip level, softer the further
// the light has come from the window.
float sunOn(vec3 p) {
  float travel;
  vec2 local = sunCell(p, travel);
  return texture(uGobo, mix(uGoboRect.xy, uGoboRect.zw, local), log2(1.0 + travel * uSoft)).r * inOpening(local);
}

// How much of the window at z = wz card k hides from p: the line to the window's
// middle meets the card's plane, and the edge softens by the window's size seen
// from there, so the shadow is broad and soft (the window is large and close).
float windowShade(vec3 p, int k, float wz) {
  vec3 q = (uCards[k] * vec4(p, 1.0)).xyz;
  vec3 d = mat3(uCards[k]) * (vec3(uBays.x, 0.5 * (uOpening.y + uOpening.z), wz) - p);
  if (abs(d.z) < 1e-3) return 0.0;
  float s = -q.z / d.z;
  if (s <= 0.0 || s >= 1.0) return 0.0;
  vec2 soft = s * vec2(0.5 / uOpening.x, 0.5 / uOpening.w) + 0.05;
  vec2 inside = smoothstep(-soft, soft, uCardHalf[k] - abs(q.xy + s * d.xy));
  return inside.x * inside.y;
}

// The room's sky and bounce light the cards keep off the floor. A point between
// two cards loses part of the window behind the nearer card and part of the window
// beyond the farther one; the windows level with it, which give it most of its
// light, stay open.
float skyShade(vec3 p) {
  float slot = floor((CARD_Z0 - p.z) / CARD_BAY);
  float shade = 0.0;
  if (slot >= 0.0 && slot <= float(CARDS - 1)) shade = windowShade(p, int(slot), CARD_Z0 - (slot - 0.5) * CARD_BAY);
  if (slot >= -1.0 && slot <= float(CARDS - 2)) shade = max(shade, windowShade(p, int(slot) + 1, CARD_Z0 - (slot + 1.5) * CARD_BAY));
  return shade;
}

void main() {
  vec2 uv = vec2(dot(vWorld, uAxisU), dot(vWorld, uAxisV)) * uTile;
  vec3 albedo = texture(uMap, uv).rgb * uTint;
  if (uDado > 0.0) {
    // Side walls: board panelling up to a rail, on a dark skirting.
    float h = vWorld.y - FLOOR;
    float aa = max(fwidth(h), 1e-4);
    vec3 panel = texture(uBoards, vec2(vWorld.z, h) / PLANKS).rgb * 0.62;
    albedo = mix(panel, albedo, smoothstep(uDado - aa, uDado + aa, h));
    float rail = smoothstep(uDado - aa, uDado + aa, h) * (1.0 - smoothstep(uDado + 0.09 - aa, uDado + 0.09 + aa, h));
    albedo = mix(albedo, vec3(0.3, 0.19, 0.11), rail);
    albedo *= mix(0.3, 1.0, smoothstep(0.2 - aa, 0.2 + aa, h));
  }
  vec3 bump = texture(uBump, uv).xyz * 2.0 - 1.0;
  vec3 n = normalize(uFace * bump.z + (uAxisU * bump.x + uAxisV * bump.y) * uBumpScale);
  float sun = sunOn(vWorld) * max(dot(n, uSun.xyz), 0.0);
  float room = 1.0;
  if (uShaded > 0.5) {
    sun *= 1.0 - cardShade(vWorld);
    room -= SKY_SHADE * skyShade(vWorld);
  }
  vec3 pool = vec3(POOL_X, FLOOR + 0.01, vWorld.z);
  vec3 off = vWorld - pool;
  float bounce = sunAt(pool, 5.0) / (1.0 + 0.06 * dot(off, off));
  vec3 color = albedo * ((mix(uGround, uSky, 0.5 + 0.5 * n.y) + uBounce * bounce) * room + uSunLight * sun);
  if (uGlassOn > 0.5) {
    float travel;
    vec2 local = sunCell(vWorld, travel);
    float pane = texture(uPanes, mix(uGoboRect.xy, uGoboRect.zw, local)).r * inOpening(local);
    color = mix(color, uGlass * (0.8 + 0.3 * local.y), pane);
  }
  // Four bilinear taps a half texel of the haze pass apart: a soft tent that
  // hides the half-resolution grain.
  vec2 at = gl_FragCoord.xy * uScreen;
  color += 0.25 * (texture(uHazeMap, at + uScreen * vec2(-1.0, -1.0)).rgb + texture(uHazeMap, at + uScreen * vec2(1.0, -1.0)).rgb
    + texture(uHazeMap, at + uScreen * vec2(-1.0, 1.0)).rgb + texture(uHazeMap, at + uScreen * vec2(1.0, 1.0)).rgb);
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
}`;

// Dust hangs in the hall and drifts; a mote glows while it is in a sunbeam.
const DUST_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
${SUN_GLSL}
attribute float aSeed;
uniform float uTime;
uniform float uSize;
uniform float uScale;
varying float vGlow;
void main() {
  vec3 drift = vec3(sin(uTime * 0.11 + aSeed * 23.0), sin(uTime * 0.07 + aSeed * 41.0), sin(uTime * 0.09 + aSeed * 13.0));
  vec4 world = modelMatrix * vec4(position + drift * 0.1, 1.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed) + aSeed * 60.0);
  vec4 mvPosition = viewMatrix * world;
  // Motes right at the lens would be blurry blobs: they fade out instead.
  float near = smoothstep(1.2, 3.0, -mvPosition.z);
  vGlow = (0.015 + sunAt(world.xyz, 1.0) * (1.0 - cardShade(world.xyz)) * twinkle) * near;
  gl_PointSize = min(uSize * (0.5 + fract(aSeed * 7.0)) * uScale / max(-mvPosition.z, 0.1), 8.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const DUST_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uDot;
uniform vec3 uColor;
varying float vGlow;
void main() {
  float fade = 1.0;
  #ifdef USE_FOG
    fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor = vec4(uColor * vGlow * fade * texture2D(uDot, gl_PointCoord).r, 1.0);
}`;

// The cards' gloss: the window wall as the coat reflects it. The reflected ray is
// followed to the wall and the window glass looked up there (the same panes the
// wall shows), blurred by the coat's spread, which grows with the distance. So the
// reflection sits where the real windows would, slides as the camera passes and
// stretches over the bowed paper. A sharp coat plus a broad, weaker sheen.
const GLINT_GLSL = /* glsl */ `
uniform sampler2D uPanes;
uniform vec4 uBays;
uniform vec4 uOpening;
uniform vec4 uGoboRect;
uniform vec3 uGlint;       // the windows' radiance, as the coat sees them
uniform vec4 uGlintSpread; // sharp spread, broad spread (radians), broad weight, z of the hall's near end
varying vec3 vRoomWorld;

float windowSeen(vec3 p, vec3 r, float spread) {
  float rx = max(r.x, 0.02);
  float t = (uBays.x - p.x) / rx;
  vec3 h = p + r * t;
  float along = h.z - uBays.y;
  float cell = floor(along * uBays.w + 0.5);
  vec2 local = vec2((along - cell * uBays.z) * uOpening.x + 0.5, (h.y - uOpening.y) * uOpening.w);
  local.x = mod(cell, 2.0) > 0.5 ? 1.0 - local.x : local.x;
  // The blur's footprint on the wall, stretched along it where the ray grazes it.
  vec2 blur = spread * t * vec2(uOpening.x / rx, uOpening.w) + 0.006;
  vec2 edge = smoothstep(-blur, blur, local) * smoothstep(-blur, blur, 1.0 - local);
  vec2 texels = vec2(${WINDOW.gobo[2] - WINDOW.gobo[0]}.0, ${WINDOW.gobo[3] - WINDOW.gobo[1]}.0);
  vec2 footprint = max(blur, fwidth(local)) * texels;
  float lod = min(log2(1.0 + sqrt(footprint.x * footprint.y)), 9.0);
  float glass = textureLod(uPanes, mix(uGoboRect.xy, uGoboRect.zw, clamp(local, 0.0, 1.0)), lod).r;
  float hall = 1.0 - smoothstep(uGlintSpread.w - 1.5, uGlintSpread.w, h.z);
  return glass * edge.x * edge.y * hall * step(0.02, r.x) * (0.8 + 0.3 * local.y);
}
`;

const GLINT_MAIN = /* glsl */ `
{
  vec3 coatNormal = inverseTransformDirection(normal, viewMatrix);
  vec3 eye = normalize(vRoomWorld - cameraPosition);
  vec3 mirror = reflect(eye, coatNormal);
  float fresnel = 0.04 + 0.96 * pow(1.0 - saturate(dot(coatNormal, -eye)), 5.0);
  float seen = windowSeen(vRoomWorld, mirror, uGlintSpread.x) + uGlintSpread.z * windowSeen(vRoomWorld, mirror, uGlintSpread.y);
  outgoingLight += uGlint * fresnel * seen;
}
`;

// Adds the window gloss to a print material, after whatever it already does to its
// shader (the develop effect).
const coat = (material, uniforms) => {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoomWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRoomWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLINT_GLSL}`)
      .replace('#include <opaque_fragment>', `${GLINT_MAIN}\n#include <opaque_fragment>`)
      // The back of a print is plain paper, not the photo seen through it.
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.94, 0.91, 0.85);');
  };
  material.customProgramCacheKey = () => `${key}-glint`;
};

// A card's sheet, bent to curlZ.
const curledSheet = (width, height) => {
  const geometry = new THREE.PlaneGeometry(width, height, 32, 24);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) position.setZ(i, curlZ(position.getX(i), position.getY(i), width, height));
  geometry.computeVertexNormals();
  return geometry;
};

// Re-meshes tape or a sticker (a flat child of the card) so it follows the curled
// sheet under it and keeps its height above it.
const stickTo = (piece, { width, height }) => {
  const { width: w, height: h } = piece.geometry.parameters;
  const geometry = new THREE.PlaneGeometry(w, h, 12, 6);
  const position = geometry.attributes.position;
  const { x, y } = piece.position;
  const cos = Math.cos(piece.rotation.z);
  const sin = Math.sin(piece.rotation.z);
  for (let i = 0; i < position.count; i += 1) {
    const u = position.getX(i);
    const v = position.getY(i);
    position.setZ(i, curlZ(x + u * cos - v * sin, y + u * sin + v * cos, width, height));
  }
  geometry.computeVertexNormals();
  piece.geometry.dispose();
  piece.geometry = geometry;
};

export class RoomChapter {
  constructor(app) {
    this.app = app;
    this.name = 'room';
    this.ready = false;
    this.look = { ...ROOM_LOOK };
    this.active = 0;
    this.focus = [];
  }

  async build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1b12);
    scene.fog = new THREE.Fog(0x2a1b12, 14, 80);
    this.scene = scene;

    const names = ['gobo', 'window-panes', 'tape-cream', 'tape-pink', 'tape-blue', 'tape-yellow', 'badge-top5', ...PROJECTS.map((p) => p.tex)];
    const tex = {};
    await Promise.all(names.map(async (name) => { tex[name] = await texture(name); }));
    // The plaster is shared with the wall (same options, so whichever loads it first
    // agrees); the floorboards are the room's own.
    tex.plaster = await texture('plaster', { srgb: true, repeat: [3, 1] });
    tex['plaster-n'] = await texture('plaster-n', { srgb: false, repeat: [3, 1] });
    tex.floor = await texture('room-floor', { repeat: [1, 1] });

    const [g0, g1, g2, g3] = WINDOW.gobo.map((px) => px / 1024);
    this.sun = {
      uGobo: { value: tex.gobo },
      uSun: { value: new THREE.Vector4(SUN.x, SUN.y, SUN.z, 1 / SUN.x) },
      uBays: { value: new THREE.Vector4(HALL.right, WINDOW.z, SPACING, 1 / SPACING) },
      uOpening: { value: new THREE.Vector4(1 / WINDOW.width, WINDOW.sill, WINDOW.head, 1 / (WINDOW.head - WINDOW.sill)) },
      uGoboRect: { value: new THREE.Vector4(g0, 1 - g3, g2, 1 - g1) },
      uSoft: { value: 0.25 },
      uHalfWidth: { value: WINDOW.width / 2 },
      uCards: { value: PROJECTS.map(() => new THREE.Matrix4()) },
      uCardSun: { value: PROJECTS.map(() => new THREE.Vector3()) },
      uCardHalf: { value: PROJECTS.map(() => new THREE.Vector2()) },
    };
    this.hall(tex);
    this.dust();

    // Light for the cards: warm key from behind the viewer, sky fill, and in the
    // coat the windows themselves (GLINT_GLSL).
    const key = new THREE.DirectionalLight(0xffc08a, 2.1);
    key.position.set(-4, 6, 8);
    scene.add(key, new THREE.HemisphereLight(0x6c5a7a, 0x20140c, 0.65));
    scene.environment = this.environment();
    scene.environmentIntensity = 0.45;
    const glint = {
      uPanes: { value: tex['window-panes'] },
      uBays: this.sun.uBays,
      uOpening: this.sun.uOpening,
      uGoboRect: this.sun.uGoboRect,
      uGlint: { value: new THREE.Color(1, 0.62, 0.36).multiplyScalar(7) },
      uGlintSpread: { value: new THREE.Vector4(0.03, 0.25, 0.5, HALL.near) },
    };

    // The cards: curled sheets, tape and stickers following the curl.
    this.cards = PROJECTS.map((project, index) => {
      const map = tex[project.tex];
      const rects = project.typeCard ? [] : [instantRect(map.userData.size, project.ratio)];
      const mesh = card(map, project.width, { rects, curl: 0, gloss: 0.45, segments: [1, 1] });
      const { size } = mesh.userData;
      mesh.geometry.dispose();
      mesh.geometry = curledSheet(size.width, size.height);
      coat(mesh.material, glint);
      this.sun.uCardHalf.value[index].set(size.width / 2, size.height / 2);
      const spot = cardSpot(index);
      mesh.position.copy(spot);
      mesh.rotation.set(0, -0.2 + (index % 2 ? 0.08 : -0.04), (index % 2 ? 1 : -1) * 0.045);
      mesh.userData.home = spot.clone();
      mesh.userData.spin = mesh.rotation.z;
      mesh.userData.yaw = mesh.rotation.y;
      stickTo(tapeTop(mesh, tex[`tape-${project.tape}`], { width: 0.62, rot: (index % 3 - 1) * 0.12 }), size);
      if (project.badge) {
        const badge = sticker(tex[project.badge], 0.95);
        badge.position.set(size.width / 2 - 0.25, size.height / 2 - 0.35, 0.06);
        badge.rotation.z = 0.2;
        stickTo(badge, size);
        coat(badge.material, glint);
        mesh.add(badge);
      }
      scene.add(mesh);
      return mesh;
    });

    // Camera keys: one in front of each card, plus an establishing key and an exit key.
    // The camera stands well left of each card and looks right toward it, so it passes
    // every card with room to spare and the card sits right of the caption column.
    const posKeys = [new THREE.Vector3(0.2, 0.4, 7.5)];
    const lookKeys = [new THREE.Vector3(0.6, 0.1, -6)];
    this.cards.forEach((mesh) => {
      const home = mesh.userData.home;
      posKeys.push(new THREE.Vector3(home.x - 2.2, home.y + 0.12, home.z + STAND));
      lookKeys.push(new THREE.Vector3(home.x - 1.45, home.y - 0.05, home.z));
    });
    // The exit key eases off the last card without closing in on it, so it stays whole
    // in frame while the room hands over to the desk.
    const last = this.cards.at(-1).userData.home;
    posKeys.push(new THREE.Vector3(last.x - 2.6, last.y - 0.2, last.z + 5));
    lookKeys.push(new THREE.Vector3(last.x - 1.5, last.y - 1.2, last.z - 6));
    this.posCurve = new THREE.CatmullRomCurve3(posKeys, false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(lookKeys, false, 'centripetal');
    this.keyCount = posKeys.length;

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
    // Compile the haze pass now, not in the first frame that needs it.
    const { renderer } = this.app;
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(this.haze);
    const compiled = renderer.compileAsync(this.hazeScene, this.camera);
    renderer.setRenderTarget(target);
    await compiled;
    this.ready = true;
  }

  // Floor, ceiling, both side walls and the two ends, each a single quad shaded
  // by SURFACE_FRAG. Textures run in world units, so every wall matches. The same
  // quads, alone in their own scene, draw the haze pass.
  hall(tex) {
    const { left, right, floor, ceiling, near, far } = HALL;
    const width = right - left;
    const height = ceiling - floor;
    const length = near - far;
    const mid = new THREE.Vector3((left + right) / 2, (floor + ceiling) / 2, (near + far) / 2);
    const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    flat.needsUpdate = true;
    const X = new THREE.Vector3(1, 0, 0);
    const Y = new THREE.Vector3(0, 1, 0);
    const Z = new THREE.Vector3(0, 0, 1);
    const plaster = { map: tex.plaster, bump: tex['plaster-n'], tile: [1 / 8, 1 / 4.9], tint: new THREE.Color(0x8a6e5c), bumpScale: 0.8 };
    const boards = { map: tex.floor, bump: flat, tile: PLANKS.map((n) => 1 / n), tint: new THREE.Color(1, 1, 1), bumpScale: 0 };
    const surfaces = [
      { name: 'floor', size: [width, length], at: [mid.x, floor, mid.z], turn: [-Math.PI / 2, 0], face: Y, u: X, v: Z, ...boards, shaded: true },
      { name: 'ceiling', size: [width, length], at: [mid.x, ceiling, mid.z], turn: [Math.PI / 2, 0], face: Y.clone().negate(), u: X, v: Z, ...plaster, tint: new THREE.Color(0x6e5848) },
      { name: 'left', size: [length, height], at: [left, mid.y, mid.z], turn: [0, Math.PI / 2], face: X, u: Z, v: Y, ...plaster, dado: 1.15 },
      { name: 'right', size: [length, height], at: [right, mid.y, mid.z], turn: [0, -Math.PI / 2], face: X.clone().negate(), u: Z, v: Y, ...plaster, dado: 1.15, glass: true },
      { name: 'far', size: [width, height], at: [mid.x, mid.y, far], turn: [0, 0], face: Z, u: X, v: Y, ...plaster },
      { name: 'near', size: [width, height], at: [mid.x, mid.y, near], turn: [0, Math.PI], face: Z.clone().negate(), u: X, v: Y, ...plaster },
    ];
    const sky = new THREE.Color(0xb5c6e4).multiplyScalar(0.7);
    const ground = new THREE.Color(0x7a5a44).multiplyScalar(0.9);
    this.haze = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.hazeScene = new THREE.Scene();
    this.hazeScene.background = new THREE.Color(0x000000);
    this.screen = new THREE.Vector2(1, 1);
    const hazeMaterial = new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERT,
      fragmentShader: HAZE_FRAG,
      uniforms: {
        ...this.sun,
        uHaze: { value: new THREE.Color(0xffc28a).multiplyScalar(0.2) },
        uHazeReach: { value: 40 },
      },
    });
    this.surfaces = surfaces.map((spec) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERT,
        fragmentShader: SURFACE_FRAG,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          ...this.sun,
          uHazeMap: { value: this.haze.texture },
          uScreen: { value: this.screen },
          uMap: { value: spec.map },
          uBump: { value: spec.bump },
          uPanes: { value: tex['window-panes'] },
          uTint: { value: spec.tint },
          uFace: { value: spec.face },
          uAxisU: { value: spec.u },
          uAxisV: { value: spec.v },
          uTile: { value: new THREE.Vector2(...spec.tile) },
          uBumpScale: { value: spec.bumpScale },
          uSunLight: { value: SUN_LIGHT },
          uSky: { value: sky },
          uGround: { value: ground },
          uBounce: { value: new THREE.Color(0xffc28a).multiplyScalar(0.8) },
          uGlass: { value: new THREE.Color(1, 0.55, 0.25).multiplyScalar(2.5) },
          uGlassOn: { value: spec.glass ? 1 : 0 },
          uBoards: { value: tex.floor },
          uDado: { value: spec.dado ?? 0 },
          uShaded: { value: spec.shaded ? 1 : 0 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...spec.size), material);
      mesh.position.set(...spec.at);
      mesh.rotation.set(spec.turn[0], spec.turn[1], 0);
      mesh.name = spec.name;
      this.scene.add(mesh);
      const air = new THREE.Mesh(mesh.geometry, hazeMaterial);
      air.position.copy(mesh.position);
      air.rotation.copy(mesh.rotation);
      this.hazeScene.add(air);
      return mesh;
    });
  }

  // Marches the sunlit haze at half resolution before the room is drawn, and
  // leaves the renderer pointed at the room's own target.
  hazePass(size) {
    const { renderer } = this.app;
    this.screen.set(1 / size.x, 1 / size.y);
    const width = Math.max(1, Math.round(size.x / 2));
    const height = Math.max(1, Math.round(size.y / 2));
    if (this.haze.width !== width || this.haze.height !== height) this.haze.setSize(width, height);
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(this.haze);
    renderer.render(this.hazeScene, this.camera);
    renderer.setRenderTarget(target);
  }

  // Motes fill the hall, most of them where the beams are (elsewhere they are
  // nearly invisible anyway), and glow while the sun is on them.
  dust() {
    const rand = random(17);
    const count = 12000;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let k = 0; k < count;) {
      const x = HALL.left + 0.2 + rand() * (HALL.right - HALL.left - 0.4);
      const y = HALL.floor + 0.05 + rand() * (HALL.ceiling - HALL.floor - 0.3);
      const z = HALL.far + 50 + rand() * (HALL.near - HALL.far - 50);
      if (inBeam(x, y, z, -0.1) || rand() < 0.08) {
        positions.set([x, y, z], k * 3);
        seeds[k] = rand();
        k += 1;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const dot = glowTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    this.dustUniforms = {
      uTime: { value: 0 },
      uSize: { value: 0.07 },
      uScale: { value: 540 },
      uDot: { value: dot },
      uColor: { value: new THREE.Color(1, 0.7, 0.42).multiplyScalar(1.8) },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...this.sun, ...this.dustUniforms },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(geometry, material);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  environment() {
    const room = new THREE.Scene();
    room.background = new THREE.Color(0x0b0705);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.5).multiplyScalar(6), side: THREE.DoubleSide }));
    panel.position.set(-8, 6, 8);
    panel.lookAt(0, 0, 0);
    room.add(panel);
    const pmrem = new THREE.PMREMGenerator(this.app.renderer);
    const target = pmrem.fromScene(room, 0.03);
    pmrem.dispose();
    return target.texture;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 58 : 36;
    this.camera.updateProjectionMatrix();
  }

  // Flight parameter c: -1 at the establishing shot, j at card j, n - 0.5 at the end.
  // The camera slows to 1 - DWELL speed at each card. The first and last half card ease
  // from and to rest, so the flight neither jumps off the entry nor stops dead.
  flight(v) {
    const n = this.cards.length;
    const u = progress(v, T.projects.flight) * n;
    const enter = smooth(progress(v, [T.transitions.wallToRoom[0], T.projects.flight[0]]));
    if (v < T.projects.flight[0]) return -1 + 0.5 * enter;
    if (u < 0.5) return 0.5 * hermite(2 * u, 0, 1 - DWELL) - 0.5;
    if (u > n - 0.5) return n - 1 + 0.5 * hermite(2 * u - 2 * n + 1, 1 - DWELL, 0);
    return u - (DWELL * Math.sin(2 * Math.PI * (u - 0.5))) / (2 * Math.PI) - 0.5;
  }

  update(v, time) {
    const c = this.flight(v);
    const t = clamp01((c + 1) / (this.keyCount - 1));
    this.camera.position.copy(this.posCurve.getPoint(t));
    const look = this.lookCurve.getPoint(t);
    if (this.camera.aspect < 1) this.camera.position.x += 0.9;
    this.camera.lookAt(look);

    const { uCards, uCardSun } = this.sun;
    this.cards.forEach((mesh, j) => {
      const home = mesh.userData.home;
      mesh.position.set(home.x, home.y + Math.sin(time * 0.6 + j) * 0.05, home.z);
      mesh.rotation.set(0, mesh.userData.yaw, mesh.userData.spin + Math.sin(time * 0.4 + j * 1.7) * 0.012);
      if (j < this.cards.length - 1) fileAway(mesh, c - j);
      mesh.updateMatrixWorld();
      uCards.value[j].copy(mesh.matrixWorld).invert();
      uCardSun.value[j].copy(SUN).transformDirection(uCards.value[j]);
      const develop = mesh.material.userData.develop;
      if (develop) develop[0] = smooth(progress(c, [j - 0.95, j - 0.3]));
    });
    this.focus = this.cards.map((_, j) => focusOn(c - j));
    this.active = Math.max(0, Math.min(this.cards.length - 1, Math.round(c)));
    const size = this.app.renderer.getDrawingBufferSize(SIZE);
    this.hazePass(size);
    this.dustUniforms.uTime.value = time;
    this.dustUniforms.uScale.value = size.y / 2;
  }

  stills(v) {
    // Reduced motion: no flight; show the card nearest this scroll position.
    return v;
  }
}
