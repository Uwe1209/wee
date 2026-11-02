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
      return mesh;
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
    });
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
