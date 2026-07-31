/**
 * Interactive campaign world map — pan, zoom, click missions.
 */

import {
  CAMPAIGN,
  getMission,
  missionTypeLabel,
  WORLD_ROADS,
} from '../config/campaign';
import { BIOME_DEFS } from '../config/biomes';
import { DIFFICULTIES } from '../config/difficulty';
import {
  CampaignProgressData,
  isMissionCleared,
  isMissionUnlocked,
} from '../systems/campaignProgress';

export interface WorldMapCallbacks {
  onSelectMission: (missionId: string) => void;
  onBack: () => void;
  onSkirmish: () => void;
}

const WORLD_W = 1000;
const WORLD_H = 700;

export function mountWorldMap(
  root: HTMLElement,
  progress: CampaignProgressData,
  cb: WorldMapCallbacks,
): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'world-map-screen';
  wrap.innerHTML = `
    <div class="world-map-chrome">
      <div class="world-map-title">
        <p class="brand-tag">Campaign</p>
        <h2>${CAMPAIGN.name}</h2>
        <p class="muted">${CAMPAIGN.description}</p>
      </div>
      <div class="world-map-actions">
        <button class="btn" data-act="skirmish">Skirmish</button>
        <button class="btn" data-act="back">Back</button>
      </div>
    </div>
    <div class="world-map-stage" id="wm-stage">
      <canvas id="wm-canvas" width="1000" height="700"></canvas>
      <div class="world-map-hint muted">Drag to pan · Scroll to zoom · Click a mission</div>
    </div>
    <aside class="world-map-detail hidden" id="wm-detail"></aside>
  `;
  root.appendChild(wrap);

  const canvas = wrap.querySelector('#wm-canvas') as HTMLCanvasElement;
  const detail = wrap.querySelector('#wm-detail') as HTMLElement;
  const ctx = canvas.getContext('2d')!;

  let camX = 0;
  let camY = 0;
  let zoom = 1;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let hoverId: string | null = null;
  let selectedId: string | null = progress.currentMissionId;
  let animT = 0;
  let raf = 0;

  const fit = () => {
    const stage = wrap.querySelector('#wm-stage') as HTMLElement;
    const w = Math.max(320, stage.clientWidth - 16);
    const h = Math.max(280, Math.min(560, stage.clientHeight - 28));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Center on current mission
    const cur = getMission(progress.currentMissionId);
    if (cur) {
      camX = cur.mapX - w / (2 * zoom);
      camY = cur.mapY - h / (2 * zoom);
    }
  };
  fit();

  const worldFromScreen = (sx: number, sy: number) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (sx - rect.left) / zoom + camX,
      y: (sy - rect.top) / zoom + camY,
    };
  };

  const hitMission = (wx: number, wy: number): string | null => {
    let best: string | null = null;
    let bestD = 28 * 28;
    for (const m of CAMPAIGN.missions) {
      const d = (m.mapX - wx) ** 2 + (m.mapY - wy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = m.id;
      }
    }
    return best;
  };

  const featureColor = (f: string, locked: boolean): string => {
    if (locked) return '#2a2e28';
    switch (f) {
      case 'bastion':
        return '#c4a050';
      case 'village':
        return '#8ec070';
      case 'road':
        return '#a09070';
      case 'forest':
        return '#3a6a3a';
      case 'mountain':
        return '#7a7a70';
      case 'river':
        return '#4a8a9a';
      case 'enemy':
        return '#c05040';
      default:
        return '#888';
    }
  };

  const draw = () => {
    animT += 0.016;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Atmosphere
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a241c');
    g.addColorStop(0.45, '#243028');
    g.addColorStop(1, '#1c2820');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(
      (canvas.width / w) * zoom,
      (canvas.height / h) * zoom,
    );
    ctx.translate(-camX, -camY);

    // Soft terrain blobs by region biome
    for (const r of CAMPAIGN.regions) {
      const biome = BIOME_DEFS[r.biomeId];
      ctx.fillStyle = biome.terrainTint + '55';
      ctx.beginPath();
      ctx.ellipse(r.labelX, r.labelY, 140, 90, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,210,180,0.35)';
      ctx.font = '14px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.name, r.labelX, r.labelY - 70);
    }

    // Roads
    for (const [a, b] of WORLD_ROADS) {
      const ma = getMission(a)!;
      const mb = getMission(b)!;
      const unlocked =
        isMissionUnlocked(progress, a) || isMissionUnlocked(progress, b);
      ctx.strokeStyle = unlocked ? 'rgba(180,160,120,0.55)' : 'rgba(60,60,50,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ma.mapX, ma.mapY);
      ctx.lineTo(mb.mapX, mb.mapY);
      ctx.stroke();
    }

    // Decorative features
    drawDecor(ctx);

    // Mission nodes
    for (const m of CAMPAIGN.missions) {
      const unlocked = isMissionUnlocked(progress, m.id);
      const cleared = isMissionCleared(progress, m.id);
      const current = progress.currentMissionId === m.id && !cleared;
      const selected = selectedId === m.id;
      const hover = hoverId === m.id;

      ctx.save();
      ctx.translate(m.mapX, m.mapY);

      if (!unlocked) {
        ctx.globalAlpha = 0.35;
      }

      // Pulse for current
      if (current) {
        const pulse = 18 + Math.sin(animT * 4) * 4;
        ctx.strokeStyle = 'rgba(240,200,100,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = featureColor(m.feature, !unlocked);
      ctx.beginPath();
      ctx.arc(0, 0, cleared || selected || hover ? 14 : 11, 0, Math.PI * 2);
      ctx.fill();

      if (cleared) {
        ctx.strokeStyle = '#d4a050';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (selected || hover) {
        ctx.strokeStyle = '#fff0c0';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (unlocked) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.fillStyle = unlocked ? '#f0e8d0' : '#666';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, 0, 28);
      ctx.restore();
    }

    ctx.restore();
    raf = requestAnimationFrame(draw);
  };

  const showDetail = (id: string) => {
    const m = getMission(id);
    if (!m) return;
    selectedId = id;
    const unlocked = isMissionUnlocked(progress, id);
    const cleared = isMissionCleared(progress, id);
    const biome = BIOME_DEFS[m.biomeId];
    const clear = progress.cleared[id];
    detail.classList.remove('hidden');
    detail.innerHTML = `
      <p class="brand-tag">${missionTypeLabel(m.type)}</p>
      <h3>${m.name}</h3>
      <p class="muted">${m.description}</p>
      <ul class="brief-stats">
        <li><span>Biome</span><strong>${biome.name}</strong></li>
        <li><span>Recommended</span><strong>Power ${m.recommendedPower}</strong></li>
        <li><span>Suggested Diff</span><strong>${DIFFICULTIES[m.difficulty].name}</strong></li>
        <li><span>Waves</span><strong>${m.waveGoal}</strong></li>
        <li><span>Status</span><strong>${cleared ? 'Cleared' : unlocked ? 'Available' : 'Locked'}</strong></li>
      </ul>
      ${
        clear
          ? `<p class="muted">Best: W${clear.bestWave} · ${DIFFICULTIES[clear.difficulty].name} · ${clear.score}</p>`
          : ''
      }
      <p class="world-map-rewards">Rewards: ${m.rewards.gold}g · ${m.rewards.researchPoints} RP</p>
      <button class="btn primary" data-deploy ${unlocked ? '' : 'disabled'}>
        ${unlocked ? 'Deploy' : 'Locked'}
      </button>
    `;
    detail.querySelector('[data-deploy]')?.addEventListener('click', () => {
      if (unlocked) cb.onSelectMission(id);
    });
  };

  if (selectedId) showDetail(selectedId);

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const wpos = worldFromScreen(e.clientX, e.clientY);
    hoverId = hitMission(wpos.x, wpos.y);
    canvas.style.cursor = hoverId ? 'pointer' : dragging ? 'grabbing' : 'grab';
    if (!dragging) return;
    const dx = (e.clientX - lastX) / zoom;
    const dy = (e.clientY - lastY) / zoom;
    lastX = e.clientX;
    lastY = e.clientY;
    camX = Math.max(-80, Math.min(WORLD_W - 100, camX - dx));
    camY = Math.max(-80, Math.min(WORLD_H - 100, camY - dy));
  };
  const onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    dragging = false;
    if (moved > 6) return;
    const wpos = worldFromScreen(e.clientX, e.clientY);
    const id = hitMission(wpos.x, wpos.y);
    if (id) showDetail(id);
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const before = worldFromScreen(e.clientX, e.clientY);
    zoom = Math.max(0.55, Math.min(1.8, zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    const after = worldFromScreen(e.clientX, e.clientY);
    camX += before.x - after.x;
    camY += before.y - after.y;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  wrap.querySelector('[data-act="back"]')!.addEventListener('click', () => cb.onBack());
  wrap.querySelector('[data-act="skirmish"]')!.addEventListener('click', () => cb.onSkirmish());
  window.addEventListener('resize', fit);

  raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', fit);
    wrap.remove();
  };
}

function drawDecor(ctx: CanvasRenderingContext2D): void {
  // Rivers
  ctx.strokeStyle = 'rgba(70,130,150,0.35)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(400, 100);
  ctx.quadraticCurveTo(500, 400, 420, 680);
  ctx.stroke();
  // Mountains ticks
  ctx.fillStyle = 'rgba(100,100,90,0.25)';
  for (const [x, y] of [
    [680, 160],
    [740, 140],
    [800, 180],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y + 20);
    ctx.lineTo(x + 18, y - 10);
    ctx.lineTo(x + 36, y + 20);
    ctx.fill();
  }
}
