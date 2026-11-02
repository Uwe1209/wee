// Three style frames for the hero moment, rendered with the site's own HDR
// pipeline. ?dir=a Darkroom, ?dir=b Golden hour, ?dir=c Cut & paste.
import * as THREE from 'three';
import { Pipeline } from '../../site/js/post/pipeline.js';
import {
  loadImage, makeCanvas, paperCanvas, plaster, random, risograph, roughRect, stickerCanvas, tapeCanvas,
} from '../../site/js/lib/paper.js';
import { instantPhoto, photoStrip, ticketStub } from '../../site/js/lib/prints.js';
import { canvasTexture, pin, printMesh } from '../../site/js/lib/meshes.js';

const params = new URLSearchParams(location.search);
const direction = params.get('dir') ?? 'a';
const IMG = '../../site/assets/img/';
const width = innerWidth;
const height = innerHeight;
const dpr = Number(params.get('dpr') ?? Math.min(2, devicePixelRatio));

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance',
});
renderer.setPixelRatio(dpr);
renderer.setSize(width, height, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pipeline = new Pipeline(renderer, { bloomLevels: 7, samples: 4 });
pipeline.setSize(Math.round(width * dpr), Math.round(height * dpr));

await Promise.all([
  '64px Caveat', '400 40px "Gochi Hand"', '500 17px "JetBrains Mono"', '700 34px "JetBrains Mono"',
  '800 60px "Bricolage Grotesque"', '900 60px Archivo', '400 60px "Instrument Serif"', 'italic 400 60px "Instrument Serif"',
  '400 20px "Inter Tight"',
].map((font) => document.fonts.load(font)));

const images = Object.fromEntries(await Promise.all(Object.entries({
  portrait: 'portrait.jpg',
  spex: 'projects/spex-map.jpg',
  kacha: 'projects/kacha-camera.jpg',
  herbarium: 'projects/herbarium.jpg',
  aws: 'projects/aws-architecture.jpg',
  poster: 'memories/spex-poster.jpg',
  certificate: 'memories/certificate.jpg',
  coaching: 'memories/coaching.jpg',
  gators: 'memories/gators.jpg',
  stage: 'memories/uriis-stage.jpg',
  game: 'memories/game.jpg',
  team: 'memories/outreach-team.jpg',
}).map(async ([key, file]) => [key, await loadImage(IMG + file)])));

// Four sittings in one strip: the ID photo, SPEX poster day, the outreach
// certificate, and coaching the warm-up.
const memoryStrip = () => [
  { image: images.portrait, zoom: 1.0, focusX: 0.5, focusY: 0.44 },
  { image: images.poster, zoom: 1.75, focusX: 0.75, focusY: 0.4 },
  { image: images.certificate, zoom: 1.0, focusX: 0.5, focusY: 0.3 },
  { image: images.coaching, zoom: 1.0, focusX: 0.5, focusY: 0.31 },
];

const hdr = (r, g, b, scale) => new THREE.Color(r, g, b).multiplyScalar(scale);

// A dark room with emissive panels, prefiltered for glossy reflections.
const studioEnvironment = (panels, background = 0x040405) => {
  const room = new THREE.Scene();
  room.background = new THREE.Color(background);
  panels.forEach(({ position, size, color }) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    room.add(panel);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.02);
  pmrem.dispose();
  return target.texture;
};

const softDot = () => {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTexture(canvas);
};

// Additive light that leaves the layer's alpha alone, so it never darkens the
// background layer behind it.
const glowBlending = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

const tape = (widthWorld, { color, stripes, seed, rotate = 0, x = 0, y = 0, z = 0.03 }) => {
  const mesh = printMesh(tapeCanvas(360, 104, { color, stripes, seed }), widthWorld, {
    physical: false, roughness: 0.75, transparent: true, segments: [4, 2],
  });
  mesh.material.depthWrite = false;
  mesh.castShadow = false;
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotate;
  return mesh;
};

// ---------------------------------------------------------------- A: Darkroom
const darkroom = () => {
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  camera.position.set(0, 0.1, 11);
  camera.lookAt(0, 0, 0);

  const back = new THREE.Scene();
  back.background = new THREE.Color(0x010102);

  const curtainGeometry = new THREE.PlaneGeometry(34, 18, 420, 6);
  const cp = curtainGeometry.attributes.position;
  for (let i = 0; i < cp.count; i += 1) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    cp.setZ(i, 0.34 * Math.sin(x * 1.9 + 0.4) + 0.17 * Math.sin(x * 4.1 + 1.3) + 0.07 * Math.sin(x * 9.2 + 0.2) + 0.06 * Math.sin(x * 0.9 + y * 0.3));
  }
  curtainGeometry.computeVertexNormals();
  const curtain = new THREE.Mesh(curtainGeometry, new THREE.MeshPhysicalMaterial({
    color: 0x1e0b0f, roughness: 0.8, sheen: 1, sheenColor: new THREE.Color(0x7a2434), sheenRoughness: 0.42,
  }));
  curtain.position.z = -5.5;
  back.add(curtain);

  // Drying line: the projects hang as prints on a diagonal wire, lit only by
  // the red safelight, out of focus behind the strip.
  const wireStart = new THREE.Vector3(-6.5, 2.2, -5.2);
  const wireEnd = new THREE.Vector3(7.5, 3.55, -1.2);
  const along = (t) => wireStart.clone().lerp(wireEnd, t).add(new THREE.Vector3(0, -0.22 * Math.sin(Math.PI * t), 0));
  const wire = new THREE.CatmullRomCurve3(Array.from({ length: 21 }, (_, k) => along(k / 20)));
  back.add(new THREE.Mesh(new THREE.TubeGeometry(wire, 120, 0.014, 6), new THREE.MeshStandardMaterial({ color: 0x9d968b, roughness: 0.5 })));
  [
    { image: images.gators, t: 0.42, w: 1.9, ratio: 0.72, rot: -0.04 },
    { image: images.stage, t: 0.6, w: 1.8, ratio: 0.64, rot: 0.035 },
    { image: images.game, t: 0.76, w: 1.6, ratio: 0.7, rot: 0.05 },
    { image: images.team, t: 0.9, w: 1.5, ratio: 0.9, rot: -0.03 },
  ].forEach((print, k) => {
    const mesh = printMesh(instantPhoto(print.image, { width: 640, ratio: print.ratio, look: 'mono', seed: 30 + k }), print.w, {
      gloss: 0.7, roughness: 0.45, curl: 0.3, cup: 0.12,
    });
    const top = along(print.t);
    mesh.position.copy(top).add(new THREE.Vector3(0, -mesh.userData.size.height / 2 + 0.06, 0.02));
    mesh.rotation.set(0, -0.28, print.rot);
    back.add(mesh);
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.08), new THREE.MeshStandardMaterial({ color: 0xc9a979, roughness: 0.65 }));
    peg.position.copy(top).add(new THREE.Vector3(0, -0.03, 0.07));
    back.add(peg);
  });

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: hdr(1, 0.1, 0.03, 70) }));
  bulb.position.set(-5.3, 3.35, -3.4);
  back.add(bulb);
  const safelight = new THREE.PointLight(0xff2412, 34, 0, 2);
  safelight.position.set(1.2, 4.6, -1.0);
  back.add(safelight);
  const flashBack = new THREE.SpotLight(0xfff2e4, 260, 0, 0.32, 0.85, 2);
  flashBack.position.set(5.5, 1.0, 9);
  flashBack.target.position.set(2.6, -2.2, -5.5);
  back.add(flashBack, flashBack.target, new THREE.AmbientLight(0x1b1218, 0.35));

  // Foreground: the fresh strip, dust caught in the flash, the flash reflector.
  const front = new THREE.Scene();
  front.environment = studioEnvironment([
    { position: [7, 4, 9], size: [6, 4], color: hdr(1, 0.97, 0.92, 22) },
    { position: [-8, -2, 4], size: [3, 6], color: hdr(1, 0.12, 0.05, 2.2) },
  ]);
  front.environmentIntensity = 0.55;
  const face = photoStrip(memoryStrip(), {
    look: 'mono', develop: 0.5, stamp: "'26 11 02", label: 'YOU WEE LIEW  ·  KUCHING  ·  02 11 26',
  });
  const strip = printMesh(face, 1.46, { gloss: 1, roughness: 0.32, curl: 0.16, segments: [8, 64] });
  strip.position.set(2.45, -0.12, 1.0);
  strip.rotation.set(0.05, 0.28, -0.06);
  front.add(strip);

  const flash = new THREE.SpotLight(0xfff3e6, 520, 0, 0.45, 0.6, 2);
  flash.position.set(6.5, 3.6, 9.5);
  flash.target.position.copy(strip.position);
  front.add(flash, flash.target, new THREE.AmbientLight(0x1a1418, 0.3));

  const reflector = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ color: hdr(1, 0.96, 0.9, 7), ...glowBlending }));
  reflector.position.set(6.3, 3.75, 1.5);
  front.add(reflector);

  const rand = random(77);
  const count = 600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let k = 0; k < count; k += 1) {
    const x = -5.8 + rand() * 11.6;
    const y = -3.4 + rand() * 6.8;
    const z = -1.5 + rand() * 6;
    positions.set([x, y, z], k * 3);
    const inBeam = Math.max(0, 1 - Math.hypot(x - 3.2, y - 1.4) / 4.2);
    const v = (0.15 + inBeam * 2.6) * (0.3 + rand() * rand() * 2.2);
    colors.set([v, v * 0.96, v * 0.9], k * 3);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  front.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    size: 0.045, map: softDot(), vertexColors: true, sizeAttenuation: true, ...glowBlending,
  })));

  pipeline.setLook({
    bloom: 0.085, halation: 0.55, exposure: 1.0, saturation: 0.86, contrast: 1.05,
    lift: [0.012, 0.008, 0.012], gain: [1.0, 0.985, 0.965], grain: 0.085, vignette: 0.5, aberration: 0.0012,
  });
  pipeline.renderScene(back, camera, pipeline.back, 1);
  const blurred = pipeline.blurBack(0.95);
  pipeline.renderScene(front, camera, pipeline.scene, 0);
  pipeline.present({ time: 1.3, back: blurred });

  return `
    <section class="dir-a">
      <div class="bar"><span>Photobooth Nº 0012</span><span>Kuching · Sarawak</span><span><b>●</b>&nbsp; 4 poses — RM 0</span></div>
      <h1 class="name"><span>You Wee</span><span>Liew</span></h1>
      <p class="role"><em>Software developer.</em> I lead teams and build systems from the data through to deployment.</p>
      <div class="cue"><span class="count">3</span><span>Scroll to take your photo</span></div>
    </section>`;
};

// ------------------------------------------------------------- B: Golden hour
const windowGobo = () => {
  const canvas = makeCanvas(1024, 1024);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = '#fff';
  const pane = { x: 170, y: 120, w: 300, h: 240, bar: 30 };
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillRect(pane.x + col * (pane.w + pane.bar), pane.y + row * (pane.h + pane.bar), pane.w, pane.h);
    }
  }
  const rand = random(5);
  ctx.fillStyle = '#000';
  for (let k = 0; k < 60; k += 1) {
    const x = 560 + rand() * 520;
    const y = rand() * 1024;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, 24 + rand() * 34, 8 + rand() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const soft = makeCanvas(1024, 1024);
  const sctx = soft.getContext('2d');
  sctx.filter = 'blur(9px)';
  sctx.drawImage(canvas, 0, 0);
  return soft;
};

const goldenHour = () => {
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9c7ad);

  const wall = new THREE.Group();
  wall.position.set(0.6, 0, -0.6);
  wall.rotation.y = 0.15;
  scene.add(wall);
  const { color, normal } = plaster(2048, 1252, { base: [236, 224, 205] });
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), new THREE.MeshStandardMaterial({
    map: canvasTexture(color), normalMap: canvasTexture(normal, { srgb: false }), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.94,
  }));
  wallMesh.receiveShadow = true;
  wall.add(wallMesh);

  const sun = new THREE.SpotLight(0xffae66, 6.2, 0, 0.5, 0.2, 0);
  sun.position.set(-17, 7, 15);
  sun.target.position.set(0.4, 0.2, -1);
  sun.map = canvasTexture(windowGobo());
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xb5c6e4, 0x7a5a44, 0.9));

  const ink = '#1f2c66';
  const cards = [
    { image: images.poster, w: 2.3, x: 0.35, y: 0.5, rot: 0.05, ratio: 1.24, caption: 'SPEX poster day!', pose: { zoom: 1.35, focusX: 0.66, focusY: 0.45 } },
    { strip: true, w: 1.0, x: 2.75, y: 0.05, rot: -0.035 },
    { image: images.stage, w: 2.65, x: 5.15, y: 1.45, rot: -0.05, ratio: 0.66, caption: 'URIIS 2026, top 5' },
    { image: images.gators, w: 2.1, x: 4.85, y: -1.8, rot: 0.06, ratio: 0.75, caption: 'gators dc, rawr' },
    { image: images.game, w: 2.5, x: 7.75, y: -0.3, rot: 0.035, ratio: 0.66, caption: 'game day' },
  ];
  cards.forEach((card, k) => {
    const face = card.strip
      ? photoStrip(memoryStrip(), { look: 'color', stamp: "'26 11 02", seed: 8 })
      : instantPhoto(card.image, { width: 860, ratio: card.ratio, caption: card.caption, font: '600 66px Caveat', ink, pose: card.pose, seed: 40 + k });
    const mesh = printMesh(face, card.w, { gloss: 0.35, roughness: 0.55, curl: 0.12, lift: k % 2 ? 0.5 : 0.2 });
    pin(wall, mesh, { x: card.x, y: card.y, z: 0.1, rotate: card.rot });
    const tapeMesh = tape(Math.min(0.62, card.w * 0.34), { color: 'rgba(233,221,190,0.8)', seed: 70 + k, rotate: (k % 2 ? 0.12 : -0.09) });
    tapeMesh.position.set(0, mesh.userData.size.height / 2 - 0.03, 0.06);
    mesh.add(tapeMesh);
  });

  pipeline.setLook({
    bloom: 0.05, halation: 0.18, exposure: 1.05, saturation: 1.04, contrast: 1.03,
    lift: [0.02, 0.012, 0.0], gain: [1.03, 0.99, 0.91], grain: 0.045, vignette: 0.32,
  });
  pipeline.renderScene(scene, camera, pipeline.scene, 1);
  pipeline.present({ time: 2.1 });

  return `
    <section class="dir-b">
      <div class="bar"><span>Memories · 2024 — 2026</span><span>Kuching, Sarawak</span></div>
      <h1 class="name">You Wee<br><em>Liew</em></h1>
      <p class="note">software developer: I build things from the data all the way to deployment :)</p>
      <p class="cue">scroll for the next memory ↓</p>
    </section>`;
};

// ------------------------------------------------------------ C: Cut & paste
const cutOut = (source, width, height, { pad = 28, seed = 3 } = {}) => {
  const canvas = makeCanvas(width + pad * 2, height + pad * 2);
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, { jitter: 3, step: 9, seed });
  ctx.fillStyle = '#fbf8f1';
  ctx.fill();
  ctx.drawImage(source, pad, pad);
  return canvas;
};

const doodle = () => {
  const canvas = makeCanvas(900, 520);
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0078bf';
  ctx.fillStyle = '#0078bf';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(90, 430);
  ctx.bezierCurveTo(240, 470, 520, 420, 640, 210);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(585, 228);
  ctx.lineTo(646, 200);
  ctx.lineTo(660, 268);
  ctx.stroke();
  ctx.font = '400 64px "Gochi Hand"';
  ctx.save();
  ctx.translate(40, 380);
  ctx.rotate(-0.08);
  ctx.fillText("that's me!", 0, 0);
  ctx.restore();
  return canvas;
};

const cutAndPaste = () => {
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 100);
  camera.position.set(0, -2.4, 15.2);
  camera.lookAt(0, 0.15, 0);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e2d4);

  const page = new THREE.Group();
  scene.add(page);
  const paper = paperCanvas(2048, 1260, { base: [245, 240, 229], grid: { step: 34, dot: 1.5, color: 'rgba(0,120,191,0.22)' } });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(18, (18 * 1260) / 2048), new THREE.MeshStandardMaterial({ map: canvasTexture(paper), roughness: 0.95 }));
  sheet.receiveShadow = true;
  page.add(sheet);

  const pink = { color: '#ff48b0', channel: (r, g, b) => 1 - (0.15 * r + 0.55 * g + 0.3 * b), angle: 0.26, offset: [0, 0] };
  const blue = { color: '#0078bf', channel: (r, g, b) => 1 - (0.62 * r + 0.3 * g + 0.08 * b), angle: 1.31, offset: [3, 2] };
  const flat = { physical: false, roughness: 0.92, alphaTest: 0.5 };

  const portrait = printMesh(cutOut(risograph(images.poster, 760, 940, { cell: 7, inks: [pink, blue], zoom: 1.3, focusX: 0.7, focusY: 0.46 }), 760, 940), 2.55, { ...flat, lift: 0.5 });
  pin(page, portrait, { x: 1.75, y: 0.35, z: 0.06, rotate: -0.075 });
  const stripFrames = memoryStrip();
  stripFrames[1] = { image: images.game, zoom: 1.2, focusX: 0.5, focusY: 0.62 };
  const strip = printMesh(photoStrip(stripFrames, { look: 'riso', label: 'PHOTOBOOTH · 4 POSES', labelFont: '700 26px "JetBrains Mono"' }), 1.05, { ...flat, curl: 0.15 });
  pin(page, strip, { x: 4.35, y: -0.35, z: 0.1, rotate: 0.11 });
  const ticket = printMesh(ticketStub({
    lines: [
      { text: 'ADMIT ONE', font: '800 132px "Bricolage Grotesque"', x: 0.06, y: 0.52 },
      { text: 'PHOTOBOOTH · KUCHING, SARAWAK', font: '700 30px "JetBrains Mono"', x: 0.065, y: 0.72 },
      { text: '4 POSES — RM 0 — KEEP THIS ONE', font: '500 25px "JetBrains Mono"', x: 0.065, y: 0.84, color: '#ff48b0' },
    ],
  }), 3.1, { ...flat, alphaTest: 0.3 });
  pin(page, ticket, { x: 1.35, y: -2.55, z: 0.05, rotate: 0.04 });
  const spex = printMesh(cutOut(risograph(images.gators, 900, 640, { cell: 6, inks: [pink, blue] }), 900, 640, { seed: 9 }), 2.15, { ...flat, lift: 0.4 });
  pin(page, spex, { x: 5.25, y: 2.25, z: 0.04, rotate: -0.07 });

  [
    { shape: 'star', fill: '#ffc83d', w: 0.78, x: 3.15, y: 2.35, rot: 0.22, seed: 1 },
    { shape: 'heart', fill: '#ff5fa2', w: 0.72, x: 6.75, y: -2.35, rot: -0.18, seed: 2 },
    { shape: 'sparkle', fill: '#3d7bf0', w: 0.55, x: 0.2, y: 2.05, rot: 0.1, seed: 3 },
    { shape: 'star', fill: '#ff5fa2', w: 0.46, x: 5.35, y: 0.95, rot: -0.3, seed: 4 },
  ].forEach((s) => {
    const mesh = printMesh(stickerCanvas(s.shape, 220, s.fill, { seed: s.seed }), s.w, { physical: true, gloss: 0.8, roughness: 0.35, alphaTest: 0.5 });
    pin(page, mesh, { x: s.x, y: s.y, z: 0.16, rotate: s.rot });
  });

  page.add(tape(1.0, { color: 'rgba(255,120,190,0.78)', stripes: 'rgba(255,255,255,0.55)', seed: 11, rotate: -0.62, x: 0.55, y: 1.85, z: 0.12 }));
  page.add(tape(0.8, { color: 'rgba(120,180,240,0.78)', stripes: 'rgba(255,255,255,0.45)', seed: 12, rotate: 0.12, x: 4.55, y: 1.45, z: 0.16 }));
  page.add(tape(0.9, { color: 'rgba(255,214,90,0.8)', seed: 13, rotate: 0.5, x: 7.2, y: 2.95, z: 0.1 }));

  const scribble = printMesh(doodle(), 2.4, { physical: false, roughness: 1, transparent: true });
  scribble.castShadow = false;
  pin(page, scribble, { x: -0.55, y: -0.7, z: 0.01, rotate: 0.02 });

  const key = new THREE.DirectionalLight(0xfffaf0, 2.6);
  key.position.set(-4, 6, 12);
  key.target.position.set(1.5, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 7, bottom: -7, near: 1, far: 40 });
  key.shadow.radius = 9;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0003;
  scene.add(key, key.target, new THREE.HemisphereLight(0xffffff, 0xd9cdb8, 1.1));

  pipeline.setLook({ bloom: 0.02, exposure: 1.0, saturation: 1.0, contrast: 1.02, grain: 0.035, vignette: 0.14 });
  pipeline.renderScene(scene, camera, pipeline.scene, 1);
  pipeline.present({ time: 0.7 });

  return `
    <section class="dir-c">
      <div class="bar"><span>Scrapbook Nº 12</span><span>Kuching, Sarawak</span><span>2024 — 2026</span></div>
      <h1 class="name"><span class="ink blue">You Wee<br>Liew</span><span class="ink pink">You Wee<br>Liew</span></h1>
      <p class="scribble">hi! I'm a software developer. I build things from the data → to deployment ✶</p>
      <div class="chips"><span class="chip">React</span><span class="chip">TypeScript</span><span class="chip">FastAPI</span><span class="chip">Supabase</span><span class="chip">PostgreSQL</span><span class="chip">Vercel</span></div>
    </section>`;
};

// --------------------------------------------- BC: Golden-hour scrapbook (pick)
const paperNote = (text, { width = 620, font = '600 74px Caveat', ink = '#1f2c66', seed = 51 } = {}) => {
  const canvas = makeCanvas(width, Math.round(width * 0.42));
  const ctx = canvas.getContext('2d');
  roughRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, { jitter: 2.5, step: 12, seed });
  ctx.fillStyle = '#fbf6ea';
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  return canvas;
};

const goldenScrapbook = () => {
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9c7ad);

  const wall = new THREE.Group();
  wall.position.set(0.6, 0, -0.6);
  wall.rotation.y = 0.15;
  scene.add(wall);
  const { color, normal } = plaster(2048, 1252, { base: [236, 224, 205] });
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), new THREE.MeshStandardMaterial({
    map: canvasTexture(color), normalMap: canvasTexture(normal, { srgb: false }), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.94,
  }));
  wallMesh.receiveShadow = true;
  wall.add(wallMesh);

  const sun = new THREE.SpotLight(0xffc28a, 6.0, 0, 0.5, 0.2, 0);
  sun.position.set(-17, 7, 15);
  sun.target.position.set(0.4, 0.2, -1);
  sun.map = canvasTexture(windowGobo());
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xb5c6e4, 0x7a5a44, 0.9));

  const ink = '#1f2c66';
  const pink = { color: '#ff48b0', channel: (r, g, b) => 1 - (0.15 * r + 0.55 * g + 0.3 * b), angle: 0.26, offset: [0, 0] };
  const blue = { color: '#0078bf', channel: (r, g, b) => 1 - (0.62 * r + 0.3 * g + 0.08 * b), angle: 1.31, offset: [3, 2] };
  const stick = (mesh, at) => pin(wall, mesh, at);
  const tapeOn = (mesh, options) => {
    const strip = tape(options.width, options);
    mesh.add(strip);
    return strip;
  };

  const poster = printMesh(instantPhoto(images.poster, {
    width: 860, ratio: 1.24, caption: 'SPEX poster day!', font: '600 66px Caveat', ink, pose: { zoom: 1.35, focusX: 0.66, focusY: 0.45 }, seed: 40,
  }), 2.25, { gloss: 0.35, roughness: 0.55, curl: 0.12, lift: 0.2 });
  stick(poster, { x: 0.45, y: 0.55, z: 0.1, rotate: 0.045 });
  tapeOn(poster, { width: 0.75, color: 'rgba(255,120,190,0.8)', stripes: 'rgba(255,255,255,0.55)', seed: 11, rotate: -0.55, x: -0.95, y: 1.3, z: 0.05 });

  const strip = printMesh(photoStrip(memoryStrip(), { look: 'color', stamp: "'26 11 02", seed: 8 }), 0.98, { gloss: 0.35, roughness: 0.55, curl: 0.12, lift: 0.5 });
  stick(strip, { x: 2.75, y: 0.0, z: 0.1, rotate: -0.035 });
  tapeOn(strip, { width: 0.5, color: 'rgba(233,221,190,0.82)', seed: 71, rotate: 0.1, y: strip.userData.size.height / 2 - 0.03, z: 0.06 });

  const stage = printMesh(cutOut(risograph(images.stage, 900, 600, { cell: 6, inks: [pink, blue] }), 900, 600, { seed: 9 }), 2.5, {
    physical: false, roughness: 0.92, alphaTest: 0.5, lift: 0.4,
  });
  stick(stage, { x: 5.05, y: 1.6, z: 0.1, rotate: -0.05 });
  tapeOn(stage, { width: 0.7, color: 'rgba(255,214,90,0.82)', seed: 13, rotate: 0.48, x: 1.1, y: 0.75, z: 0.05 });
  const label = printMesh(paperNote('URIIS 2026 · top 5'), 1.55, { physical: false, roughness: 0.9, alphaTest: 0.5, lift: 0.3 });
  stick(label, { x: 4.6, y: 0.2, z: 0.14, rotate: 0.05 });

  const gators = printMesh(instantPhoto(images.gators, {
    width: 860, ratio: 0.75, caption: 'gators dc, rawr', font: '600 66px Caveat', ink, seed: 44,
  }), 2.05, { gloss: 0.35, roughness: 0.55, curl: 0.12, lift: 0.5 });
  stick(gators, { x: 4.85, y: -1.85, z: 0.1, rotate: 0.06 });
  tapeOn(gators, { width: 0.6, color: 'rgba(120,180,240,0.8)', stripes: 'rgba(255,255,255,0.45)', seed: 12, rotate: -0.08, y: 0.98, z: 0.05 });

  const ticket = printMesh(ticketStub({
    lines: [
      { text: 'ADMIT ONE', font: '800 132px "Bricolage Grotesque"', x: 0.06, y: 0.52 },
      { text: 'PHOTOBOOTH · KUCHING, SARAWAK', font: '700 30px "JetBrains Mono"', x: 0.065, y: 0.72 },
      { text: '4 POSES — RM 0 — KEEP THIS ONE', font: '500 25px "JetBrains Mono"', x: 0.065, y: 0.84, color: '#ff48b0' },
    ],
  }), 2.5, { physical: false, roughness: 0.9, alphaTest: 0.3, lift: 0.3 });
  stick(ticket, { x: 1.35, y: -2.5, z: 0.12, rotate: 0.035 });

  [
    { shape: 'star', fill: '#ffc83d', w: 0.62, x: 1.5, y: 1.95, rot: 0.22, seed: 1 },
    { shape: 'heart', fill: '#ff5fa2', w: 0.5, x: 3.5, y: 1.85, rot: -0.2, seed: 2 },
    { shape: 'sparkle', fill: '#3d7bf0', w: 0.42, x: 6.4, y: -0.7, rot: 0.1, seed: 3 },
  ].forEach((s) => {
    const mesh = printMesh(stickerCanvas(s.shape, 220, s.fill, { seed: s.seed }), s.w, { physical: true, gloss: 0.8, roughness: 0.35, alphaTest: 0.5 });
    stick(mesh, { x: s.x, y: s.y, z: 0.2, rotate: s.rot });
  });

  pipeline.setLook({
    bloom: 0.05, halation: 0.16, exposure: 1.06, saturation: 0.98, contrast: 1.04,
    lift: [0.018, 0.012, 0.004], gain: [1.02, 0.995, 0.95], grain: 0.045, vignette: 0.3,
  });
  pipeline.renderScene(scene, camera, pipeline.scene, 1);
  pipeline.present({ time: 2.1 });

  return `
    <section class="dir-bc">
      <div class="bar"><span>Memories · 2024 — 2026</span><span>Kuching, Sarawak</span><span>Scrapbook Nº 12</span></div>
      <h1 class="name">You Wee<br><em class="riso"><span class="ink blue">Liew</span><span class="ink pink">Liew</span></em></h1>
      <p class="note">software developer: I build things from the data all the way to deployment :)</p>
      <div class="chips"><span class="chip">React</span><span class="chip">TypeScript</span><span class="chip">FastAPI</span><span class="chip">Supabase</span><span class="chip">PostgreSQL</span></div>
      <p class="cue">Scroll ↓</p>
    </section>`;
};

const started = performance.now();
const build = { a: darkroom, b: goldenHour, c: cutAndPaste, bc: goldenScrapbook }[direction] ?? darkroom;
document.getElementById('overlay').innerHTML = build();
await document.fonts.ready;
window.__frame = { ready: true, direction, ms: Math.round(performance.now() - started) };
