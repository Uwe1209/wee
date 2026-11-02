// Native scroll sets the target; a damped value follows it. The DOM is
// translated by that value and every scene reads the same one.
import { damp } from './timeline.js';

export class SmoothScroll {
  constructor({ content, space, reduced = false }) {
    this.content = content;
    this.space = space;
    this.reduced = reduced;
    this.target = window.scrollY;
    this.current = this.target;
    this.velocity = 0;
    this.lambda = matchMedia('(pointer: coarse)').matches ? 16 : 7.5;
    this.exact = null;
    window.addEventListener('scroll', () => {
      if (this.exact !== null && Math.abs(window.scrollY - this.exact) < 1) return;
      this.exact = null;
      this.target = window.scrollY;
    }, { passive: true });
  }

  setLength(px) {
    this.space.style.height = `${Math.round(px)}px`;
  }

  // Sets an exact fractional target (capture tools, deep links).
  setTarget(px, { instant = false } = {}) {
    this.exact = px;
    this.target = px;
    window.scrollTo(0, px);
    if (instant) this.current = px;
  }

  update(dt) {
    const previous = this.current;
    if (this.reduced) this.current = this.target;
    else {
      this.current = damp(this.current, this.target, this.lambda, dt);
      if (Math.abs(this.current - this.target) < 0.05) this.current = this.target;
    }
    this.velocity = dt > 0 ? (this.current - previous) / dt : 0;
    this.content.style.transform = `translate3d(0, ${-this.current}px, 0)`;
    return this.current;
  }
}
