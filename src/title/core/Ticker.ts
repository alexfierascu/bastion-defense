/**
 * Master clock: rAF, FPS sampling, tab visibility pause.
 * docs/10-PERFORMANCE.md
 */

export type TickFn = (dt: number, elapsed: number, fps: number) => void;

export class Ticker {
  private running = false;
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private frames = 0;
  private fpsAcc = 0;
  private fps = 60;
  private listeners = new Set<TickFn>();
  private onVis?: () => void;

  get framesPerSecond(): number {
    return this.fps;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.onVis = () => {
      if (document.hidden) this.last = performance.now();
    };
    document.addEventListener('visibilitychange', this.onVis);
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden) {
        this.last = now;
        return;
      }
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05; // clamp hitch
      this.elapsed += dt;
      this.frames++;
      this.fpsAcc += dt;
      if (this.fpsAcc >= 0.5) {
        this.fps = Math.round(this.frames / this.fpsAcc);
        this.frames = 0;
        this.fpsAcc = 0;
      }
      for (const fn of this.listeners) fn(dt, this.elapsed, this.fps);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.onVis) document.removeEventListener('visibilitychange', this.onVis);
  }

  on(fn: TickFn): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
