// HDR post pipeline: half-float scene targets, a bloom pyramid, an optional
// blurred background layer (cheap depth of field), and one composite pass that
// does exposure, filmic tone mapping, grade, grain, vignette and dither.
//
// GLSL rules kept here: smoothstep edges never cross (we write 1.0 - smoothstep
// instead of reversed edges) and no division by a value that can reach zero.
import * as THREE from 'three';

const TRIANGLE = (() => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return geometry;
})();
const ORTHO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export class FullscreenPass {
  constructor(material) {
    this.material = material;
    this.mesh = new THREE.Mesh(TRIANGLE, material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }

  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, ORTHO);
  }
}

export const fullscreenMaterial = (fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });

const DOWNSAMPLE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uKaris;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 color;
  if (uKaris > 0.5) {
    // Karis average on the first mip keeps single hot pixels from flickering.
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = 0.125 / (1.0 + luma(g0)), w1 = 0.125 / (1.0 + luma(g1));
    float w2 = 0.125 / (1.0 + luma(g2)), w3 = 0.125 / (1.0 + luma(g3)), w4 = 0.5 / (1.0 + luma(g4));
    color = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    color = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}`;

const UPSAMPLE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uGain;
varying vec2 vUv;
void main() {
  vec2 d = uTexel * uRadius;
  vec3 color = texture2D(tSrc, vUv + vec2(-d.x, d.y)).rgb
    + texture2D(tSrc, vUv + vec2(0.0, d.y)).rgb * 2.0
    + texture2D(tSrc, vUv + vec2(d.x, d.y)).rgb
    + texture2D(tSrc, vUv + vec2(-d.x, 0.0)).rgb * 2.0
    + texture2D(tSrc, vUv).rgb * 4.0
    + texture2D(tSrc, vUv + vec2(d.x, 0.0)).rgb * 2.0
    + texture2D(tSrc, vUv + vec2(-d.x, -d.y)).rgb
    + texture2D(tSrc, vUv + vec2(0.0, -d.y)).rgb * 2.0
    + texture2D(tSrc, vUv + vec2(d.x, -d.y)).rgb;
  gl_FragColor = vec4(color * (uGain / 16.0), 1.0);
}`;

const MERGE_FRAG = /* glsl */ `
uniform sampler2D tFront;
uniform sampler2D tBack;
varying vec2 vUv;
void main() {
  vec4 front = texture2D(tFront, vUv);
  vec3 back = texture2D(tBack, vUv).rgb;
  gl_FragColor = vec4(front.rgb + back * (1.0 - clamp(front.a, 0.0, 1.0)), 1.0);
}`;

// Blends two chapter renders. 1: sun glare that floods the lens, swaps the
// chapters while overexposed and decays (uGlare 0..1 is its envelope),
// 2: a page sliding up from the bottom, 3: the page sliding back down,
// 4: plain cross-fade (reduced motion).
const TRANSITION_FRAG = /* glsl */ `
uniform sampler2D tA;
uniform sampler2D tB;
uniform float uMix;
uniform float uGlare;
uniform float uType;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 uv = vUv;
  vec3 a = texture2D(tA, uv).rgb;
  vec3 color = a;
  float aspect = uResolution.y / max(uResolution.x, 1.0);
  if (uType < 1.5) {
    vec3 b = texture2D(tB, uv).rgb;
    float g = uGlare;
    // The swap is a dissolve in a compressed range, x / (1 + x), so the room's
    // HDR window fades in like any other surface. The wall dips under the
    // light as the swap starts and leaves faster than the room arrives, so the
    // two never double-expose; the room then rises out of the light, its
    // window glowing through it.
    vec3 ka = max(a, vec3(0.0)) / (1.0 + max(a, vec3(0.0)));
    vec3 kb = max(b, vec3(0.0)) / (1.0 + max(b, vec3(0.0)));
    float leave = (1.0 - uMix) * (1.0 - uMix) * (1.0 - uMix) * (1.0 - 0.95 * smoothstep(0.0, 0.3, uMix) * g);
    vec3 k = ka * leave + kb * uMix * uMix;
    color = k / max(vec3(1.0) - k, vec3(0.002));
    // Light fills in for whatever of the two chapters is missing mid-swap.
    float fill = max(1.0 - leave - uMix * uMix, 0.0);
    // Flare light scatters inside the lens and is not vignetted, but the scene
    // is: the composite eases its vignette with the glare, so it moves here.
    float wh = uResolution.x / max(uResolution.y, 1.0);
    float rim = length((uv - 0.5) * vec2(wh, 1.0)) / (0.5 * sqrt(wh * wh + 1.0));
    color *= 1.0 - mix(0.6, 0.8, uMix) * g * smoothstep(0.35, 1.0, rim);
    // The light comes from the wall's sun inside the upper-left corner and
    // settles into the room's window as it decays. Distances in frame widths.
    vec2 sun = mix(vec2(0.1, 0.8), vec2(0.5, 0.86), smoothstep(0.0, 1.0, uMix * (1.0 - g)));
    vec2 d = vec2(uv.x - sun.x, (uv.y - sun.y) * aspect);
    float r = length(d);
    // It reaches across the frame as it builds and draws back into the source
    // as it decays, so it reads as a flare, not a fog.
    float reach = exp(-r * (6.0 - 4.0 * g));
    // Amber gel: reds lift and blues fall, so the filmic shoulder keeps the
    // light amber instead of cream.
    color *= vec3(1.0) + vec3(0.15, -0.22, -0.5) * g * reach;
    // The room is darker than the wall, so the light carries more of it.
    float wash = g * ((0.45 + 1.25 * uMix) * reach + 0.7 * fill * (0.4 + 0.6 * reach));
    wash *= 0.85 + 0.3 * tNoise(uv * vec2(1.6, 2.4) + vec2(uTime * 0.03, 0.0));
    // A small white-gold core in a gold halo.
    float halo = exp(-r * 9.0);
    float core = exp(-r * r / 0.0015);
    // Lens character: a soft horizontal streak through the source, and a faint
    // ghost mirrored through the centre.
    float streak = exp(-d.y * d.y / 0.0001) * exp(-abs(d.x) * 2.5);
    float gr = length(vec2(uv.x - 1.0 + sun.x, (uv.y - 1.0 + sun.y) * aspect));
    float ghost = (1.0 - smoothstep(0.035, 0.05, gr)) * (0.5 + 0.5 * smoothstep(0.02, 0.045, gr));
    color += vec3(1.0, 0.45, 0.15) * wash + g * (vec3(1.0, 0.5, 0.18) * (halo + streak * 0.6) + vec3(1.0, 0.72, 0.42) * core * 1.6 + vec3(0.9, 0.5, 0.3) * ghost * 0.08);
  } else if (uType < 2.5) {
    // A sheet of paper slid up over the room, not a wipe. It comes in a couple
    // of degrees off square, left corner first, and squares up as it lands.
    // Its top edge is deckled and curls back toward the room, most at the
    // leading corner, so the window light catches a thin lip along it; the
    // room gets a soft shadow above the edge that widens as the sheet lifts.
    // Lengths are in frame heights, with x scaled by the aspect so the tilt doesn't shear.
    float m = uMix;
    float wide = uResolution.x / max(uResolution.y, 1.0);
    float px = 1.0 / max(uResolution.y, 1.0);
    // Curl and lip flatten as it lands, so the last frame is exactly the desk.
    float settle = 1.0 - smoothstep(0.95, 1.0, m);
    float tilt = -0.05 * (1.0 - m);
    // Starts low enough that the turned corner is still out of frame at 0.
    float rise = m * 1.08 - 0.08;
    vec2 q = vec2((uv.x - 0.5) * wide, uv.y - rise);
    float cs = cos(tilt);
    float sn = sin(tilt);
    // Sheet space: x along the top edge, y up from it.
    vec2 s = vec2(cs * q.x + sn * q.y, cs * q.y - sn * q.x);
    float sx = s.x / max(wide, 0.001);
    float lead = smoothstep(-0.5, 0.5, -sx);
    float curl = settle * mix(0.35, 1.0, lead);
    // The curl foreshortens the edge, most at the leading corner, and the sheet flexes a little as it moves.
    float bend = settle * (0.005 * sin(sx * 4.7 + 1.1 + 1.8 * m) - 0.005 * curl);
    float deckle = 0.0026 * (0.65 * tNoise(vec2(s.x * 40.0, 1.7)) + 0.35 * tNoise(vec2(s.x * 146.0, 5.3)));
    float base = max(0.0012, 1.5 * px);
    float depth = base + deckle + bend - s.y;
    float cover = smoothstep(-0.75 * px, 0.75 * px, depth);
    // The desk rides with the sheet; mirrored so a turned corner never samples off the render.
    vec2 st = vec2(0.5 + sx, 1.0 + s.y);
    st = 1.0 - abs(1.0 - abs(st));
    vec3 page = texture2D(tB, st).rgb;
    float glow = 1.0 - smoothstep(0.0, mix(0.008, 0.022, curl), depth);
    float lip = 1.0 - smoothstep(0.0, max(2.0 * px, 0.0019), depth);
    float catchLight = settle * mix(0.6, 1.0, lead) * (0.75 + 0.5 * tNoise(vec2(s.x * 84.0, 9.1)));
    page = page * (1.0 + 0.35 * catchLight * glow * glow) + vec3(1.0, 0.72, 0.48) * catchLight * (0.45 * lip + 0.08 * glow * glow);
    float lift = smoothstep(0.0, 0.8, m);
    float h = max(s.y - base - bend, 0.0);
    float soft = mix(0.014, 0.08, lift) * (0.85 + 0.3 * curl);
    float shade = mix(0.8, 0.6, lift) * exp(-h / soft) + 0.15 * exp(-h / (3.0 * px));
    shade *= smoothstep(0.0, 0.06, m);
    color = mix(a * (1.0 - min(shade, 0.9)), page, cover);
  } else if (uType < 3.5) {
    float edge = 1.0 - uMix;
    if (uv.y < edge) {
      color = texture2D(tA, vec2(uv.x, uv.y + uMix)).rgb;
    } else {
      float d = (uv.y - edge) * aspect;
      color = texture2D(tB, uv).rgb * (1.0 - 0.5 * exp(-d * 40.0) * step(0.0005, uMix));
    }
  } else {
    color = mix(a, texture2D(tB, uv).rgb, uMix);
  }
  gl_FragColor = vec4(color, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uBloomLevels;
uniform float uHalation;
uniform vec3 uHalationTint;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uGrain;
uniform float uVignette;
uniform float uAberration;
uniform float uFlash;
uniform vec3 uFlashTint;
uniform float uTime;
uniform vec2 uResolution;
varying vec2 vUv;

vec3 rrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 filmic(vec3 c) {
  const mat3 inMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 outMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  return clamp(outMat * rrtOdtFit(inMat * c), 0.0, 1.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  vec2 uv = vUv;
  vec2 fromCenter = uv - 0.5;
  vec4 scene = texture2D(tScene, uv);
  vec3 color = scene.rgb;
  if (uAberration > 0.0) {
    color.r = texture2D(tScene, uv - fromCenter * uAberration).r;
    color.b = texture2D(tScene, uv + fromCenter * uAberration).b;
  }
  vec3 bloom = texture2D(tBloom, uv).rgb / max(uBloomLevels, 1.0);
  color = mix(color, bloom, uBloom) + bloom * uHalation * uHalationTint;
  // The flash (uFlash: 0 at rest, 9 at its peak) is warm light (uFlashTint)
  // from the lens axis. It lights the scene, so the sunlit wall and the paper
  // clip first and the darks hold out longest; it pours out of everything
  // bright as bloom with a halation fringe; and near the peak a white-hot core
  // floods the middle of the frame. The vignette opens with it (below), so the
  // falloff runs to gold, not grey. Distances are in frame heights.
  vec2 flashAxis = fromCenter * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float flashR2 = dot(flashAxis, flashAxis);
  vec3 flashLight = uFlash * uFlashTint;
  color *= 1.0 + flashLight * (0.1 + 0.25 * exp(-2.2 * flashR2));
  color += bloom * (1.0 + 0.8 * uHalationTint) * flashLight * (0.003 * uFlash);
  color += uFlashTint * (3.0 * smoothstep(6.0, 9.0, uFlash) * exp(-4.5 * flashR2));
  color *= uExposure;
  color = filmic(color);

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, uSaturation);
  color = color * uGain + uLift * (1.0 - color);

  vec3 display = toSRGB(color);
  display = clamp((display - 0.5) * uContrast + 0.5, 0.0, 1.0);

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float radius = length(fromCenter * vec2(aspect, 1.0)) / (0.5 * sqrt(aspect * aspect + 1.0));
  display *= 1.0 - uVignette * (1.0 - smoothstep(0.0, 5.0, uFlash)) * smoothstep(0.35, 1.0, radius);

  vec2 pixel = uv * uResolution;
  float frame = floor(uTime * 24.0);
  float grain = hash12(pixel + frame * 17.31) - 0.5;
  float response = 0.25 + 3.0 * luma * (1.0 - luma);
  display += grain * uGrain * response;

  float dither = hash12(pixel + 0.71) + hash12(pixel + 1.37) - 1.0;
  display += dither / 255.0;
  gl_FragColor = vec4(display, 1.0);
}`;

const hdrTarget = (width, height, { samples = 0, depth = false } = {}) =>
  new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
  });

export const DEFAULT_LOOK = {
  bloom: 0.06,
  bloomRadius: 1.0,
  halation: 0.0,
  halationTint: [1.0, 0.32, 0.12],
  exposure: 1.0,
  saturation: 1.0,
  contrast: 1.0,
  lift: [0, 0, 0],
  gain: [1, 1, 1],
  grain: 0.04,
  vignette: 0.25,
  aberration: 0.0,
  flash: 0.0,
  flashTint: [1.0, 0.78, 0.5], // a warm gel: blows out to cream-white, falls off to gold
};

export class Pipeline {
  constructor(renderer, { bloomLevels = 6, samples = 4, layers = true } = {}) {
    this.renderer = renderer;
    this.bloomLevels = bloomLevels;
    this.samples = samples;
    this.layers = layers;
    this.blend = hdrTarget(4, 4);
    this.transitionPass = new FullscreenPass(fullscreenMaterial(TRANSITION_FRAG, {
      tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uGlare: { value: 0 }, uType: { value: 1 }, uTime: { value: 0 }, uResolution: { value: new THREE.Vector2() },
    }));
    this.scene = hdrTarget(4, 4, { samples, depth: true });
    this.back = hdrTarget(4, 4, { samples, depth: true });
    this.merged = hdrTarget(4, 4);
    this.mergePass = new FullscreenPass(fullscreenMaterial(MERGE_FRAG, { tFront: { value: null }, tBack: { value: null } }));
    this.down = [];
    this.blurDown = [];
    this.blurUp = [];
    this.downPass = new FullscreenPass(
      fullscreenMaterial(DOWNSAMPLE_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 } }),
    );
    this.upPass = new FullscreenPass(
      fullscreenMaterial(
        UPSAMPLE_FRAG,
        { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uGain: { value: 1 } },
        { blending: THREE.AdditiveBlending, transparent: true },
      ),
    );
    this.copyUpPass = new FullscreenPass(
      fullscreenMaterial(UPSAMPLE_FRAG, {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
        uGain: { value: 1 },
      }),
    );
    this.composite = new FullscreenPass(
      fullscreenMaterial(COMPOSITE_FRAG, {
        tScene: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0 },
        uBloomLevels: { value: bloomLevels },
        uHalation: { value: 0 },
        uHalationTint: { value: new THREE.Color() },
        uExposure: { value: 1 },
        uSaturation: { value: 1 },
        uContrast: { value: 1 },
        uLift: { value: new THREE.Vector3() },
        uGain: { value: new THREE.Vector3(1, 1, 1) },
        uGrain: { value: 0 },
        uVignette: { value: 0 },
        uAberration: { value: 0 },
        uFlash: { value: 0 },
        uFlashTint: { value: new THREE.Color(1, 1, 1) },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
      }),
    );
    this.look = { ...DEFAULT_LOOK };
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    if (this.layers) {
      this.scene.setSize(width, height);
      this.back.setSize(width, height);
      this.merged.setSize(width, height);
    }
    this.blend.setSize(width, height);
    this.transitionPass.material.uniforms.uResolution.value.set(width, height);
    const rebuild = (list, count, divisor) => {
      list.forEach((target) => target.dispose());
      list.length = 0;
      let w = Math.max(1, Math.floor(width / divisor));
      let h = Math.max(1, Math.floor(height / divisor));
      for (let level = 0; level < count; level += 1) {
        list.push(hdrTarget(w, h));
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
      }
    };
    rebuild(this.down, this.bloomLevels, 2);
    rebuild(this.blurDown, 4, 2);
    rebuild(this.blurUp, 4, 2);
    this.composite.material.uniforms.uResolution.value.set(width, height);
  }

  setLook(look) {
    this.look = { ...DEFAULT_LOOK, ...look };
  }

  // Renders `scene` into the HDR target. `clearAlpha` 0 lets a foreground layer
  // sit over the blurred background layer.
  renderScene(scene, camera, target = this.scene, clearAlpha = 1) {
    const { renderer } = this;
    const previousAlpha = renderer.getClearAlpha();
    renderer.setClearAlpha(clearAlpha);
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setClearAlpha(previousAlpha);
  }

  downsample(source, targets, karisFirst) {
    const uniforms = this.downPass.material.uniforms;
    let input = source;
    targets.forEach((target, index) => {
      uniforms.tSrc.value = input.texture;
      uniforms.uTexel.value.set(1 / input.width, 1 / input.height);
      uniforms.uKaris.value = karisFirst && index === 0 ? 1 : 0;
      this.downPass.render(this.renderer, target);
      input = target;
    });
  }

  buildBloom(source) {
    this.downsample(source, this.down, true);
    const uniforms = this.upPass.material.uniforms;
    uniforms.uRadius.value = this.look.bloomRadius;
    for (let level = this.down.length - 1; level > 0; level -= 1) {
      const source = this.down[level];
      uniforms.tSrc.value = source.texture;
      uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
      this.renderer.autoClear = false;
      this.upPass.render(this.renderer, this.down[level - 1]);
      this.renderer.autoClear = true;
    }
    return this.down[0].texture;
  }

  // Blurs the background layer: four mips down, back up again with a tent filter.
  blurBack(radius = 1.5) {
    this.downsample(this.back, this.blurDown, false);
    const uniforms = this.copyUpPass.material.uniforms;
    uniforms.uRadius.value = radius;
    let input = this.blurDown[this.blurDown.length - 1];
    for (let level = this.blurDown.length - 2; level >= 0; level -= 1) {
      uniforms.tSrc.value = input.texture;
      uniforms.uTexel.value.set(1 / input.width, 1 / input.height);
      this.copyUpPass.render(this.renderer, this.blurUp[level]);
      input = this.blurUp[level];
    }
    return input.texture;
  }

  // Blends two chapter targets into the blend target and returns it.
  // `glare` (0..1) is the light leak's envelope; only type 1 reads it.
  transition(a, b, mix, type, time = 0, glare = 0) {
    const u = this.transitionPass.material.uniforms;
    u.tA.value = a.texture;
    u.tB.value = b.texture;
    u.uMix.value = mix;
    u.uGlare.value = glare;
    u.uType.value = type;
    u.uTime.value = time;
    this.transitionPass.render(this.renderer, this.blend);
    return this.blend;
  }

  // `source` is the HDR target to finish (defaults to the scene layer).
  // `back` is an optional blurred background texture that shows wherever the
  // foreground layer was left transparent.
  present({ time = 0, back = null, source: given = null } = {}) {
    let source = given ?? this.scene;
    if (back) {
      const mu = this.mergePass.material.uniforms;
      mu.tFront.value = this.scene.texture;
      mu.tBack.value = back;
      this.mergePass.render(this.renderer, this.merged);
      source = this.merged;
    }
    const bloom = this.buildBloom(source);
    const u = this.composite.material.uniforms;
    const look = this.look;
    u.tScene.value = source.texture;
    u.tBloom.value = bloom;
    u.uBloom.value = look.bloom;
    u.uHalation.value = look.halation;
    u.uHalationTint.value.setRGB(...look.halationTint);
    u.uExposure.value = look.exposure;
    u.uSaturation.value = look.saturation;
    u.uContrast.value = look.contrast;
    u.uLift.value.set(...look.lift);
    u.uGain.value.set(...look.gain);
    u.uGrain.value = look.grain;
    u.uVignette.value = look.vignette;
    u.uAberration.value = look.aberration;
    u.uFlash.value = look.flash;
    u.uFlashTint.value.setRGB(...look.flashTint);
    u.uTime.value = time;
    this.composite.render(this.renderer, null);
  }
}
