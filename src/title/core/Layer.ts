import { LayerDef, Vec2 } from '../types';

/** A single scene-graph node with GPU-friendly transform state. */
export class Layer {
  readonly def: LayerDef;
  readonly el: HTMLElement;
  private offset: Vec2 = { x: 0, y: 0 };
  private parallaxOffset: Vec2 = { x: 0, y: 0 };
  private scale = 1;
  private opacity = 1;

  constructor(def: LayerDef, el: HTMLElement) {
    this.def = def;
    this.el = el;
    el.dataset.layer = def.id;
    el.style.zIndex = String(def.z);
    // Nested fortress children need a positioning context
    if (def.parent) el.style.position = 'absolute';
    if (def.className) el.classList.add(...def.className.split(/\s+/));
  }

  setOffset(x: number, y: number): void {
    this.offset.x = x;
    this.offset.y = y;
    this.apply();
  }

  setParallax(x: number, y: number): void {
    this.parallaxOffset.x = x;
    this.parallaxOffset.y = y;
    this.apply();
  }

  setScale(s: number): void {
    this.scale = s;
    this.apply();
  }

  setOpacity(o: number): void {
    this.opacity = o;
    this.el.style.opacity = String(o);
  }

  private apply(): void {
    const x = this.offset.x + this.parallaxOffset.x;
    const y = this.offset.y + this.parallaxOffset.y;
    this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${this.scale})`;
  }
}
