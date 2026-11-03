// The wall: golden-hour plaster with memories taped up. Covers the opening,
// the flash (a fresh strip prints and develops), the about dolly, and the
// contact corner at dusk. The camera lives inside the wall's frame, so every
// coordinate here is along the wall (x), up (y) and out from it (z).
import * as THREE from 'three';
import { STATES, TIMELINE as T, clamp01, easeOut, lerp, progress, smooth } from '../motion/timeline.js';
import { texture } from '../engine/textures.js';
import { card, instantRect, place, sticker, stripRects, tape, tapeTop } from '../engine/paper3d.js';
import { Rail } from '../engine/rail.js';

const TILT = 0.15;

const RAIL = new Rail([
  { v: 0, pos: [-2.63, 0, 13.36], look: [-0.68, 0, 0.5] },
  { v: T.flash.push[1], pos: [-1.35, 0.12, 11.6], look: [0.75, 0.05, 0.45] },
  { v: T.about.dolly[0], pos: [-1.9, 0.04, 12.7], look: [0.05, 0, 0.5] },
  { v: T.about.dolly[1], pos: [12.0, -1.47, 13.9], look: [14.0, -1.5, 0.5] },
  { v: T.about.dolly[2], pos: [12.55, -1.45, 13.4], look: [14.45, -1.5, 0.5] },
  { v: T.transitions.deskToWall[0], pos: [25.6, -0.05, 12.8], look: [27.6, 0, 0.5] },
  { v: T.total, pos: [26.3, 0.0, 11.7], look: [28.1, 0, 0.5] },
]);

const DAY = { sun: new THREE.Color(0xffc28a), sky: new THREE.Color(0xb5c6e4), ground: new THREE.Color(0x7a5a44), sunIntensity: 6.0, sunY: 7 };
// The dusk sun rakes: for the contact corner it swings far back along the wall
// (`reach`) and in close to it (`z`), with a narrower cone (`angle`), so the
// window lands as long, stretched patches with dusky umber-mauve shade between them.
// `aim` (along the wall, up) puts the call to action in the window's tall left
// pane and the mullion in the gap before the strip. The light is warm but not
// orange, so paper in the sun stays near white; `rake` makes up for the low
// angle of incidence. All of the geometry changes while the wall is off screen.
const DUSK = {
  sun: new THREE.Color(0xffbe84), sky: new THREE.Color(0x898fab), ground: new THREE.Color(0x5c4e5a), skyIntensity: 1.8,
  sunIntensity: 4.7, sunY: 3.2, aim: [4.17, -1.0], reach: 22.6, z: 7, angle: 0.18, rake: 3.2,
};
// Where the contact note rests (wide screens; phones use NARROW below).
const CONTACT_NOTE = { x: 27.18, y: -0.75, z: 0.14, rot: 0.05 };
// Phones: the memories are laid out again in their own zone of the frame (the
// opening between the name and the tagline; about and contact in the band
// below the copy). Like the desk's
// spread, each piece is designed in screen space at its chapter's state ([u, v]
// centre from the top-left, width as a share of the frame's width, tilt, height
// off the wall) and solved through the narrow camera on resize. Keys are
// group:texture; null takes the piece off a phone's wall.
const NARROW = [
  {
    // The opening, solved at the end of the flash push (the closest the phone
    // camera gets before taped; it holds its x until taped, see pose()). Name
    // above ~0.22, tagline below ~0.73: the memories ring the strip's spot,
    // every card inside the frame.
    v: T.flash.push[1],
    spread: {
      'flash:strip-color': { at: [0.5, 0.44], width: 0.25, rot: -0.035, z: 0.1 },
      'hello:poster-instant': { at: [0.19, 0.37], width: 0.32, rot: 0.045, z: 0.1 },
      'hello:stage-riso': { at: [0.81, 0.33], width: 0.32, rot: -0.05, z: 0.1 },
      'hello:note-uriis': { at: [0.8, 0.43], width: 0.27, rot: 0.05, z: 0.14 },
      'hello:gators-instant': { at: [0.81, 0.585], width: 0.29, rot: 0.06, z: 0.1 },
      'hello:ticket-admit': { at: [0.2, 0.6], width: 0.33, rot: 0.035, z: 0.12 },
      'hello:sticker-star': { at: [0.32, 0.27], width: 0.1, rot: 0.22, z: 0.16 },
      'hello:sticker-heart': { at: [0.645, 0.255], width: 0.08, rot: -0.2, z: 0.06 },
      'hello:sticker-sparkle': { at: [0.94, 0.48], width: 0.06, rot: 0.1, z: 0.06 },
    },
  },
  {
    v: STATES.about, // copy down to ~0.62
    spread: {
      'about:portrait-instant': { at: [0.31, 0.805], width: 0.55, rot: -0.04, z: 0.1 },
      'about:card-swinburne': { at: [0.79, 0.68], width: 0.4, rot: 0.03, z: 0.12 },
      'about:badge-cgpa': { at: [0.87, 0.77], width: 0.17, rot: 0.08, z: 0.13 },
      'about:card-courses': { at: [0.79, 0.88], width: 0.38, rot: -0.03, z: 0.11 },
      'about:sticker-star-pink': { at: [0.95, 0.955], width: 0.07, rot: -0.3, z: 0.14 },
      'about:sticker-sparkle': { at: [0.05, 0.64], width: 0.06, rot: 0.2, z: 0.16 },
      'about:note-looking': null,
    },
  },
  {
    v: T.total, // copy down to ~0.47
    spread: {
      'contact:strip-contact': { at: [0.27, 0.715], width: 0.31, rot: 0.04, z: 0.1 },
      'contact:note-hello': { at: [0.71, 0.6], width: 0.44, rot: 0.05, z: 0.14 },
      'contact:sticker-heart': { at: [0.46, 0.525], width: 0.11, rot: 0.18, z: 0.12 },
      'contact:sticker-star': { at: [0.6, 0.9], width: 0.1, rot: -0.2, z: 0.06 },
    },
  },
];
// `ABOUT_AIM` slides the sun (and its target) along the wall and down for the
// about chapter: with the about window, the copy rises in its tall left pane,
// the thin mullion falls in the gap between copy and cluster, and the cluster
// sits in one right-hand pane with a bar just above it and one just below.
const ABOUT_AIM = [1.5, -1.4];
// Phones move the window along the wall and up (about, dusk) so its bars fall
// in the gap between the copy and the memories, not across a face.
// In the opening (`day`) the phone's window is also thrown larger (the sun
// `back` times as far off the wall), so one pane holds the name, the memories
// and the tagline, with bars only across the top chrome and the chips.
const NARROW_AIM = { day: [-2.2, 0.4], back: 1.6, about: [0, 2.1], dusk: [0, -1.5] };
const WIDE_AIM = { day: [0, 0], back: 1, about: [0, 0], dusk: [0, 0] };

// Cross-fades two baked windows into one target, so the sun's window can
// change without a visible switch. Only drawn while a fade is under way.
const windowBlend = (from, to) => {
  const target = new THREE.WebGLRenderTarget(1024, 1024, { type: THREE.HalfFloatType, depthBuffer: false });
  const material = new THREE.ShaderMaterial({
    uniforms: { uFrom: { value: from }, uTo: { value: to }, uMix: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D uFrom; uniform sampler2D uTo; uniform float uMix; varying vec2 vUv;'
      + ' void main() { gl_FragColor = vec4(mix(texture2D(uFrom, vUv).rgb, texture2D(uTo, vUv).rgb, uMix), 1.0); }',
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    texture: target.texture,
    draw(renderer, mix) {
      material.uniforms.uMix.value = mix;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
    },
  };
};

export const WALL_LOOK = {
  bloom: 0.05, halation: 0.16, exposure: 1.06, saturation: 0.98, contrast: 1.04,
  lift: [0.018, 0.012, 0.004], gain: [1.02, 0.995, 0.95], grain: 0.045, vignette: 0.3,
};

export class WallChapter {
  constructor(app) {
    this.app = app;
    this.name = 'wall';
    this.ready = false;
    this.look = { ...WALL_LOOK };
  }

  async build() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9c7ad);
    const wall = new THREE.Group();
    wall.position.set(0.6, 0, -0.6);
    wall.rotation.y = TILT;
    scene.add(wall);
    this.scene = scene;
    this.wall = wall;

    const names = [
      'plaster', 'plaster-n', 'gobo', 'tape-cream', 'tape-masking', 'tape-pink', 'tape-blue', 'tape-yellow', 'sticker-star', 'sticker-heart',
      'sticker-sparkle', 'sticker-star-pink', 'ticket-admit', 'poster-instant', 'strip-color', 'stage-riso', 'note-uriis',
      'gators-instant', 'portrait-instant', 'card-swinburne', 'card-courses', 'note-looking', 'badge-cgpa', 'strip-contact',
      'note-hello',
      'gobo-hello', 'photo-corner', 'note-spot', 'gobo-dusk', 'gobo-about',
    ];
    const tex = {};
    await Promise.all(names.map(async (name) => {
      tex[name] = await texture(name, name.startsWith('plaster') ? { srgb: name === 'plaster', repeat: [3, 1] } : {});
    }));
    this.tex = tex;

    const plaster = new THREE.Mesh(new THREE.PlaneGeometry(54, 11), new THREE.MeshStandardMaterial({
      map: tex.plaster, normalMap: tex['plaster-n'], normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.94,
    }));
    plaster.position.x = 17;
    plaster.receiveShadow = true;
    wall.add(plaster);
    // A phone's tall lens sees well above and below the 11-unit wall, so narrow
    // screens get a 30-unit-tall plane mapped at the same texel scale (the
    // mirrored wrap carries the plaster on past the original edges, seamless).
    const tall = new THREE.PlaneGeometry(54, 30);
    const uv = tall.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setY(i, (uv.getY(i) * 30 - 9.5) / 11);
    this.plasterShapes = { wide: plaster.geometry, narrow: tall };
    this.plaster = plaster;

    // Light: the sun through a window, cool sky fill.
    const sun = new THREE.SpotLight(DAY.sun, DAY.sunIntensity, 0, 0.5, 0.2, 0);
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
    wall.add(sun, sun.target);
    const sky = new THREE.HemisphereLight(DAY.sky, DAY.ground, 0.9);
    scene.add(sky);
    this.sun = sun;
    this.sky = sky;
    this.aboutWindow = windowBlend(tex.gobo, tex['gobo-about']);

    const ink = { tape: (name) => tex[`tape-${name}`] };
    const pieces = [];
    const add = (mesh, at, group = 'hello') => {
      place(wall, mesh, at);
      mesh.userData.group = group;
      pieces.push(mesh);
      return mesh;
    };

    // Opening cluster: the art bible composition.
    const poster = add(card(tex['poster-instant'], 2.25, { rects: [instantRect(tex['poster-instant'].userData.size, 1.24)], lift: 0.2 }), { x: 0.45, y: 0.55, rot: 0.045 });
    const pinkTape = tape(ink.tape('pink'), 0.75);
    pinkTape.position.set(-0.95, 1.3, 0.05);
    pinkTape.rotation.z = -0.55;
    poster.add(pinkTape);
    const stage = add(card(tex['stage-riso'], 2.5, { alphaTest: 0.5, gloss: 0, roughness: 0.92, lift: 0.4 }), { x: 5.05, y: 1.6, rot: -0.05 });
    const yellowTape = tape(ink.tape('yellow'), 0.7);
    yellowTape.position.set(1.1, 0.75, 0.05);
    yellowTape.rotation.z = 0.48;
    stage.add(yellowTape);
    add(card(tex['note-uriis'], 1.55, { alphaTest: 0.5, gloss: 0, roughness: 0.9, lift: 0.3, curl: 0.05 }), { x: 4.6, y: 0.2, z: 0.14, rot: 0.05 });
    const gators = add(card(tex['gators-instant'], 2.05, { rects: [instantRect(tex['gators-instant'].userData.size, 0.75)], lift: 0.5 }), { x: 4.85, y: -1.85, rot: 0.06 });
    tapeTop(gators, ink.tape('blue'), { width: 0.6, rot: -0.08 });
    add(card(tex['ticket-admit'], 2.5, { alphaTest: 0.3, gloss: 0, roughness: 0.9, lift: 0.3, curl: 0.04 }), { x: 1.35, y: -2.5, z: 0.12, rot: 0.035 });
    add(sticker(tex['sticker-star'], 0.62), { x: 1.5, y: 1.95, z: 0.16, rot: 0.22 }); // overlaps the poster's corner
    add(sticker(tex['sticker-heart'], 0.5), { x: 3.5, y: 1.85, z: 0.06, rot: -0.2 });
    add(sticker(tex['sticker-sparkle'], 0.42), { x: 6.4, y: -0.7, z: 0.06, rot: 0.1 });

    // The strip the flash prints. It develops frame by frame.
    const stripSize = tex['strip-color'].userData.size;
    this.strip = card(tex['strip-color'], 0.98, { rects: stripRects(stripSize), lift: 0.5, segments: [6, 48] });
    this.strip.userData.rest = { x: 2.75, y: 0.0, z: 0.1, rot: -0.035 };
    this.strip.userData.group = 'flash';
    // Fresh from the booth it is black and white, its frames rising out of a
    // faint latent image; it warms to colour once it is taped up.
    this.strip.material.userData.tone.latent.value = 1;
    wall.add(this.strip);
    this.stripTape = tapeTop(this.strip, ink.tape('masking'), { width: 0.74, rot: 0.06, dy: 0.0 });

    // Its spot waits in the sun the way an album page waits for a photo: four
    // black corner mounts, and a ballpoint note pointing up into the spot. Each
    // mount sits just above the strip's own curled corner, so when the strip is
    // pressed home its corners slip under all four and they stay on top.
    const spot = new THREE.Group();
    this.spot = spot;
    const stripRest = this.strip.userData.rest;
    spot.position.set(stripRest.x, stripRest.y, 0);
    spot.rotation.z = stripRest.rot;
    wall.add(spot);
    const { width: stripW, height: stripH } = this.strip.userData.size;
    const stripPaper = this.strip.geometry.attributes.position;
    const cornerHeight = (sx, sy) => {
      for (let i = 0; i < stripPaper.count; i += 1) {
        if (Math.abs(stripPaper.getX(i) - (sx * stripW) / 2) < 1e-6 && Math.abs(stripPaper.getY(i) - (sy * stripH) / 2) < 1e-6) return stripPaper.getZ(i);
      }
      return 0;
    };
    // The corner texture is drawn 0.317 units square (legs 0.27, with a 19/256
    // pad for its shadow); its right angle sits `inset` from the centre, placed
    // `slack` outside the strip's corner. The top two stop just short of the
    // strip's tape.
    const mountSize = 0.317;
    const inset = mountSize * (0.5 - 19 / 256);
    const slack = 0.02;
    const mountGeometry = new THREE.PlaneGeometry(mountSize, mountSize);
    const mountMaterial = new THREE.MeshPhysicalMaterial({
      map: tex['photo-corner'], roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.2, transparent: true, depthWrite: false,
    });
    // The mounts mark the spot for the countdown, then fade before the strip
    // seats, so the tape alone holds it (as in the bar).
    this.mountMaterial = mountMaterial;
    [[-1, 1, 0], [1, 1, -Math.PI / 2], [1, -1, Math.PI], [-1, -1, Math.PI / 2]].forEach(([sx, sy, turn]) => {
      const mount = place(spot, new THREE.Mesh(mountGeometry, mountMaterial), {
        x: sx * (stripW / 2 + slack - inset),
        y: sy * (stripH / 2 + slack - inset),
        z: stripRest.z + cornerHeight(sx, sy) + 0.007,
        rot: turn,
      });
      mount.receiveShadow = true;
      mount.userData.group = 'hello';
      pieces.push(mount);
    });
    // The tape lands over the top mounts, so it sits clear of their height.
    this.stripTape.position.z = Math.max(cornerHeight(-1, 1), cornerHeight(1, 1)) + 0.02;
    // Ballpoint on the plaster under the spot (texture at 400 px per unit, laid
    // out from x -0.02, y -1.38 in the spot's frame).
    const noteSize = tex['note-spot'].userData.size;
    this.spotNote = new THREE.Mesh(
      new THREE.PlaneGeometry(noteSize.w / 400, noteSize.h / 400),
      new THREE.MeshStandardMaterial({ map: tex['note-spot'], roughness: 0.55, transparent: true, depthWrite: false }),
    );
    this.spotNote.position.set(-0.02 + noteSize.w / 800, -1.38 - noteSize.h / 800, 0.004);
    this.spotNote.receiveShadow = true;
    spot.add(this.spotNote);

    // About cluster, further along the wall.
    const portrait = add(card(tex['portrait-instant'], 2.1, { rects: [instantRect(tex['portrait-instant'].userData.size, 1.24)], lift: 0.3 }), { x: 15.2, y: -0.75, rot: -0.04 }, 'about');
    tapeTop(portrait, ink.tape('cream'), { width: 0.55, rot: 0.06 });
    const school = add(card(tex['card-swinburne'], 2.9, { gloss: 0, roughness: 0.9, alphaTest: 0.5, curl: 0.04, lift: 0.3 }), { x: 18.0, y: 0.05, rot: 0.02 }, 'about');
    tapeTop(school, ink.tape('yellow'), { width: 0.55, x: -1.1, rot: -0.3 });
    add(sticker(tex['badge-cgpa'], 1.1), { x: 20.1, y: -1.05, z: 0.07, rot: 0.08 }, 'about');
    const courses = add(card(tex['card-courses'], 2.8, { gloss: 0, roughness: 0.9, alphaTest: 0.5, curl: 0.04, lift: 0.4 }), { x: 18.1, y: -2.65, rot: -0.03 }, 'about');
    tapeTop(courses, ink.tape('pink'), { width: 0.6, x: 1.0, rot: 0.25 });
    add(card(tex['note-looking'], 2.4, { gloss: 0, roughness: 0.9, alphaTest: 0.5, curl: 0.04, lift: 0.3 }), { x: 15.5, y: -3.45, z: 0.13, rot: 0.03 }, 'about');
    add(sticker(tex['sticker-star-pink'], 0.5), { x: 20.6, y: -3.2, z: 0.06, rot: -0.3 }, 'about');
    add(sticker(tex['sticker-sparkle'], 0.38), { x: 14.1, y: 0.85, z: 0.16, rot: 0.2 }, 'about'); // touches the portrait's corner

    // Contact corner, at the far end, lit at dusk.
    this.contactStrip = card(tex['strip-contact'], 0.98, { rects: stripRects(tex['strip-contact'].userData.size), lift: 0.4, segments: [6, 48] });
    this.contactStrip.userData.rest = { x: 29.6, y: 0.1, z: 0.1, rot: 0.04 };
    this.contactStrip.userData.group = 'contact';
    wall.add(this.contactStrip);
    tapeTop(this.contactStrip, ink.tape('pink'), { width: 0.5, rot: -0.12 });
    // The note sits between the strip and the links, its arrow at the email; on
    // a phone the copy card covers that spot, so it moves under the card (resize).
    this.contactNote = card(tex['note-hello'], 1.35, { gloss: 0, roughness: 0.9, alphaTest: 0.5, curl: 0.03, lift: 0.3 });
    add(this.contactNote, CONTACT_NOTE, 'contact');
    add(sticker(tex['sticker-heart'], 0.55), { x: 30.5, y: 1.95, z: 0.06, rot: 0.18 }, 'contact');
    add(sticker(tex['sticker-star'], 0.48), { x: 28.4, y: -2.2, z: 0.06, rot: -0.2 }, 'contact');

    this.pieces = pieces;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    wall.add(this.camera);
    this.pos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.lookWorld = new THREE.Vector3();
    this.ready = true;
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // Keep the wall composition on narrow screens: widen the lens a little.
    this.camera.fov = aspect < 1 ? 46 : 30;
    this.camera.updateProjectionMatrix();
    this.plaster.geometry = aspect < 1 ? this.plasterShapes.narrow : this.plasterShapes.wide;
    this.layout(aspect < 1);
  }

  // Every piece back at its wide rest, then (phones) solved from NARROW
  // through the camera at each spread's state. The strip's spot (corner mounts,
  // ballpoint note) follows the strip.
  layout(narrow) {
    const names = new Map(Object.entries(this.tex).map(([name, map]) => [map, name]));
    const pieces = [...this.pieces, this.contactStrip, this.strip];
    const rest = (mesh, at, scale, visible) => {
      mesh.userData.rest = { ...at };
      mesh.position.set(at.x, at.y, at.z);
      mesh.rotation.z = at.rot;
      mesh.scale.setScalar(scale);
      mesh.visible = visible;
      if (mesh === this.strip) {
        this.spot.position.set(at.x, at.y, 0);
        this.spot.rotation.z = at.rot;
        this.spot.scale.setScalar(scale);
      }
    };
    pieces.forEach((mesh) => {
      mesh.userData.wide ??= { ...mesh.userData.rest };
      rest(mesh, mesh.userData.wide, 1, true);
    });
    if (!narrow) return;
    this.wall.updateMatrixWorld(true);
    NARROW.forEach(({ v, spread }) => {
      this.pose(v);
      this.camera.updateMatrixWorld();
      pieces.forEach((mesh) => {
        const key = `${mesh.userData.group}:${names.get(mesh.material.map)}`;
        if (!(key in spread)) return;
        const spec = spread[key];
        if (!spec) {
          mesh.visible = false;
          return;
        }
        const { at: [u, w], width, rot, z } = spec;
        const centre = this.onWall(u, w, z);
        const span = this.onWall(u + width / 2, w, z).x - this.onWall(u - width / 2, w, z).x;
        rest(mesh, { x: centre.x, y: centre.y, z, rot }, span / mesh.userData.size.width, true);
      });
    });
  }

  // Where the line of sight through screen point [u, v] meets the wall at height z (wall frame).
  onWall(u, v, z) {
    const eye = this.camera.position;
    const ray = this.wall.worldToLocal(new THREE.Vector3(u * 2 - 1, 1 - v * 2, 0.5).unproject(this.camera)).sub(eye);
    return eye.clone().addScaledVector(ray, (z - eye.z) / ray.z);
  }

  pose(v) {
    RAIL.sample(v, this.pos, this.lookAt);
    // Portrait screens frame the memories, not the empty wall left of them.
    if (this.camera.aspect < 1) {
      // Until taped the phone camera only pushes in and out: it holds taped's
      // x (the key there is at rest, so the hand-over is smooth), so the
      // opening cluster stays framed while the flash pushes in.
      if (v < T.about.dolly[0]) {
        const taped = RAIL.keys[2];
        this.pos.x = taped.pos.x;
        this.lookAt.x = taped.look.x;
      }
      this.pos.x += 3.4;
      this.lookAt.x += 3.4;
      this.pos.z += 2.5;
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.wall.localToWorld(this.lookWorld.copy(this.lookAt)));
  }

  update(v, time, intro) {
    this.pose(v);

    // Sun pans with the camera, a little behind it, so window shadows slide.
    // The contact corner takes the dusk aim and window; both change while the
    // wall is off screen (projects to scrapbook), so the light never jumps.
    const dusk = smooth(progress(v, T.contact.dusk));
    const corner = smooth(progress(v, [T.transitions.wallToRoom[1], T.transitions.deskToWall[0]]));
    // The about aim is exactly zero outside its window; it eases in, with the
    // about window fading in over the day's, and out after the leak hides the wall.
    const about = smooth(progress(v, T.about.light.in)) * (1 - smooth(progress(v, T.about.light.out)));
    const aboutFade = smooth(progress(v, T.about.light.fade));
    if (about > 0 && aboutFade < 1) this.aboutWindow.draw(this.app.renderer, aboutFade);
    const aboutMap = aboutFade < 1 ? this.aboutWindow.texture : this.tex['gobo-about'];
    const nudge = this.camera.aspect < 1 ? NARROW_AIM : WIDE_AIM;
    const day = (1 - about) * (1 - corner);
    const follow = this.lookAt.x * 0.88 + (DUSK.aim[0] + nudge.dusk[0]) * corner + (ABOUT_AIM[0] + nudge.about[0]) * about + nudge.day[0] * day;
    const lower = (ABOUT_AIM[1] + nudge.about[1]) * about + nudge.dusk[1] * corner + nudge.day[1] * day;
    this.sun.position.set(follow - lerp(15.6, DUSK.reach, corner), lerp(DAY.sunY, DUSK.sunY, dusk) + lower, lerp(16.5, DUSK.z, corner));
    this.sun.angle = lerp(0.5, DUSK.angle, corner);
    this.sun.target.position.set(follow + 0.4, 0.2 + DUSK.aim[1] * corner + lower, 0);
    if (nudge.back !== 1 && day > 0) {
      const target = this.sun.target.position;
      this.sun.position.sub(target).multiplyScalar(lerp(1, nudge.back, day)).add(target);
    }
    // Until the flash, one leaf of the window is nudged off the strip's spot so
    // it waits in clean sun; the swap back happens under the flash's white.
    this.sun.map = v < T.flash.fire ? this.tex['gobo-hello'] : corner > 0 ? this.tex['gobo-dusk'] : about > 0 ? aboutMap : this.tex.gobo;
    // The note under the spot retires under the same white.
    this.spotNote.visible = v < T.flash.fire;
    this.sun.color.copy(DAY.sun).lerp(DUSK.sun, dusk);
    this.sky.color.copy(DAY.sky).lerp(DUSK.sky, dusk);
    this.sky.groundColor.copy(DAY.ground).lerp(DUSK.ground, dusk);
    this.sky.intensity = lerp(0.9, DUSK.skyIntensity, dusk);

    // Load-in: light comes up, paper settles onto the wall.
    const settle = easeOut(clamp01(intro));
    this.sun.intensity = lerp(DAY.sunIntensity, DUSK.sunIntensity, dusk) * lerp(1, DUSK.rake, corner) * lerp(0.25, 1, settle);
    this.pieces.forEach((piece, index) => {
      const rest = piece.userData.rest;
      if (piece.userData.group !== 'hello') return;
      const local = clamp01(intro * 1.6 - index * 0.07);
      const k = 1 - easeOut(local);
      piece.position.set(rest.x, rest.y + k * 0.25, rest.z + k * 0.8);
      piece.rotation.z = rest.rot + k * 0.12 * (index % 2 ? 1 : -1);
    });

    this.updateStrip(this.strip, v, T.flash);
    this.strip.material.userData.tone.mono.value = 1 - smooth(progress(v, [T.flash.develop[1], T.flash.tape[1]]));
    const mounts = 1 - smooth(progress(v, [T.flash.develop[1] - 0.25, T.flash.tape[0] + 0.03]));
    this.mountMaterial.opacity = mounts;
    this.mountMaterial.visible = mounts > 0;
    // The note is slapped on after the strip, so the eye goes strip, note, email.
    const note = this.contactNote;
    const away = 1 - easeOut(progress(v, T.contact.note));
    note.visible = v > T.contact.note[0];
    note.position.set(note.userData.rest.x, note.userData.rest.y + away * 0.25, note.userData.rest.z + away * 0.8);
    note.rotation.z = note.userData.rest.rot + away * 0.12;
    this.updateStrip(this.contactStrip, v, { print: T.contact.strip, develop: [T.contact.strip[0] + 0.2, T.contact.strip[1] + 0.2], tape: [T.contact.strip[1] - 0.1, T.contact.strip[1] + 0.1] });

    // Anticipation: the room dims a touch during the countdown.
    const dim = smooth(progress(v, [T.flash.countdown[0], T.flash.fire])) * (1 - smooth(progress(v, [T.flash.fire, T.flash.fire + 0.05])));
    this.look.exposure = WALL_LOOK.exposure * (1 - 0.14 * dim) * lerp(0.35, 1, settle) * lerp(1, 0.94, dusk);
    // The warmth is in the sun, not the grade: a warm gain would turn paper coral.
    this.look.gain = [WALL_LOOK.gain[0], WALL_LOOK.gain[1], WALL_LOOK.gain[2] + 0.01 * dusk];
  }

  // A strip prints out of the top of the frame, swings, settles, develops,
  // then the tape lands.
  updateStrip(strip, v, { print, develop, tape: tapeRange }) {
    const rest = strip.userData.rest;
    const p = progress(v, print);
    strip.visible = v > print[0] - 0.02;
    const drop = 1 - easeOut(p);
    const swing = 0.1 * (1 - p) ** 2 * Math.sin(p * 9);
    // The tape drops in from above the camera, a little big and skewed,
    // slaps onto the top edge at `hit`, shoves the strip down into the wall,
    // and both settle. The strip seats itself as the tape comes down.
    const u = progress(v, tapeRange);
    const hit = 0.35;
    const fall = clamp01(u / hit);
    const press = Math.sin(Math.PI * clamp01((u - hit) / ((1 - hit) * 0.5)));
    const seated = smooth(fall);
    strip.position.set(
      rest.x + drop * 0.25,
      rest.y + drop * 5.6 - 0.045 * press,
      rest.z + 0.18 * (1 - seated) - 0.07 * press,
    );
    strip.rotation.z = rest.rot + swing + 0.014 * press;
    const frames = strip.material.userData.develop;
    const span = (develop[1] - develop[0]) / (frames.length + 1.5);
    frames.forEach((_, i) => {
      frames[i] = smooth(progress(v, [develop[0] + i * span, develop[0] + (i + 2.5) * span]));
    });
    const tapePiece = strip.children[0];
    if (tapePiece) {
      const base = (tapePiece.userData.base ??= { x: tapePiece.position.x, y: tapePiece.position.y, z: tapePiece.position.z, rot: tapePiece.rotation.z });
      const away = 1 - fall * fall; // accelerates into the hit
      tapePiece.visible = u > 0;
      tapePiece.position.set(base.x - 0.04 * away, base.y + 0.2 * away, base.z + 0.5 * away);
      tapePiece.rotation.z = base.rot + 0.28 * away;
      tapePiece.scale.set(1 + 0.3 * away + 0.05 * press, 1 + 0.3 * away - 0.04 * press, 1);
      tapePiece.material.opacity = 0.85 * smooth(clamp01(fall / 0.4)); // stays see-through
    }
  }

  // Where the flash strip's slot (its rest spot, framed by the corner mounts)
  // is on screen, so the countdown can wait in it: its centre and width in CSS
  // pixels and its tilt in radians (clockwise). Read-only: it projects through
  // the camera as this frame drew it.
  slot() {
    const { x, y, z, rot } = this.strip.userData.rest;
    const { width, height } = this.strip.userData.size;
    const scale = this.strip.scale.x; // phones lay the strip out larger
    const screen = this.app.renderer.getSize(new THREE.Vector2());
    const at = (along, up) => {
      const point = this.wall.localToWorld(new THREE.Vector3(
        x + along * Math.cos(rot) - up * Math.sin(rot), y + along * Math.sin(rot) + up * Math.cos(rot), z,
      )).project(this.camera);
      return { x: ((point.x + 1) / 2) * screen.x, y: ((1 - point.y) / 2) * screen.y };
    };
    const [centre, left, right, top, bottom] = [at(0, 0), at((-width * scale) / 2, 0), at((width * scale) / 2, 0), at(0, (height * scale) / 2), at(0, (-height * scale) / 2)];
    return {
      x: centre.x,
      y: centre.y,
      width: Math.hypot(right.x - left.x, right.y - left.y),
      tilt: Math.atan2(top.x - bottom.x, bottom.y - top.y),
    };
  }

  // Stepping the clock in reduced-motion mode never animates: the strip is
  // simply there, developed.
  stills(v) {
    const done = v >= T.flash.fire;
    this.strip.visible = done;
    if (done) {
      const rest = this.strip.userData.rest;
      this.strip.position.set(rest.x, rest.y, rest.z);
      this.strip.rotation.z = rest.rot;
      this.strip.material.userData.develop.fill(1);
    }
    this.strip.material.userData.tone.mono.value = 0;
    this.mountMaterial.opacity = done ? 0 : 1;
    this.mountMaterial.visible = !done;
  }

  report() {
    return RAIL.report();
  }
}
