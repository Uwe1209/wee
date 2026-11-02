// The room: a long, dim gallery the camera walks down. Late sun comes in
// through a row of windows in the right-hand wall and lands on the floorboards
// as warm, window-shaped patches; the shafts in between carry glowing dust.
// Project cards hang down the hall; the camera flies past them, slowing at
// each, and each photo develops as it comes close.
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

export const ROOM_LOOK = {
  bloom: 0.08, halation: 0.3, exposure: 1.18, saturation: 1.0, contrast: 1.05,
  lift: [0.02, 0.012, 0.008], gain: [1.03, 0.99, 0.94], grain: 0.055, vignette: 0.45,
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
uniform sampler2D uGobo;
uniform vec4 uSun;      // xyz: toward the sun; w: 1 / x
uniform vec4 uBays;     // window wall x, centre z of one window, bay length, 1 / bay length
uniform vec4 uOpening;  // 1 / width, sill, head, 1 / (head - sill)
uniform vec4 uGoboRect; // the opening's corners in the gobo (uv)
uniform float uSoft;    // penumbra growth per unit the light has travelled

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
  float side = 0.5 / uOpening.x;
  float cell = floor((z0 + s0 * slide.z) * uBays.w + 0.5);
  float onward = slide.z >= 0.0 ? 1.0 : -1.0;
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float sum = 0.0;
  for (int i = 0; i < HAZE_WINDOWS; i++) {
    float centre = (cell + onward * float(i)) * uBays.z;
    float za = reach(centre - side, z0, slide.z);
    float zb = reach(centre + side, z0, slide.z);
    float a = max(s0, min(za, zb));
    float b = min(s1, max(za, zb));
    if (a >= s1) break;
    float stride = max(b - a, 0.0) / float(HAZE_TAPS);
    float phase = fract(jitter + float(i) * 0.618034);
    for (int j = 0; j < HAZE_TAPS; j++) {
      sum += sunAt(cameraPosition + dir * (a + (float(j) + phase) * stride), 1.0) * stride;
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
// bounce off the nearest sunlit floor, the sun itself through the windows, the
// window glass on the window wall, then the haze in front (from the haze pass;
// cards cover it where they hang in front of a wall).
const SURFACE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
${SUN_GLSL}
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
varying vec3 vWorld;

// Sun on a surface: the gobo at the screen's own mip level, softer the further
// the light has come from the window.
float sunOn(vec3 p) {
  float travel;
  vec2 local = sunCell(p, travel);
  return texture(uGobo, mix(uGoboRect.xy, uGoboRect.zw, local), log2(1.0 + travel * uSoft)).r * inOpening(local);
}

void main() {
  vec2 uv = vec2(dot(vWorld, uAxisU), dot(vWorld, uAxisV)) * uTile;
  vec3 albedo = texture(uMap, uv).rgb * uTint;
  vec3 bump = texture(uBump, uv).xyz * 2.0 - 1.0;
  vec3 n = normalize(uFace * bump.z + (uAxisU * bump.x + uAxisV * bump.y) * uBumpScale);
  float sun = sunOn(vWorld) * max(dot(n, uSun.xyz), 0.0);
  vec3 pool = vec3(1.7, ${HALL.floor.toFixed(2)} + 0.01, vWorld.z);
  vec3 off = vWorld - pool;
  float bounce = sunAt(pool, 5.0) / (1.0 + 0.12 * dot(off, off));
  vec3 color = albedo * (mix(uGround, uSky, 0.5 + 0.5 * n.y) + uBounce * bounce + uSunLight * sun);
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
  vGlow = (0.015 + sunAt(world.xyz, 1.0) * twinkle) * near;
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
    };
    this.hall(tex);
    this.dust();

    // Light for the cards: warm key from behind the viewer, sky fill, glossy
    // reflections of a bright window.
    const key = new THREE.DirectionalLight(0xffc08a, 2.1);
    key.position.set(-4, 6, 8);
    scene.add(key, new THREE.HemisphereLight(0x6c5a7a, 0x20140c, 0.65));
    scene.environment = this.environment();
    scene.environmentIntensity = 0.45;

    // The cards.
    this.cards = PROJECTS.map((project, index) => {
      const map = tex[project.tex];
      const rects = project.typeCard ? [] : [instantRect(map.userData.size, project.ratio)];
      const mesh = card(map, project.width, { rects, curl: 0.16, cup: 0.08, lift: 0.3, gloss: 0.45 });
      const spot = cardSpot(index);
      mesh.position.copy(spot);
      mesh.rotation.set(0, -0.2 + (index % 2 ? 0.08 : -0.04), (index % 2 ? 1 : -1) * 0.045);
      mesh.userData.home = spot.clone();
      mesh.userData.spin = mesh.rotation.z;
      tapeTop(mesh, tex[`tape-${project.tape}`], { width: 0.62, rot: (index % 3 - 1) * 0.12 });
      if (project.badge) {
        const badge = sticker(tex[project.badge], 0.95);
        badge.position.set(project.width / 2 - 0.25, mesh.userData.size.height / 2 - 0.35, 0.06);
        badge.rotation.z = 0.2;
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
    const last = this.cards.at(-1).userData.home;
    posKeys.push(new THREE.Vector3(last.x - 1.6, last.y - 0.4, last.z + 1.6));
    lookKeys.push(new THREE.Vector3(last.x - 1.2, last.y - 2.4, last.z - 8));
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
    const linear = (hex, scale) => new THREE.Color(hex).multiplyScalar(scale);
    const plaster = { map: tex.plaster, bump: tex['plaster-n'], tile: [1 / 8, 1 / 4.9], tint: linear(0x8a6e5c, 1), bumpScale: 0.8 };
    const boards = { map: tex.floor, bump: flat, tile: [1 / 2.88, 1 / 5.76], tint: linear(0xffffff, 1), bumpScale: 0 };
    const surfaces = [
      { name: 'floor', size: [width, length], at: [mid.x, floor, mid.z], turn: [-Math.PI / 2, 0], face: Y, u: X, v: Z, ...boards },
      { name: 'ceiling', size: [width, length], at: [mid.x, ceiling, mid.z], turn: [Math.PI / 2, 0], face: Y.clone().negate(), u: X, v: Z, ...plaster, tint: linear(0x6e5848, 1) },
      { name: 'left', size: [length, height], at: [left, mid.y, mid.z], turn: [0, Math.PI / 2], face: X, u: Z, v: Y, ...plaster },
      { name: 'right', size: [length, height], at: [right, mid.y, mid.z], turn: [0, -Math.PI / 2], face: X.clone().negate(), u: Z, v: Y, ...plaster, glass: true },
      { name: 'far', size: [width, height], at: [mid.x, mid.y, far], turn: [0, 0], face: Z, u: X, v: Y, ...plaster },
      { name: 'near', size: [width, height], at: [mid.x, mid.y, near], turn: [0, Math.PI], face: Z.clone().negate(), u: X, v: Y, ...plaster },
    ];
    const sky = new THREE.Color(0xb5c6e4).multiplyScalar(0.55);
    const ground = new THREE.Color(0x7a5a44).multiplyScalar(0.7);
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
          uBounce: { value: new THREE.Color(0xffc28a).multiplyScalar(0.5) },
          uGlass: { value: new THREE.Color(1, 0.55, 0.25).multiplyScalar(2.5) },
          uGlassOn: { value: spec.glass ? 1 : 0 },
        },
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...spec.size), material);
      mesh.position.set(...spec.at);
      mesh.rotation.set(spec.turn[0], spec.turn[1], 0);
      mesh.name = spec.name;
      this.scene.add(mesh);
      const veil = new THREE.Mesh(mesh.geometry, hazeMaterial);
      veil.position.copy(mesh.position);
      veil.rotation.copy(mesh.rotation);
      this.hazeScene.add(veil);
      return mesh;
    });
  }

  // Marches the sunlit haze at half resolution before the room is drawn, and
  // leaves the renderer pointed at the room's own target.
  hazePass() {
    const { renderer } = this.app;
    renderer.getDrawingBufferSize(SIZE);
    this.screen.set(1 / SIZE.x, 1 / SIZE.y);
    const width = Math.max(1, Math.round(SIZE.x / 2));
    const height = Math.max(1, Math.round(SIZE.y / 2));
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

    this.cards.forEach((mesh, j) => {
      const home = mesh.userData.home;
      mesh.position.set(home.x, home.y + Math.sin(time * 0.6 + j) * 0.05, home.z);
      mesh.rotation.z = mesh.userData.spin + Math.sin(time * 0.4 + j * 1.7) * 0.012;
      const develop = mesh.material.userData.develop;
      if (develop) develop[0] = smooth(progress(c, [j - 0.95, j - 0.3]));
    });
    this.focus = this.cards.map((_, j) => 1 - smooth(clamp01((Math.abs(c - j) - 0.16) / 0.3)));
    this.active = Math.max(0, Math.min(this.cards.length - 1, Math.round(c)));
    this.hazePass();
    this.dustUniforms.uTime.value = time;
    this.dustUniforms.uScale.value = SIZE.y / 2;
  }

  stills(v) {
    // Reduced motion: no flight; show the card nearest this scroll position.
    return v;
  }
}
