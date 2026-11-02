// Camera rails keyed to scroll (vh). Between keys the camera eases with a
// smoothstep, so it never whips; `report()` checks speed and acceleration
// numerically before anything is rendered.
import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);

export class Rail {
  constructor(keys) {
    this.keys = keys.map((key) => ({ v: key.v, pos: new THREE.Vector3(...key.pos), look: new THREE.Vector3(...key.look) }));
  }

  sample(v, pos, look) {
    const keys = this.keys;
    if (v <= keys[0].v) {
      pos.copy(keys[0].pos);
      look.copy(keys[0].look);
      return;
    }
    for (let i = 0; i < keys.length - 1; i += 1) {
      const a = keys[i];
      const b = keys[i + 1];
      if (v <= b.v) {
        const t = smooth((v - a.v) / (b.v - a.v));
        pos.lerpVectors(a.pos, b.pos, t);
        look.lerpVectors(a.look, b.look, t);
        return;
      }
    }
    const last = keys[keys.length - 1];
    pos.copy(last.pos);
    look.copy(last.look);
  }

  // Max speed (units/vh), max acceleration (units/vh²) and pitch range (deg)
  // between the first and last key.
  report(step = 0.002) {
    const p = new THREE.Vector3();
    const l = new THREE.Vector3();
    const samples = [];
    for (let v = this.keys[0].v; v <= this.keys.at(-1).v; v += step) {
      this.sample(v, p, l);
      const dir = l.clone().sub(p).normalize();
      samples.push({ v, p: p.clone(), pitch: THREE.MathUtils.radToDeg(Math.asin(dir.y)) });
    }
    let maxSpeed = 0;
    let maxAccel = 0;
    let at = 0;
    for (let i = 1; i < samples.length - 1; i += 1) {
      const speed = samples[i + 1].p.distanceTo(samples[i - 1].p) / (2 * step);
      const accel = samples[i + 1].p.clone().add(samples[i - 1].p).sub(samples[i].p.clone().multiplyScalar(2)).length() / (step * step);
      if (speed > maxSpeed) maxSpeed = speed;
      if (accel > maxAccel) { maxAccel = accel; at = samples[i].v; }
    }
    const pitches = samples.map((s) => s.pitch);
    return {
      maxSpeed: +maxSpeed.toFixed(2),
      maxAccel: +maxAccel.toFixed(2),
      maxAccelAt: +at.toFixed(3),
      pitch: [+Math.min(...pitches).toFixed(1), +Math.max(...pitches).toFixed(1)],
    };
  }
}
