import gsap from 'gsap';
import { SceneGraph } from './SceneGraph';

/**
 * Ambient animation director — slow, non-mechanical (docs/04-ANIMATION_SYSTEM.md).
 * Animates `.ts-motion` / child plates — never the Layer root (parallax owns that).
 */
export class AnimationEngine {
  private timelines: gsap.core.Timeline[] = [];
  private reduceMotion = false;

  constructor(private readonly graph: SceneGraph) {}

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
    if (on) this.killAll();
  }

  /** Camera breathe 100% → 100.5% over ~30s */
  startCameraBreathe(): void {
    if (this.reduceMotion) return;
    const stage = this.graph.stage;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(stage, {
      scale: 1.005,
      duration: 30,
      ease: 'sine.inOut',
      transformOrigin: '50% 55%',
    });
    this.timelines.push(tl);
  }

  startCloudDrift(): void {
    if (this.reduceMotion) return;
    const far = this.graph.get('cloudsFar')?.el.querySelector('.ts-motion');
    const near = this.graph.get('cloudsNear')?.el.querySelector('.ts-motion');
    if (far) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(far, { x: 40, duration: 180, ease: 'none' }).to(far, {
        x: 0,
        duration: 180,
        ease: 'none',
      });
      this.timelines.push(tl);
    }
    if (near) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(near, { x: -55, duration: 120, ease: 'none' }).to(near, {
        x: 0,
        duration: 120,
        ease: 'none',
      });
      this.timelines.push(tl);
    }
  }

  startFogDrift(wind: number): void {
    if (this.reduceMotion) return;
    const speeds = [90, 60, 45];
    (['fog1', 'fog2', 'fog3'] as const).forEach((id, i) => {
      const el = this.graph.get(id)?.el.querySelector('.ts-motion');
      if (!el) return;
      const dist = 30 + i * 18;
      const dur = (speeds[i]! / Math.max(0.2, wind)) * (0.9 + i * 0.15);
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(el, {
        x: dist * (i % 2 === 0 ? 1 : -1),
        duration: dur,
        ease: 'sine.inOut',
      });
      this.timelines.push(tl);
    });
  }

  startBannerWind(wind: number): void {
    if (this.reduceMotion) return;
    const banners = this.graph.get('banners')?.el.querySelectorAll('.ts-banner');
    banners?.forEach((b, i) => {
      const loop = () => {
        if (this.reduceMotion) return;
        const skew = 2 + wind * 3 + Math.random() * 2;
        const dur = 2.4 + Math.random() * 1.6;
        gsap.to(b, {
          skewX: (i % 2 === 0 ? 1 : -1) * skew,
          duration: dur,
          ease: 'sine.inOut',
          onComplete: () => {
            // Randomized gust
            if (Math.random() < 0.35) {
              gsap.to(b, {
                skewX: (i % 2 === 0 ? 1 : -1) * (6 + wind * 5 + Math.random() * 3),
                duration: 0.45 + Math.random() * 0.3,
                ease: 'power1.out',
                yoyo: true,
                repeat: 1,
                onComplete: loop,
              });
            } else {
              loop();
            }
          },
        });
      };
      loop();
    });
  }

  /** Tree sway max 2px — moves the clipped canopy plate */
  startTreeSway(): void {
    if (this.reduceMotion) return;
    const el = this.graph.get('tree')?.el.querySelector('.ts-motion');
    if (!el) return;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(el, { x: 2, duration: 7, ease: 'sine.inOut' });
    this.timelines.push(tl);
  }

  /** Soft grass breath on foreground blades */
  startGrassBreath(): void {
    if (this.reduceMotion) return;
    const band = this.graph.get('grass')?.el.querySelector('.ts-grass-band');
    if (!band) return;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(band, { x: 3, duration: 5.5, ease: 'sine.inOut' });
    this.timelines.push(tl);
  }

  /** Gate hover: soft camera push */
  pulseGateFocus(active: boolean): void {
    if (this.reduceMotion) return;
    const stage = this.graph.stage;
    gsap.to(stage, {
      scale: active ? 1.012 : 1.005,
      duration: 0.8,
      ease: 'sine.out',
      transformOrigin: '50% 60%',
      overwrite: 'auto',
    });
  }

  killAll(): void {
    for (const tl of this.timelines) tl.kill();
    this.timelines = [];
    gsap.killTweensOf(this.graph.stage);
    const banners = this.graph.get('banners')?.el.querySelectorAll('.ts-banner');
    banners?.forEach((b) => gsap.killTweensOf(b));
  }

  destroy(): void {
    this.killAll();
  }
}
