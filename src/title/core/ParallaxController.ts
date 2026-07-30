import { LAYER_DEFS } from '../config/environment';
import { LayerId } from '../types';
import { SceneGraph } from './SceneGraph';

/**
 * Smooth mouse parallax using absolute amplitudes from docs/05-PARALLAX.md.
 * Nested fortress children use relative offsets so parent + child = target amp.
 */
export class ParallaxController {
  private targetX = 0;
  private targetY = 0;
  private curX = 0;
  private curY = 0;
  private enabled = true;
  private onMove?: (e: PointerEvent) => void;
  private readonly parentOf = new Map<LayerId, LayerId | undefined>();

  constructor(
    private readonly host: HTMLElement,
    private readonly graph: SceneGraph,
  ) {
    for (const def of LAYER_DEFS) {
      this.parentOf.set(def.id, def.parent);
    }
  }

  attach(): void {
    this.onMove = (e: PointerEvent) => {
      if (!this.enabled) return;
      const r = this.host.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      this.targetX = Math.max(-1, Math.min(1, nx));
      this.targetY = Math.max(-1, Math.min(1, ny));
    };
    this.host.addEventListener('pointermove', this.onMove);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.targetX = 0;
      this.targetY = 0;
    }
  }

  update(dt: number): void {
    const ease = 1 - Math.exp(-dt * 4.5);
    this.curX += (this.targetX - this.curX) * ease;
    this.curY += (this.targetY - this.curY) * ease;

    this.graph.each((layer) => {
      if (layer.def.parallax <= 0) {
        layer.setParallax(0, 0);
        return;
      }
      const parentId = this.parentOf.get(layer.def.id);
      const parentAmp = parentId
        ? (this.graph.get(parentId)?.def.parallax ?? 0)
        : 0;
      // Nested: only the delta so world-space amp matches the layer def
      const amp = layer.def.parallax - parentAmp;
      layer.setParallax(this.curX * amp, this.curY * amp * 0.65);
    });
  }

  destroy(): void {
    if (this.onMove) this.host.removeEventListener('pointermove', this.onMove);
  }
}
