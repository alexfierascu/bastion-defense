/**
 * Populate each layer's visual content.
 * Fortress stone is a single rigid plate — never sliced for parallax.
 */

import { SceneGraph } from '../core/SceneGraph';

const HERO = '/assets/landing/bastion-hero.png';

export function buildLayerContent(graph: SceneGraph): void {
  graph.get('sky')!.el.innerHTML =
    `<div class="ts-sky-gradient"></div><div class="ts-stars" aria-hidden="true"></div>`;

  graph.get('moon')!.el.innerHTML =
    `<div class="ts-moon-disc" aria-hidden="true"></div>`;

  graph.get('cloudsFar')!.el.innerHTML =
    `<div class="ts-motion">${cloudBand(5, 'far')}</div>`;
  graph.get('cloudsNear')!.el.innerHTML =
    `<div class="ts-motion">${cloudBand(4, 'near')}</div>`;

  // Canopy sway only (tree leaves may move; stone does not)
  graph.get('tree')!.el.innerHTML = `
    <div class="ts-motion">
      <div class="ts-plate ts-plate-tree" style="background-image:url('${HERO}')" aria-hidden="true"></div>
    </div>`;

  // One rigid fortress plate + gate hotspot (hotspot rides the same transform)
  graph.get('fortress')!.el.insertAdjacentHTML(
    'afterbegin',
    `<div class="ts-plate ts-plate-castle" style="background-image:url('${HERO}')" role="img" aria-label="The Bastion"></div>
     <button type="button" class="ts-gate-hotspot" data-action="new" data-ambient="gate" aria-label="Enter the Bastion"></button>`,
  );

  // Banner cloth — local GSAP skew only; no mouse parallax
  graph.get('banners')!.el.innerHTML = `
    <div class="ts-banner ts-banner-l" aria-hidden="true"></div>
    <div class="ts-banner ts-banner-r" aria-hidden="true"></div>`;

  // Torch flames above the stone; inherit fortress transform
  graph.get('torches')!.el.innerHTML = `
    <span class="ts-flame" data-torch="0" style="--fx:38.5%;--fy:50%"></span>
    <span class="ts-flame" data-torch="1" style="--fx:61.5%;--fy:50%"></span>
    <span class="ts-flame" data-torch="2" style="--fx:50%;--fy:78%"></span>
    <span class="ts-flame" data-torch="3" style="--fx:86%;--fy:74%"></span>`;

  graph.get('ground')!.el.innerHTML =
    `<div class="ts-ground-reflect" aria-hidden="true"></div>`;

  graph.get('grass')!.el.innerHTML = grassBlades();

  for (const id of ['fog1', 'fog2', 'fog3'] as const) {
    graph.get(id)!.el.innerHTML =
      `<div class="ts-motion"><div class="ts-fog-plate" aria-hidden="true"></div></div>`;
  }
}

function cloudBand(n: number, kind: string): string {
  return Array.from({ length: n }, (_, i) => {
    const left = 5 + i * (90 / n);
    const top = kind === 'far' ? 8 + (i % 3) * 6 : 14 + (i % 2) * 8;
    const w = kind === 'far' ? 18 + (i % 3) * 6 : 14 + (i % 3) * 5;
    return `<span class="ts-cloud" style="left:${left}%;top:${top}%;width:${w}%"></span>`;
  }).join('');
}

function grassBlades(): string {
  const blades = Array.from({ length: 28 }, (_, i) => {
    const left = (i / 28) * 100 + (i % 3) * 0.4;
    const h = 18 + (i % 5) * 6;
    const delay = (i % 7) * 0.35;
    return `<span class="ts-blade" style="left:${left}%;height:${h}px;animation-delay:${delay}s"></span>`;
  }).join('');
  return `<div class="ts-grass-band" aria-hidden="true">${blades}</div>`;
}
