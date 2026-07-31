/**
 * Internal playtest tools — compiled out of behavior when not DEV.
 * Never show UI or hotkeys in production builds.
 */

import { EnemyType } from '../config/enemies';

export const IS_DEV = import.meta.env.DEV === true;

export interface PlaytestApi {
  addGold: (amount: number) => void;
  setGodMode: (on: boolean) => void;
  spawnEnemy: (type: EnemyType) => void;
  spawnBoss: () => void;
  skipWave: () => void;
  clearEnemies: () => void;
  toggleDamageViz: () => void;
  toggleProfiler: () => void;
  stressSpawn: (count: number) => void;
  getState: () => {
    gold: number;
    wave: number;
    enemies: number;
    towers: number;
    fps: number;
    godMode: boolean;
    damageViz: boolean;
    profiler: boolean;
  };
}

export class PlaytestController {
  open = false;
  godMode = false;
  damageViz = false;
  private api: PlaytestApi | null = null;
  private root: HTMLElement | null = null;
  private fpsHistory: number[] = [];
  private raf = 0;

  bind(api: PlaytestApi): void {
    if (!IS_DEV) return;
    this.api = api;
  }

  toggle(): void {
    if (!IS_DEV) return;
    this.open = !this.open;
    if (this.open) this.mount();
    else this.unmount();
  }

  /** Call from game leak path. */
  blocksLeakDamage(): boolean {
    return IS_DEV && this.godMode;
  }

  private mount(): void {
    if (!IS_DEV || this.root || !this.api) return;
    const el = document.createElement('div');
    el.className = 'dev-playtest';
    el.innerHTML = `
      <header>
        <strong>Playtest</strong>
        <span>DEV ONLY</span>
        <button type="button" data-act="close" title="Close (F8)">×</button>
      </header>
      <canvas class="dev-fps" width="236" height="40" aria-label="FPS graph"></canvas>
      <div class="dev-grid">
        <button type="button" data-act="gold">+1000g</button>
        <button type="button" data-act="god">God Mode</button>
        <button type="button" data-act="dmg">Dmg Numbers</button>
        <button type="button" data-act="prof">Profiler</button>
        <button type="button" data-act="skip">Skip Wave</button>
        <button type="button" data-act="clear">Clear Enemies</button>
        <button type="button" data-act="boss">Spawn Boss</button>
        <button type="button" data-act="stress">+100 Enemies</button>
        <button type="button" data-act="raider">Spawn Raider</button>
        <button type="button" data-act="scout">Spawn Scout</button>
        <button type="button" data-act="brute">Spawn Brute</button>
        <button type="button" data-act="siege">Spawn Siege</button>
      </div>
      <p class="dev-status" data-status></p>
    `;
    document.body.appendChild(el);
    this.root = el;
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!btn || !this.api) return;
      const act = btn.dataset.act!;
      switch (act) {
        case 'close':
          this.toggle();
          break;
        case 'gold':
          this.api.addGold(1000);
          break;
        case 'god':
          this.godMode = !this.godMode;
          this.api.setGodMode(this.godMode);
          break;
        case 'dmg':
          this.damageViz = !this.damageViz;
          this.api.toggleDamageViz();
          break;
        case 'prof':
          this.api.toggleProfiler();
          break;
        case 'skip':
          this.api.skipWave();
          break;
        case 'clear':
          this.api.clearEnemies();
          break;
        case 'boss':
          this.api.spawnBoss();
          break;
        case 'stress':
          this.api.stressSpawn(100);
          break;
        case 'raider':
          this.api.spawnEnemy('raider');
          break;
        case 'scout':
          this.api.spawnEnemy('scout');
          break;
        case 'brute':
          this.api.spawnEnemy('brute');
          break;
        case 'siege':
          this.api.spawnEnemy('siege');
          break;
        default:
          break;
      }
      this.refreshStatus();
    });
    this.refreshStatus();
    const tick = () => {
      this.refreshStatus();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private refreshStatus(): void {
    if (!this.root || !this.api) return;
    const s = this.api.getState();
    this.fpsHistory.push(s.fps);
    if (this.fpsHistory.length > 60) this.fpsHistory.shift();
    const status = this.root.querySelector('[data-status]');
    if (status) {
      status.textContent = `W${s.wave} · ${s.gold}g · E${s.enemies} T${s.towers} · ${s.fps}fps · god=${s.godMode ? 'ON' : 'off'}`;
    }
    this.root.querySelector('[data-act="god"]')?.classList.toggle('on', this.godMode);
    this.root.querySelector('[data-act="dmg"]')?.classList.toggle('on', this.damageViz);
    this.root.querySelector('[data-act="prof"]')?.classList.toggle('on', s.profiler);
    this.drawFpsGraph();
  }

  private drawFpsGraph(): void {
    const canvas = this.root?.querySelector('.dev-fps') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#121814';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a4538';
    ctx.beginPath();
    const y60 = h - (60 / 120) * (h - 4) - 2;
    const y30 = h - (30 / 120) * (h - 4) - 2;
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.moveTo(0, y30);
    ctx.lineTo(w, y30);
    ctx.stroke();
    if (this.fpsHistory.length < 2) return;
    ctx.strokeStyle = '#c4a070';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.fpsHistory.forEach((fps, i) => {
      const x = (i / (this.fpsHistory.length - 1)) * (w - 2) + 1;
      const y = h - (Math.min(120, fps) / 120) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  private unmount(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.root?.remove();
    this.root = null;
  }

  destroy(): void {
    this.unmount();
    this.api = null;
  }
}
