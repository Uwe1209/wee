// The room: dim, warm, sunbeams through a far window, dust in the light.
// Project cards hang in the air; the camera flies past them, slowing at each,
// and each photo develops as it comes close.
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
const AXIS = new THREE.Vector3();
const FACE = new THREE.Vector3();
const SIDE = new THREE.Vector3();
const VIEW = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const BASIS = new THREE.Matrix4();
const DWELL = 0.85; // 0 = constant speed; 0.85 = 0.15× speed at each card
// Camera heading (rad, right of -z) the window and beams were laid out for; the light
// rig turns by however much further right the camera looks, so they keep their place.
const RIG_HEADING = Math.atan2(0.2, 6.1);

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

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false };

// Dust glow: each mote brightens as it nears a beam's axis.
const dustHead = (count) => /* glsl */ `
#define BEAMS ${count}
uniform vec3 uBeamFrom[BEAMS];
uniform vec3 uBeamTo[BEAMS];
uniform float uBeamGain[BEAMS];
`;
const DUST_GLOW = /* glsl */ `
  vec3 dustAt = (modelMatrix * vec4(position, 1.0)).xyz;
  float dustGlow = 0.05;
  for (int i = 0; i < BEAMS; i++) {
    vec3 axis = uBeamTo[i] - uBeamFrom[i];
    float along = clamp(dot(dustAt - uBeamFrom[i], axis) / max(dot(axis, axis), 1e-4), 0.0, 1.0);
    dustGlow += max(0.0, 1.0 - distance(dustAt, uBeamFrom[i] + axis * along) / 2.2) * uBeamGain[i];
  }
  vColor *= dustGlow;
`;

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
    scene.background = new THREE.Color(0x120c08);
    scene.fog = new THREE.Fog(0x1a110b, 9, 36);
    this.scene = scene;

    const names = ['window-panes', 'tape-cream', 'tape-pink', 'tape-blue', 'tape-yellow', 'badge-top5', ...PROJECTS.map((p) => p.tex)];
    const tex = {};
    await Promise.all(names.map(async (name) => { tex[name] = await texture(name); }));

    // The far window and its beams ride along with the camera as a far backdrop, so the
    // window holds the gap between the captions and the cards, high above the next cards.
    // The rig also turns with the camera's heading (see RIG_HEADING).
    this.light = new THREE.Group();
    scene.add(this.light);
    const window = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 16.5), new THREE.MeshBasicMaterial({
      map: tex['window-panes'], color: new THREE.Color(1, 0.78, 0.52).multiplyScalar(7), fog: false,
    }));
    window.position.set(2.6, 20.3, -100);
    this.light.add(window);

    const beamMap = glowTexture(256, 64, (ctx, w, h) => {
      const across = ctx.createLinearGradient(0, 0, 0, h);
      across.addColorStop(0, 'rgba(255,255,255,0)');
      across.addColorStop(0.5, 'rgba(255,255,255,1)');
      across.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = across;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-in';
      const along = ctx.createLinearGradient(0, 0, w, 0);
      along.addColorStop(0, 'rgba(0,0,0,0)');
      along.addColorStop(0.15, 'rgba(0,0,0,0.9)');
      along.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = along;
      ctx.fillRect(0, 0, w, h);
    });
    this.beams = [];
    // Beams fall from the window toward the viewer and pass below and right of the
    // camera, so they never cross the caption column.
    [
      { from: [1.72, 14.25, -100], to: [2.4, -4.6, -9], width: 3.0, strength: 0.16 },
      { from: [4.14, 16.45, -100], to: [6.2, -3.6, -14], width: 2.4, strength: 0.12 },
      { from: [0.4, 17.0, -100], to: [0.9, -4.4, -6], width: 4.0, strength: 0.09 },
    ].forEach((beam) => {
      const from = new THREE.Vector3(...beam.from);
      const to = new THREE.Vector3(...beam.to);
      const length = from.distanceTo(to);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(length, beam.width), new THREE.MeshBasicMaterial({
        map: beamMap, color: new THREE.Color(1, 0.72, 0.42).multiplyScalar(beam.strength * 8), ...additive, side: THREE.DoubleSide,
      }));
      mesh.position.copy(from).lerp(to, 0.5);
      mesh.userData = { from, to, strength: beam.strength };
      this.light.add(mesh);
      this.beams.push(mesh);
    });

    // Dust hangs still in the room along the whole flight; a mote glows while a beam
    // passes over it (computed per vertex from where the beams are this frame).
    const rand = random(17);
    const far = -2 - SPACING * (PROJECTS.length - 1) - 26; // 26 past the last card
    const count = Math.round(27.4 * (6 - far)); // same density as before (2300 over 84)
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let k = 0; k < count; k += 1) {
      positions.set([-7 + rand() * 15, -4.5 + rand() * 9, far + rand() * (6 - far)], k * 3);
      const v = 0.4 + rand() * rand() * 1.8;
      colors.set([v, v * 0.82, v * 0.6], k * 3);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const dot = glowTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    const dustMaterial = new THREE.PointsMaterial({ size: 0.05, map: dot, vertexColors: true, sizeAttenuation: true, ...additive });
    this.beamUniforms = {
      uBeamFrom: { value: this.beams.map(() => new THREE.Vector3()) },
      uBeamTo: { value: this.beams.map(() => new THREE.Vector3()) },
      uBeamGain: { value: this.beams.map((beam) => beam.userData.strength * 12) },
    };
    dustMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.beamUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${dustHead(this.beams.length)}`)
        .replace('#include <color_vertex>', `#include <color_vertex>\n${DUST_GLOW}`);
    };
    this.dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(this.dust);

    // Light: warm key from behind the viewer, sky fill, glossy reflections of the window.
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

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
    this.ready = true;
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

  // Flight parameter c: -1 at the establishing shot, j at card j, n past the last.
  flight(v) {
    const n = this.cards.length;
    const u = progress(v, T.projects.flight) * n;
    const s = u - (DWELL * Math.sin(2 * Math.PI * (u - 0.5))) / (2 * Math.PI);
    const enter = smooth(progress(v, [T.transitions.wallToRoom[0], T.projects.flight[0]]));
    return v < T.projects.flight[0] ? -1 + 0.5 * enter : s - 0.5;
  }

  update(v, time) {
    const c = this.flight(v);
    const t = clamp01((c + 1) / (this.keyCount - 1));
    this.camera.position.copy(this.posCurve.getPoint(t));
    const look = this.lookCurve.getPoint(t);
    if (this.camera.aspect < 1) this.camera.position.x += 0.9;
    this.camera.lookAt(look);
    this.light.position.z = this.camera.position.z;

    this.cards.forEach((mesh, j) => {
      const home = mesh.userData.home;
      mesh.position.set(home.x, home.y + Math.sin(time * 0.6 + j) * 0.05, home.z);
      mesh.rotation.z = mesh.userData.spin + Math.sin(time * 0.4 + j * 1.7) * 0.012;
      const develop = mesh.material.userData.develop;
      if (develop) develop[0] = smooth(progress(c, [j - 0.95, j - 0.3]));
    });
    this.focus = this.cards.map((_, j) => 1 - smooth(clamp01((Math.abs(c - j) - 0.16) / 0.3)));
    this.active = Math.max(0, Math.min(this.cards.length - 1, Math.round(c)));
    this.dust.rotation.y = Math.sin(time * 0.05) * 0.02;
    this.dust.position.y = Math.sin(time * 0.17) * 0.12;
    // Beams are ribbons along their axis, turned to face the camera (in the light's frame).
    VIEW.subVectors(this.camera.position, this.light.position);
    this.beams.forEach((beam, i) => {
      beam.material.opacity = 0.85 + Math.sin(time * 0.7 + i * 2.1) * 0.15;
      const { from, to } = beam.userData;
      AXIS.subVectors(to, from).normalize();
      FACE.subVectors(VIEW, beam.position).normalize();
      FACE.addScaledVector(AXIS, -FACE.dot(AXIS)).normalize();
      SIDE.crossVectors(FACE, AXIS);
      BASIS.makeBasis(AXIS, SIDE, FACE);
      beam.quaternion.setFromRotationMatrix(BASIS);
      this.beamUniforms.uBeamFrom.value[i].addVectors(from, this.light.position);
      this.beamUniforms.uBeamTo.value[i].addVectors(to, this.light.position);
    });
  }

  stills(v) {
    // Reduced motion: no flight; show the card nearest this scroll position.
    return v;
  }
}
