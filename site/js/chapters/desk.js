// The scrapbook: a dot-grid page on the desk, the same window light falling
// across it. Dodgeball memories get slapped onto the page as you scroll.
import * as THREE from 'three';
import { TIMELINE as T, clamp01, lerp, progress, smooth } from '../motion/timeline.js';
import { texture } from '../engine/textures.js';
import { card, instantRect, place, sticker, tape } from '../engine/paper3d.js';

export const DESK_LOOK = {
  bloom: 0.035, halation: 0.12, exposure: 1.04, saturation: 1.0, contrast: 1.03,
  lift: [0.016, 0.01, 0.004], gain: [1.02, 0.995, 0.96], grain: 0.04, vignette: 0.24,
};

const backOut = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

// The sun is low, so a memory still in the air would throw its real shadow far
// across the page. While it drops it casts none; a soft shadow rides under it
// instead, wider, blurrier and fainter the higher it is, and tightens to the
// real contact shadow's size and strength just as it hands back on landing.
const AIR_SHADOW = {
  handoff: 0.01, // height above its spot where the real contact shadow takes over
  plane: 0.24, // a raised piece's shadow lies here, above every landed piece
  blur: [0.06, 0.05], // at contact: the sun's PCF footprint on the page, longer along the light
  soften: 0.2, // extra blur per unit of height
  spread: 0.06, // growth past the piece's edges per unit of height
  fade: 0.35, // strength falls as exp(-fade * height)
  drift: 0.1, // how far the shadow leans away from the sun, per unit of height
  selfShade: 0.78, // sunlight a landed piece keeps on itself (its PCF taps partly fall behind its own surface)
};

// Lit as the page under it (slid along the view ray to z = 0), so it sees the same window gobo.
const AIR_SHADOW_VERTEX = /* glsl */ `
#include <worldpos_vertex>
#if NUM_SPOT_LIGHT_COORDS > 0
  vec3 toEye = cameraPosition - worldPosition.xyz;
  worldPosition.xyz -= toEye * (worldPosition.z / toEye.z);
#endif`;

const AIR_SHADOW_HEAD = /* glsl */ `
uniform vec2 uHalf;
uniform vec2 uSigma;
uniform vec2 uScale;
uniform float uStrength;
varying vec2 vShadow;
vec2 shadowErf(vec2 x) {
  vec2 s = sign(x);
  vec2 a = abs(x);
  vec2 k = 1.0 + (0.278393 + (0.230389 + 0.078108 * a * a) * a) * a;
  k *= k;
  return s - s / (k * k);
}`;

// A gaussian-blurred rectangle that takes away only sunlight, as a real shadow
// does: nothing where the window bars already shade the page.
const AIR_SHADOW_OUT = /* glsl */ `
  vec2 p = vShadow * uScale;
  vec2 g = 0.70710678 / uSigma;
  vec2 band = 0.5 * (shadowErf((p + uHalf) * g) - shadowErf((p - uHalf) * g));
  float sun = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
  float sky = dot(reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
  float share = sun / max(sun + sky, 1e-4);
  gl_FragColor = vec4(vec3(1.0 - uStrength * band.x * band.y * share), 1.0);`;

const airShadowMaterial = () => {
  const uniforms = {
    uHalf: { value: new THREE.Vector2(1, 1) },
    uSigma: { value: new THREE.Vector2(1, 1) },
    uScale: { value: new THREE.Vector2(1, 1) },
    uStrength: { value: 0 },
  };
  // Multiplies whatever is already drawn under it: the page, or a piece that has landed.
  const material = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, toneMapped: false });
  material.userData.shadow = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vShadow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShadow = position.xy;')
      .replace('#include <worldpos_vertex>', AIR_SHADOW_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${AIR_SHADOW_HEAD}`)
      .replace('#include <opaque_fragment>', AIR_SHADOW_OUT);
  };
  material.customProgramCacheKey = () => 'air-shadow';
  return material;
};

// A piece in the air casts no real shadow, so it no longer shades itself
// either; it gets the same shade on its sunlight until it lands.
const SELF_SHADE = /* glsl */ `
#include <lights_fragment_end>
  reflectedLight.directDiffuse *= uSelfShade;
  reflectedLight.directSpecular *= uSelfShade;
#ifdef USE_CLEARCOAT
  clearcoatSpecularDirect *= uSelfShade;
#endif`;

const shadeSelf = (material) => {
  const shade = { value: 1 };
  const key = material.customProgramCacheKey();
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.uSelfShade = shade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSelfShade;')
      .replace('#include <lights_fragment_end>', SELF_SHADE);
  };
  material.customProgramCacheKey = () => `${key}|self-shade`;
  material.userData.selfShade = shade;
};

export class DeskChapter {
  constructor(app) {
    this.app = app;
    this.name = 'desk';
    this.ready = false;
    this.look = { ...DESK_LOOK };
  }

  async build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x4a3526);
    this.scene = scene;
    const names = [
      'paper', 'gobo', 'gators-riso', 'game-riso', 'team-instant', 'certificate-instant', 'coaching-instant',
      'tape-cream', 'tape-pink', 'tape-blue', 'tape-yellow', 'sticker-star', 'sticker-heart', 'sticker-sparkle',
    ];
    const tex = {};
    await Promise.all(names.map(async (name) => { tex[name] = await texture(name); }));

    const page = new THREE.Group();
    scene.add(page);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(18, (18 * 1260) / 2048), new THREE.MeshStandardMaterial({ map: tex.paper, roughness: 0.95 }));
    sheet.receiveShadow = true;
    page.add(sheet);
    this.page = page;

    const sun = new THREE.SpotLight(0xffc28a, 5.2, 0, 0.55, 0.25, 0);
    sun.position.set(-15, 4, 13);
    sun.target.position.set(2, 0, 0);
    sun.map = tex.gobo;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // A tight depth range keeps precision high enough for a small bias, so
    // paper a few millimetres off the surface still casts a contact shadow.
    sun.shadow.camera.near = 8;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.00006;
    sun.shadow.normalBias = 0.012;
    sun.shadow.radius = 5; // soft edge, like paper an inch from the wall
    sun.shadow.intensity = 0.62; // shadows the eye barely notices
    scene.add(sun, sun.target, new THREE.HemisphereLight(0xc9d4ea, 0x8a6a50, 1.05));
    this.sun = sun;

    const items = [
      { mesh: card(tex['gators-riso'], 2.6, { alphaTest: 0.5, gloss: 0, roughness: 0.92, lift: 0.4 }), at: { x: 1.9, y: 1.25, rot: -0.06 }, tape: ['pink', -0.95, 0.9, -0.6] },
      { mesh: card(tex['certificate-instant'], 1.85, { rects: [instantRect(tex['certificate-instant'].userData.size, 1.2)], lift: 0.4 }), at: { x: 4.75, y: 1.5, rot: 0.07 }, tape: ['cream', 0, 1.3, 0.05] },
      { mesh: card(tex['game-riso'], 2.6, { alphaTest: 0.5, gloss: 0, roughness: 0.92, lift: 0.3 }), at: { x: 2.3, y: -1.5, rot: 0.05 }, tape: ['yellow', 1.05, 0.75, 0.5] },
      { mesh: card(tex['coaching-instant'], 1.7, { rects: [instantRect(tex['coaching-instant'].userData.size, 1.3)], lift: 0.5 }), at: { x: 6.6, y: -0.1, rot: -0.05 }, tape: ['blue', 0, 1.33, -0.1] },
      { mesh: card(tex['team-instant'], 2.05, { rects: [instantRect(tex['team-instant'].userData.size, 0.8)], lift: 0.4 }), at: { x: 5.05, y: -1.75, rot: -0.04 }, tape: ['cream', -0.6, 1.0, -0.2] },
      { mesh: sticker(tex['sticker-star'], 0.7), at: { x: 3.55, y: 2.55, z: 0.06, rot: 0.2 } },
      { mesh: sticker(tex['sticker-heart'], 0.6), at: { x: 7.0, y: -2.5, z: 0.06, rot: -0.2 } },
      { mesh: sticker(tex['sticker-sparkle'], 0.45), at: { x: 0.55, y: -2.75, z: 0.06, rot: 0.15 } },
    ];
    this.items = items.map(({ mesh, at, tape: tapeSpec }, index) => {
      place(page, mesh, { z: 0.08 + index * 0.012, ...at });
      if (tapeSpec) {
        const [color, x, y, rot] = tapeSpec;
        const strip = tape(tex[`tape-${color}`], 0.62);
        strip.position.set(x, y, 0.04);
        strip.rotation.z = rot;
        mesh.add(strip);
      }
      mesh.userData.spinIn = (index % 2 ? 1 : -1) * (0.35 + 0.05 * index);
      mesh.userData.foot = tapeSpec ? 1 : 0.55; // a die-cut sticker shades about a third of its square
      shadeSelf(mesh.material);
      return mesh;
    });
    const quad = new THREE.PlaneGeometry(1, 1);
    this.airShadows = this.items.map(() => {
      const shadow = new THREE.Mesh(quad, airShadowMaterial());
      shadow.renderOrder = 1; // after the paper, before the tape
      shadow.visible = false;
      page.add(shadow);
      return shadow;
    });

    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    this.ready = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 44 : 26;
    this.camera.updateProjectionMatrix();
  }

  update(v) {
    const drift = smooth(progress(v, [T.sections.scrapbook[0] - 0.4, T.sections.scrapbook[1]]));
    const narrow = this.camera.aspect < 1 ? 3.2 : 0;
    this.camera.position.set(lerp(0, 0.6, drift) + narrow, lerp(-2.6, -2.1, drift), lerp(15.4, 14.6, drift) + narrow);
    this.camera.lookAt(lerp(0, 0.5, drift) + narrow, 0.15, 0);

    // Each memory drops onto the page in turn and lands with a small bounce.
    const [start, end] = T.scrapbook.settle;
    const step = (end - start) / (this.items.length + 2);
    this.items.forEach((mesh, index) => {
      const rest = mesh.userData.rest;
      const t = clamp01((v - (start + index * step)) / (step * 3));
      const land = backOut(t);
      mesh.visible = t > 0;
      mesh.position.set(rest.x, rest.y + (1 - land) * 0.6, rest.z + (1 - smooth(t)) * 2.4);
      mesh.rotation.z = rest.rot + (1 - land) * mesh.userData.spinIn;
      const develop = mesh.material.userData.develop;
      if (develop) develop[0] = smooth(clamp01(t * 1.6 - 0.4));
      const height = mesh.position.z - rest.z;
      const shadow = this.airShadows[index];
      mesh.castShadow = height < AIR_SHADOW.handoff;
      mesh.material.userData.selfShade.value = mesh.castShadow ? 1 : AIR_SHADOW.selfShade;
      shadow.visible = mesh.visible && !mesh.castShadow;
      if (shadow.visible) this.placeAirShadow(shadow, mesh, height);
    });
  }

  // Under the piece as the eye sees it (a raised piece looks further from the
  // page centre than the spot below it), leaning a little away from the sun.
  placeAirShadow(shadow, mesh, height) {
    const { rest, size, foot } = mesh.userData;
    const eye = this.camera.position;
    const sun = this.sun.position;
    const z = Math.min(AIR_SHADOW.plane, mesh.position.z - 0.004);
    const near = (eye.z - z) / (eye.z - mesh.position.z);
    const x = eye.x + (mesh.position.x - eye.x) * near;
    const y = eye.y + (mesh.position.y - eye.y) * near;
    const lean = (rest.z - 0.01 + AIR_SHADOW.drift * height) / (sun.z - z); // less the shadow's normal bias
    shadow.position.set(x + (x - sun.x) * lean, y + (y - sun.y) * lean, z);
    shadow.rotation.z = mesh.rotation.z;
    const { uHalf, uSigma, uScale, uStrength } = shadow.material.userData.shadow;
    const spread = AIR_SHADOW.spread * height;
    const soften = AIR_SHADOW.soften * height;
    uHalf.value.set((size.width * foot * near) / 2 + spread, (size.height * foot * near) / 2 + spread);
    uSigma.value.set(AIR_SHADOW.blur[0] + soften, AIR_SHADOW.blur[1] + soften);
    uStrength.value = this.sun.shadow.intensity * Math.exp(-AIR_SHADOW.fade * height);
    shadow.scale.set(2 * (uHalf.value.x + 3 * uSigma.value.x), 2 * (uHalf.value.y + 3 * uSigma.value.y), 1);
    uScale.value.set(shadow.scale.x, shadow.scale.y);
  }

  stills() {
    this.items.forEach((mesh) => {
      const rest = mesh.userData.rest;
      mesh.visible = true;
      mesh.position.set(rest.x, rest.y, rest.z);
      mesh.rotation.z = rest.rot;
      const develop = mesh.material.userData.develop;
      if (develop) develop.fill(1);
    });
  }
}
