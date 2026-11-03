// Paper in the scene: photo cards that develop like instant film, tape,
// stickers. Works from the baked textures in assets/tex.
import * as THREE from 'three';
import { paperGeometry } from '../lib/meshes.js';

// Where the photo sits inside a baked texture, as UV rects [u0, v0, u1, v1]
// (v measured from the bottom, the way the GPU sees it). Mirrors prints.js.
export const instantRect = ({ w, h }, ratio) => {
  const side = Math.round(w * 0.06);
  const top = Math.round(w * 0.07);
  const iw = w - side * 2;
  const ih = Math.round(iw * ratio);
  return [side / w, 1 - (top + ih) / h, (side + iw) / w, 1 - top / h];
};

export const stripRects = ({ w, h }, count = 4) => {
  const margin = Math.round(w * 0.0625);
  const gap = Math.round(w * 0.053);
  const fw = w - margin * 2;
  const fh = Math.round(fw * 0.86);
  return Array.from({ length: count }, (_, i) => {
    const y = margin + i * (fh + gap);
    return [margin / w, 1 - (y + fh) / h, (margin + fw) / w, 1 - y / h];
  });
};

const DEVELOP_HEAD = /* glsl */ `
uniform vec4 uRects[DEV_COUNT];
uniform float uDevelop[DEV_COUNT];
uniform vec3 uHaze;
uniform float uMono;   // 0 colour, 1 black and white (the orange date imprint keeps its colour)
uniform float uLatent; // 0 flat haze, 1 a faint latent image in the undeveloped haze
uniform float uNeutral; // photo areas only: 0 lit like the paper, 1 the print's own colours at the lit brightness
uniform float uPhotoGain;
float devPhotoMask = 0.0;
float devHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float devNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(devHash(i), devHash(i + vec2(1.0, 0.0)), f.x), mix(devHash(i + vec2(0.0, 1.0)), devHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const DEVELOP_MAP = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float developed = 1.0;
  float inPhoto = 0.0;
  for (int i = 0; i < DEV_COUNT; i++) {
    vec4 r = uRects[i];
    vec2 size = max(r.zw - r.xy, vec2(1e-4));
    vec2 local = (vMapUv - r.xy) / size;
    float inside = step(0.0, local.x) * step(local.x, 1.0) * step(0.0, local.y) * step(local.y, 1.0);
    float wave = devNoise(local * vec2(3.0, 4.0) + float(i) * 7.0) * 0.35;
    float reveal = clamp(uDevelop[i] * 1.8 - (1.0 - local.y) * 0.45 - wave, 0.0, 1.0);
    developed = mix(developed, reveal * reveal * (3.0 - 2.0 * reveal), inside);
    inPhoto = max(inPhoto, inside);
  }
  devPhotoMask = inPhoto;
  vec3 photo = sampledDiffuseColor.rgb;
  float photoLuma = dot(photo, vec3(0.2126, 0.7152, 0.0722));
  float imprint = smoothstep(0.55, 0.75, photo.r - photo.b) * smoothstep(0.7, 0.9, photo.r);
  photo = mix(photo, vec3(photoLuma), uMono * inPhoto * (1.0 - imprint));
  vec3 haze = mix(uHaze, uHaze * (0.8 + 0.4 * photoLuma), uLatent);
  sampledDiffuseColor.rgb = mix(haze, photo, developed);
  diffuseColor *= sampledDiffuseColor;
#endif`;

// Warm sun on an already warm photo compounds: skin goes terracotta and white
// shirts amber while the paper round them stays cream. In the photo area the
// lit brightness is kept, but its colour is pulled back toward the print's own.
const PHOTO_NEUTRAL = /* glsl */ `
{
  float litLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  vec3 own = diffuseColor.rgb + 0.02;
  vec3 neutralLit = own * (litLuma / dot(own, vec3(0.2126, 0.7152, 0.0722)));
  float k = uNeutral * devPhotoMask;
  outgoingLight = mix(outgoingLight, neutralLit, k) * mix(1.0, uPhotoGain, devPhotoMask);
}
#include <opaque_fragment>`;

// A print whose photo area(s) can be undeveloped (0) to developed (1).
export const printMaterial = (map, rects = [], { gloss = 0.35, roughness = 0.55, alphaTest = 0, transparent = false } = {}) => {
  const material = new THREE.MeshPhysicalMaterial({
    map, roughness, clearcoat: gloss, clearcoatRoughness: 0.14, side: THREE.DoubleSide, alphaTest, transparent,
  });
  if (!rects.length) return material;
  const count = rects.length;
  const develop = new Array(count).fill(1);
  const uniforms = {
    uRects: { value: rects.map((r) => new THREE.Vector4(...r)) },
    uDevelop: { value: develop },
    uHaze: { value: new THREE.Color(0.66, 0.65, 0.62) },
    uMono: { value: 0 },
    uLatent: { value: 0 },
    uNeutral: { value: 0.85 },
    uPhotoGain: { value: 1.35 },
  };
  material.userData.develop = develop;
  material.userData.haze = uniforms.uHaze.value;
  material.userData.tone = { mono: uniforms.uMono, latent: uniforms.uLatent, neutral: uniforms.uNeutral, gain: uniforms.uPhotoGain };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n#define DEV_COUNT ${count}\n${DEVELOP_HEAD}`)
      .replace('#include <map_fragment>', DEVELOP_MAP)
      .replace('#include <opaque_fragment>', PHOTO_NEUTRAL);
  };
  material.customProgramCacheKey = () => `develop-${count}`;
  return material;
};

export const card = (map, width, { rects = [], curl = 0.12, cup = 0, lift = 0, gloss = 0.35, roughness = 0.55, alphaTest = 0, segments } = {}) => {
  const { w, h } = map.userData.size;
  const height = (width * h) / w;
  const mesh = new THREE.Mesh(
    paperGeometry(width, height, { curl, cup, lift, segments }),
    printMaterial(map, rects, { gloss, roughness, alphaTest }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.size = { width, height };
  return mesh;
};

export const tape = (map, width) => {
  const { w, h } = map.userData.size;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * h) / w),
    new THREE.MeshStandardMaterial({ map, roughness: 0.75, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  mesh.renderOrder = 2;
  return mesh;
};

export const sticker = (map, width) => {
  const mesh = card(map, width, { curl: 0, gloss: 0.8, roughness: 0.35, alphaTest: 0.5, segments: [2, 2] });
  return mesh;
};

// Sets position/rotation in the parent's space and adds it.
export const place = (parent, mesh, { x = 0, y = 0, z = 0.1, rot = 0 } = {}) => {
  mesh.position.set(x, y, z);
  mesh.rotation.z = rot;
  mesh.userData.rest = { x, y, z, rot };
  parent.add(mesh);
  return mesh;
};

// Tape stuck across the top edge of a card (child of the card).
export const tapeTop = (cardMesh, tapeMap, { width = 0.6, x = 0, rot = 0, dy = -0.03 } = {}) => {
  const strip = tape(tapeMap, width);
  strip.position.set(x, cardMesh.userData.size.height / 2 + dy, 0.03);
  strip.rotation.z = rot;
  cardMesh.add(strip);
  return strip;
};
