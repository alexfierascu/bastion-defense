/**
 * Independent randomized torch flicker (docs/04-ANIMATION_SYSTEM.md).
 * Drives flame sprites + LightingSystem from one clock.
 */

import { TorchState } from '../types';

interface TorchSim {
  brightness: number;
  radius: number;
  intensity: number;
  flame: number;
  tBright: number;
  tRadius: number;
  tIntensity: number;
  tFlame: number;
  speedB: number;
  speedR: number;
  speedI: number;
  speedF: number;
}

export class TorchController {
  private torches: TorchSim[] = [];
  private reduceMotion = false;

  constructor(count = 4) {
    for (let i = 0; i < count; i++) {
      this.torches.push({
        brightness: 1,
        radius: 1,
        intensity: 1,
        flame: 1,
        tBright: Math.random() * 10,
        tRadius: Math.random() * 10,
        tIntensity: Math.random() * 10,
        tFlame: Math.random() * 10,
        speedB: 2.1 + Math.random() * 2.4,
        speedR: 1.4 + Math.random() * 1.8,
        speedI: 1.8 + Math.random() * 2.2,
        speedF: 3.2 + Math.random() * 3.5,
      });
    }
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
  }

  update(dt: number): void {
    for (const t of this.torches) {
      if (this.reduceMotion) {
        t.brightness = 1;
        t.radius = 1;
        t.intensity = 1;
        t.flame = 1;
        continue;
      }
      t.tBright += dt * t.speedB;
      t.tRadius += dt * t.speedR;
      t.tIntensity += dt * t.speedI;
      t.tFlame += dt * t.speedF;

      // Layered sines + rare micro-spikes → organic, non-mechanical
      const spike = Math.random() < 0.012 * dt * 60 ? 0.12 : 0;
      t.brightness =
        0.82 +
        0.12 * Math.sin(t.tBright) +
        0.06 * Math.sin(t.tBright * 2.7) +
        spike;
      t.radius =
        0.88 + 0.1 * Math.sin(t.tRadius * 0.9) + 0.05 * Math.sin(t.tRadius * 3.1);
      t.intensity =
        0.8 +
        0.14 * Math.sin(t.tIntensity * 1.1) +
        0.08 * Math.sin(t.tIntensity * 4.2);
      t.flame =
        0.75 + 0.2 * Math.sin(t.tFlame) + 0.1 * Math.sin(t.tFlame * 2.3);
    }
  }

  get(i: number): TorchState {
    const t = this.torches[i] ?? this.torches[0]!;
    return {
      brightness: t.brightness,
      radius: t.radius,
      intensity: t.intensity,
      flame: t.flame,
    };
  }

  count(): number {
    return this.torches.length;
  }

  /** Apply CSS vars to flame sprite elements. */
  applyToFlames(host: HTMLElement | null): void {
    if (!host) return;
    const flames = host.querySelectorAll<HTMLElement>('.ts-flame');
    flames.forEach((el, i) => {
      const s = this.get(i);
      el.style.setProperty('--flame', String(s.flame));
      el.style.setProperty('--fbright', String(s.brightness));
      el.style.opacity = String(0.35 + 0.35 * s.brightness);
      el.style.transform = `scaleY(${0.9 + 0.25 * s.flame}) scaleX(${0.95 + 0.1 * (1 - s.flame)})`;
    });
  }
}
