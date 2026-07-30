/** Lightweight frame profiler for FPS / update / render budgets. */

export interface ProfilerSample {
  fps: number;
  updateMs: number;
  renderMs: number;
  enemies: number;
  towers: number;
  particles: number;
}

export class Profiler {
  enabled = false;
  private frames: number[] = [];
  private updateMs = 0;
  private renderMs = 0;
  private lastSample: ProfilerSample = {
    fps: 60,
    updateMs: 0,
    renderMs: 0,
    enemies: 0,
    towers: 0,
    particles: 0,
  };
  private lowFpsStreak = 0;

  beginUpdate(): number {
    return performance.now();
  }

  endUpdate(t0: number): void {
    this.updateMs = performance.now() - t0;
  }

  beginRender(): number {
    return performance.now();
  }

  endRender(t0: number): void {
    this.renderMs = performance.now() - t0;
  }

  frame(
    dt: number,
    counts: { enemies: number; towers: number; particles: number },
  ): ProfilerSample {
    if (dt > 0) this.frames.push(1 / dt);
    if (this.frames.length > 90) this.frames.shift();
    const fps =
      this.frames.length === 0
        ? 60
        : this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.lastSample = {
      fps: Math.round(fps),
      updateMs: Math.round(this.updateMs * 100) / 100,
      renderMs: Math.round(this.renderMs * 100) / 100,
      ...counts,
    };
    if (fps < 28) this.lowFpsStreak++;
    else this.lowFpsStreak = Math.max(0, this.lowFpsStreak - 2);
    return this.lastSample;
  }

  /** True when we should suggest dropping graphics quality. */
  shouldAutoLowerQuality(): boolean {
    return this.lowFpsStreak > 120;
  }

  get sample(): ProfilerSample {
    return this.lastSample;
  }
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

/** Particle / VFX density multiplier by preset. */
export function qualityParticleScale(q: GraphicsQuality): number {
  switch (q) {
    case 'low':
      return 0.35;
    case 'medium':
      return 0.7;
    default:
      return 1;
  }
}
