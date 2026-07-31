/**
 * Bastion title scene — cinematic environment engine.
 * Orchestrates scene graph, animation, parallax, lighting, weather, particles, audio, UI.
 */

import { defaultEnvironment, WEATHER_PRESETS } from './config/environment';
import { AnimationEngine } from './core/AnimationEngine';
import { ParallaxController } from './core/ParallaxController';
import { SceneGraph } from './core/SceneGraph';
import { Ticker } from './core/Ticker';
import { buildLayerContent } from './layers/buildLayers';
import { LightingSystem } from './systems/LightingSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { TorchController } from './systems/TorchController';
import { WeatherSystem } from './systems/WeatherSystem';
import {
  EnvironmentState,
  TitleSceneHandle,
  TitleSceneOptions,
} from './types';
import { mountTitleUI } from './ui/TitleUI';

const IDLE_MUSIC_MS = 10_000;

export function mountTitleScene(opts: TitleSceneOptions): TitleSceneHandle {
  const reduceMotion =
    opts.reduceMotion ??
    (document.documentElement.dataset.reduceMotion === '1' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const env: EnvironmentState = { ...defaultEnvironment() };
  const graph = new SceneGraph(opts.root);
  buildLayerContent(graph);

  const particleCanvas = graph.get('particles')!.el as HTMLCanvasElement;
  const lightCanvas = graph.get('lighting')!.el as HTMLCanvasElement;
  const weatherCanvas = graph.get('weather')!.el as HTMLCanvasElement;

  const torches = new TorchController(4);
  const particles = new ParticleSystem(particleCanvas);
  const lighting = new LightingSystem(lightCanvas, torches);
  const weather = new WeatherSystem(weatherCanvas);

  particles.setReduceMotion(reduceMotion);
  lighting.setReduceMotion(reduceMotion);
  weather.setReduceMotion(reduceMotion);
  torches.setReduceMotion(reduceMotion);
  particles.setWind(env.wind);
  particles.setScale(env.particleScale);
  lighting.setMoonDim(env.moonDim);
  lighting.setFogDensity(env.fogDensity);
  weather.apply(env);

  const anim = new AnimationEngine(graph);
  anim.setReduceMotion(reduceMotion);
  if (!reduceMotion) {
    anim.startCameraBreathe();
    anim.startCloudDrift();
    anim.startFogDrift(env.wind);
    anim.startBannerWind(env.wind);
    anim.startTreeSway();
    anim.startGrassBreath();
  }

  const parallax = new ParallaxController(graph.root, graph);
  parallax.setEnabled(!reduceMotion);
  parallax.attach();

  let gateFocus = 0;
  let idleTimer: number | null = null;
  let musicStarted = false;
  let audioReady = false;

  const armIdleMusic = () => {
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (musicStarted || !opts.audio) return;
      musicStarted = true;
      opts.audio.startMusic();
      graph.root.dataset.ambientCue = 'music';
    }, IDLE_MUSIC_MS);
  };

  const ensureAudio = async () => {
    if (!opts.audio) return;
    await opts.audio.unlock();
    if (audioReady) return;
    audioReady = true;
    opts.audio.stopMusic();
    opts.audio.startAmbient();
    armIdleMusic();
  };

  // Browser autoplay policy: unlock + ambient on first gesture
  const onFirstGesture = () => {
    void ensureAudio();
    graph.root.removeEventListener('pointerdown', onFirstGesture);
  };
  graph.root.addEventListener('pointerdown', onFirstGesture);

  const setGateFocus = (active: boolean) => {
    gateFocus = active ? 1 : 0;
    lighting.setGateFocus(gateFocus);
    anim.pulseGateFocus(active);
    graph.root.dataset.ambientCue = active ? 'gate-focus' : 'idle';
    graph.root.classList.toggle('is-gate-focus', active);
    if (active && audioReady) {
      opts.audio?.play('wood_creak', 0.55);
      armIdleMusic(); // interaction resets idle? Spec: music after 10s idle — reset on interaction
    }
  };

  const unbindUi = mountTitleUI(graph.get('ui')!.el, {
    title: opts.title ?? 'Bastion Defense',
    version: opts.version ?? '1.0.0',
    hasContinue: !!opts.hasContinue,
    hasReplay: !!opts.hasReplay,
    onAction: (action) => {
      void ensureAudio().then(() => {
        opts.audio?.play('ui_click', 0.7);
        if (action === 'new') {
          opts.audio?.play('gate_open', 1);
          graph.root.classList.add('is-entering');
          window.setTimeout(() => opts.onAction(action), 720);
          return;
        }
        opts.onAction(action);
      });
    },
    onGateHover: setGateFocus,
    onNavHover: (active) => {
      if (active && audioReady) opts.audio?.play('ui_hover', 0.5);
      if (active) armIdleMusic();
    },
  });

  // World gate hotspot — lives on the rigid fortress plate
  const hotspot = graph.get('fortress')!.el.querySelector('.ts-gate-hotspot');
  const onHotEnter = () => setGateFocus(true);
  const onHotLeave = () => setGateFocus(false);
  const onHotClick = () => {
    void ensureAudio().then(() => {
      opts.audio?.play('gate_open', 1);
      graph.root.classList.add('is-entering');
      window.setTimeout(() => opts.onAction('new'), 720);
    });
  };
  hotspot?.addEventListener('pointerenter', onHotEnter);
  hotspot?.addEventListener('pointerleave', onHotLeave);
  hotspot?.addEventListener('click', onHotClick);

  graph.root.dataset.ambient = 'bastion-grounds';
  graph.root.dataset.ambientCue = 'idle';
  graph.root.dataset.audioIdleMusic = '10s';

  const ticker = new Ticker();
  const offTick = ticker.on((dt, elapsed, fps) => {
    parallax.update(dt);
    torches.update(dt);
    torches.applyToFlames(graph.get('torches')?.el ?? null);
    particles.tuneForFps(fps);
    const w = graph.root.clientWidth;
    const h = graph.root.clientHeight;
    particles.update(dt, w, h);
    lighting.update(dt, w, h);
    weather.update(dt, w, h, graph.root);

    if (!reduceMotion) {
      const dim = env.moonDim + Math.max(0, Math.sin(elapsed * 0.05) * 0.08);
      lighting.setMoonDim(dim);
    }
  });
  ticker.start();

  const applyEnv = (partial: Partial<EnvironmentState>) => {
    Object.assign(env, partial);
    if (partial.weather && WEATHER_PRESETS[partial.weather]) {
      Object.assign(env, WEATHER_PRESETS[partial.weather]);
    }
    particles.setWind(env.wind);
    particles.setScale(env.particleScale);
    lighting.setMoonDim(env.moonDim);
    lighting.setFogDensity(env.fogDensity);
    weather.apply(env);
    graph.root.dataset.weather = env.weather;
    graph.root.style.setProperty('--fog-density', String(env.fogDensity));
    graph.root.style.setProperty('--sky-warmth', String(env.skyWarmth));
  };
  applyEnv({});

  return {
    destroy: () => {
      offTick();
      ticker.stop();
      unbindUi();
      anim.destroy();
      parallax.destroy();
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      graph.root.removeEventListener('pointerdown', onFirstGesture);
      hotspot?.removeEventListener('pointerenter', onHotEnter);
      hotspot?.removeEventListener('pointerleave', onHotLeave);
      hotspot?.removeEventListener('click', onHotClick);
      opts.audio?.stopAmbient();
      opts.audio?.stopMusic();
      graph.destroy();
    },
    setEnvironment: applyEnv,
    getFps: () => ticker.framesPerSecond,
  };
}
