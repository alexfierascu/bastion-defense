import { LAYER_DEFS } from '../config/environment';
import { LayerId } from '../types';
import { Layer } from './Layer';

const CANVAS_LAYERS = new Set<LayerId>(['particles', 'lighting', 'weather']);

/**
 * Owns the DOM tree of independent layers.
 * Decorative overlays (banners, torches) may nest under fortress to share its transform.
 */
export class SceneGraph {
  readonly root: HTMLElement;
  readonly stage: HTMLElement;
  private layers = new Map<LayerId, Layer>();

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'title-scene';
    this.root.dataset.ambient = 'bastion-grounds';

    this.stage = document.createElement('div');
    this.stage.className = 'ts-stage';
    this.root.appendChild(this.stage);

    // Parents first so children can mount into them
    const ordered = [...LAYER_DEFS].sort((a, b) => {
      if (a.parent === b.id) return 1;
      if (b.parent === a.id) return -1;
      return a.z - b.z;
    });

    for (const def of ordered) {
      const el = document.createElement(CANVAS_LAYERS.has(def.id) ? 'canvas' : 'div');
      el.className = 'ts-layer';
      if (el instanceof HTMLCanvasElement) {
        el.setAttribute('aria-hidden', 'true');
      }
      const parentEl = def.parent ? this.layers.get(def.parent)?.el : undefined;
      (parentEl ?? this.stage).appendChild(el);
      this.layers.set(def.id, new Layer(def, el));
    }

    host.appendChild(this.root);
  }

  get(id: LayerId): Layer | undefined {
    return this.layers.get(id);
  }

  each(fn: (layer: Layer) => void): void {
    for (const layer of this.layers.values()) fn(layer);
  }

  destroy(): void {
    this.root.remove();
    this.layers.clear();
  }
}
