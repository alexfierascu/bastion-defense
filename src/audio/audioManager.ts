/**
 * Audio: prefers real files from /assets/sounds/, falls back to procedural Web Audio.
 * Keep the same play(id) API for the rest of the game.
 * Title ambient bed + delayed music: docs/08-AUDIO.md
 */

import { loadSoundPack } from './soundPack';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicNote = 0;
  private unlocked = false;
  private buffers = new Map<string, AudioBuffer>();
  private packLoaded = false;
  /** How many real files were loaded (for UI/debug). */
  packFileCount = 0;

  private ambientNodes: AudioScheduledSourceNode[] = [];
  private ambientTimers: number[] = [];
  private titleAmbientOn = false;
  private gameplayAmbientOn = false;
  private gameplayMusicDesired = false;
  private bossMusicOn = false;
  private duckUntil = 0;

  masterVolume = 0.7;
  musicVolume = 0.35;
  sfxVolume = 0.7;
  musicEnabled = true;
  sfxEnabled = true;

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.ambientGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.ambientGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.unlocked = true;
    void this.loadPack();
    // Do not auto-start music — title waits 10s idle (docs/08)
  }

  private async loadPack(): Promise<void> {
    if (!this.ctx || this.packLoaded) return;
    this.packLoaded = true;
    try {
      const pack = await loadSoundPack(this.ctx);
      this.buffers = pack;
      this.packFileCount = pack.size;
      if (this.musicEnabled && this.gameplayMusicDesired && pack.has('music_loop')) {
        this.stopMusic();
        this.startMusic();
      }
    } catch {
      /* procedural fallback — silent */
    }
  }

  applyVolumes(): void {
    if (!this.master || !this.musicGain || !this.sfxGain || !this.ambientGain) return;
    const ducked = performance.now() < this.duckUntil;
    const duckMul = ducked ? 0.35 : 1;
    this.master.gain.value = this.masterVolume;
    this.musicGain.gain.value = (this.musicEnabled ? this.musicVolume : 0) * duckMul;
    this.sfxGain.gain.value = this.sfxEnabled ? this.sfxVolume : 0;
    const ambBase = this.gameplayAmbientOn ? 0.42 : this.titleAmbientOn ? 0.55 : 0;
    this.ambientGain.gain.value = this.sfxEnabled ? ambBase * duckMul : 0;
  }

  /** Softly lower music/ambient during banners and gate hits. */
  duck(amount = 0.4, durationSec = 0.8): void {
    this.duckUntil = performance.now() + durationSec * 1000;
    if (!this.musicGain || !this.ambientGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const mTarget = (this.musicEnabled ? this.musicVolume : 0) * (1 - amount);
    const aBase = this.gameplayAmbientOn ? 0.42 : this.titleAmbientOn ? 0.55 : 0;
    const aTarget = (this.sfxEnabled ? aBase : 0) * (1 - amount);
    this.musicGain.gain.cancelScheduledValues(now);
    this.ambientGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(mTarget, now, 0.05);
    this.ambientGain.gain.setTargetAtTime(aTarget, now, 0.05);
    window.setTimeout(() => this.applyVolumes(), durationSec * 1000 + 40);
  }

  setMaster(v: number): void {
    this.masterVolume = v;
    this.applyVolumes();
  }
  setMusic(v: number): void {
    this.musicVolume = v;
    this.applyVolumes();
  }
  setSfx(v: number): void {
    this.sfxVolume = v;
    this.applyVolumes();
  }
  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    this.applyVolumes();
    if (on && this.gameplayMusicDesired) this.startMusic();
    else if (!on) this.stopMusic();
  }
  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
    this.applyVolumes();
  }

  /** Gameplay / post-idle title music. */
  startMusic(): void {
    this.gameplayMusicDesired = true;
    if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
    this.stopMusicSources();

    const loop = this.buffers.get('music_loop');
    if (loop) {
      const src = this.ctx.createBufferSource();
      src.buffer = loop;
      src.loop = true;
      src.connect(this.musicGain);
      src.start();
      this.musicSource = src;
      return;
    }

    const scale = [110, 130.81, 146.83, 164.81, 196, 220, 246.94];
    const tick = () => {
      if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
      const f = scale[this.musicNote % scale.length]!;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
      this.musicNote++;
      if (this.musicNote % 8 === 0) {
        const d = this.ctx.createOscillator();
        const dg = this.ctx.createGain();
        d.type = 'sine';
        d.frequency.value = 55;
        dg.gain.value = 0.04;
        d.connect(dg);
        dg.connect(this.musicGain);
        d.start();
        d.stop(this.ctx.currentTime + 1.6);
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 480);
  }

  stopMusic(): void {
    this.gameplayMusicDesired = false;
    this.bossMusicOn = false;
    this.stopMusicSources();
  }

  /** Intense procedural stem during framed boss fights. */
  startBossMusic(intensity = 1.2): void {
    this.gameplayMusicDesired = true;
    this.bossMusicOn = true;
    if (!this.ctx || !this.musicGain || !this.musicEnabled) return;
    this.stopMusicSources();
    const scale = [82.41, 98, 110, 130.81, 146.83, 164.81, 196];
    const tick = () => {
      if (!this.ctx || !this.musicGain || !this.musicEnabled || !this.bossMusicOn) return;
      const f = scale[this.musicNote % scale.length]! * (0.95 + intensity * 0.05);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.05 * intensity, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
      this.musicNote++;
      if (this.musicNote % 4 === 0) {
        const d = this.ctx.createOscillator();
        const dg = this.ctx.createGain();
        d.type = 'square';
        d.frequency.value = 49;
        dg.gain.value = 0.035 * intensity;
        d.connect(dg);
        dg.connect(this.musicGain);
        d.start();
        d.stop(this.ctx.currentTime + 0.9);
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, Math.max(280, 420 / intensity));
  }

  stopBossMusic(): void {
    if (!this.bossMusicOn) return;
    this.bossMusicOn = false;
    if (this.gameplayMusicDesired) this.startMusic();
  }

  private stopMusicSources(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        /* already stopped */
      }
      this.musicSource = null;
    }
  }

  /**
   * Title ambient bed: wind, forest, distant bells, torch fire, wood creaks, owls.
   */
  startTitleAmbient(): void {
    if (!this.ctx || !this.ambientGain || this.titleAmbientOn) return;
    this.titleAmbientOn = true;
    this.ambientGain.gain.value = this.sfxEnabled ? 0.55 : 0;

    // Wind — filtered brownish noise loop
    this.startNoisePad(0.04, 280, 0.018);
    // Forest canopy rustle
    this.startNoisePad(0.025, 1200, 0.01, 'highpass');
    // Torch fire crackle (higher, quieter)
    this.startNoisePad(0.05, 2200, 0.012, 'bandpass', 800);

    // Distant bells — sparse
    this.ambientTimers.push(
      window.setInterval(() => {
        if (!this.titleAmbientOn || !this.sfxEnabled) return;
        if (Math.random() < 0.4) this.playBell();
      }, 14000),
    );

    // Occasional wood creak in the bed
    this.ambientTimers.push(
      window.setInterval(() => {
        if (!this.titleAmbientOn || !this.sfxEnabled) return;
        if (Math.random() < 0.35) this.play('wood_creak', 0.35);
      }, 11000),
    );

    // Owls
    this.ambientTimers.push(
      window.setInterval(() => {
        if (!this.titleAmbientOn || !this.sfxEnabled) return;
        if (Math.random() < 0.45) this.playOwl();
      }, 18000),
    );
  }

  stopTitleAmbient(): void {
    this.titleAmbientOn = false;
    this.clearAmbientNodes();
  }

  /** In-match bed: wind, birds, river, torch. */
  startGameplayAmbient(): void {
    if (!this.ctx || !this.ambientGain) return;
    this.stopTitleAmbient();
    if (this.gameplayAmbientOn) return;
    this.gameplayAmbientOn = true;
    this.ambientGain.gain.value = this.sfxEnabled ? 0.42 : 0;
    // Wind
    this.startNoisePad(0.04, 320, 0.022);
    // River / stream
    this.startNoisePad(0.03, 900, 0.014, 'bandpass', 1.2);
    // Torch crackle
    this.startNoisePad(0.04, 2400, 0.01, 'bandpass', 0.9);
    // Occasional birds
    this.ambientTimers.push(
      window.setInterval(() => {
        if (!this.gameplayAmbientOn || !this.sfxEnabled) return;
        if (Math.random() < 0.55) this.playBird();
      }, 9000),
    );
  }

  stopGameplayAmbient(): void {
    this.gameplayAmbientOn = false;
    this.clearAmbientNodes();
    this.applyVolumes();
  }

  private clearAmbientNodes(): void {
    for (const n of this.ambientNodes) {
      try {
        n.stop();
      } catch {
        /* */
      }
    }
    this.ambientNodes = [];
    for (const t of this.ambientTimers) clearInterval(t);
    this.ambientTimers = [];
  }

  private playBird(): void {
    if (!this.ctx || !this.sfxGain) return;
    const f = 1400 + Math.random() * 900;
    this.blip(f, 0.06, 'sine', 0.04);
    setTimeout(() => this.blip(f * 1.15, 0.05, 'sine', 0.03), 70);
  }

  private startNoisePad(
    durChunk: number,
    filterFreq: number,
    vol: number,
    type: BiquadFilterType = 'lowpass',
    q = 0.7,
  ): void {
    if (!this.ctx || !this.ambientGain) return;
    // Continuous noise via looping buffer
    const len = Math.floor(this.ctx.sampleRate * 2);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ambientGain);
    src.start();
    this.ambientNodes.push(src);
    void durChunk;
  }

  private playBell(): void {
    if (!this.ctx || !this.sfxGain) return;
    const freqs = [392, 494];
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const t0 = this.ctx!.currentTime + i * 0.05;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.04, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 3);
    });
  }

  private playOwl(): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const t0 = this.ctx.currentTime;
    osc.frequency.setValueAtTime(420, t0);
    osc.frequency.exponentialRampToValueAtTime(280, t0 + 0.35);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.6);
    // Second hoot
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain || !this.titleAmbientOn) return;
      const o2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      o2.type = 'sine';
      const t = this.ctx.currentTime;
      o2.frequency.setValueAtTime(400, t);
      o2.frequency.exponentialRampToValueAtTime(260, t + 0.4);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      o2.connect(g2);
      g2.connect(this.sfxGain);
      o2.start(t);
      o2.stop(t + 0.7);
    }, 420);
  }

  play(id: string, volume = 1): void {
    if (!this.ctx || !this.sfxGain || !this.sfxEnabled) return;

    // Pitch ±5%, volume ±3% — avoid identical repeats
    const vol = volume * (0.97 + Math.random() * 0.06);
    const pitch = 0.95 + Math.random() * 0.1;

    const buf =
      this.buffers.get(id) ??
      (id.startsWith('attack_')
        ? this.buffers.get(id.split(':')[0]!) ?? this.buffers.get(id)
        : undefined);
    if (buf && id !== 'music_loop') {
      this.playBuffer(buf, this.sfxGain, vol, pitch);
      return;
    }

    this.playProcedural(id, vol, pitch);
  }

  private playBuffer(buf: AudioBuffer, dest: GainNode, volume: number, pitch = 1): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(dest);
    src.start();
  }

  private playProcedural(id: string, v: number, _pitch = 1): void {
    if (!this.ctx || !this.sfxGain) return;
    switch (true) {
      case id.startsWith('attack_arrow'):
        this.blip(id.includes('rapid') ? 1100 : 880, 0.05, 'square', 0.08 * v);
        if (id.includes('longbow')) this.blip(440, 0.08, 'triangle', 0.06 * v);
        break;
      case id.startsWith('attack_cannon'):
        this.noiseBurst(id.includes('mortar') ? 0.18 : 0.12, 0.25 * v, 200);
        this.blip(id.includes('shrapnel') ? 200 : 120, 0.1, 'sine', 0.2 * v);
        break;
      case id.startsWith('attack_ballista'):
        this.blip(260, 0.1, 'sawtooth', 0.14 * v);
        this.noiseBurst(0.06, 0.12 * v, 400);
        break;
      case id.startsWith('attack_support'):
        this.blip(480, 0.1, 'sine', 0.1 * v);
        this.blip(720, 0.12, 'triangle', 0.08 * v);
        break;
      case id.startsWith('attack_magic'):
        this.blip(520, 0.08, 'sine', 0.12 * v);
        this.blip(780, 0.1, 'triangle', 0.1 * v);
        break;
      case id.startsWith('attack_sniper'):
        this.blip(1400, 0.04, 'sawtooth', 0.1 * v);
        this.noiseBurst(0.06, 0.15 * v, 800);
        break;
      case id.startsWith('attack_poison'):
        this.blip(220, 0.12, 'triangle', 0.1 * v);
        break;
      case id.startsWith('attack_freeze'):
        this.blip(960, 0.1, 'sine', 0.1 * v);
        this.blip(1200, 0.12, 'sine', 0.08 * v);
        break;
      case id.startsWith('attack_tesla'):
        this.noiseBurst(0.08, 0.2 * v, 1200);
        this.blip(600, 0.05, 'square', 0.1 * v);
        break;
      case id.startsWith('attack_laser'):
        this.blip(400 + Math.random() * 200, 0.04, 'sawtooth', 0.05 * v);
        break;
      case id.startsWith('attack_rocket'):
        this.blip(180, 0.15, 'sawtooth', 0.15 * v);
        break;
      case id === 'explosion':
        this.noiseBurst(0.25, 0.35 * v, 100);
        this.blip(80, 0.2, 'sine', 0.25 * v);
        break;
      case id === 'impact':
        this.noiseBurst(0.04, 0.12 * v, 900);
        this.blip(180 + Math.random() * 80, 0.04, 'triangle', 0.08 * v);
        break;
      case id === 'kill':
      case id === 'death':
        this.blip(220, 0.07, 'sine', 0.11 * v);
        this.noiseBurst(0.09, 0.16 * v, 320);
        break;
      case id === 'hit':
        this.noiseBurst(0.03, 0.1 * v, 1100);
        this.blip(320 + Math.random() * 60, 0.03, 'triangle', 0.06 * v);
        break;
      case id === 'hit_crit':
        this.blip(720, 0.04, 'square', 0.08 * v);
        this.noiseBurst(0.05, 0.14 * v, 800);
        break;
      case id === 'gold':
        this.blip(880, 0.05, 'sine', 0.09 * v);
        this.blip(1175, 0.07, 'sine', 0.07 * v);
        break;
      case id === 'hammer':
        this.noiseBurst(0.05, 0.16 * v, 600);
        this.blip(140, 0.06, 'triangle', 0.1 * v);
        break;
      case id === 'gate_hit':
        this.noiseBurst(0.18, 0.28 * v, 160);
        this.blip(90, 0.22, 'sine', 0.22 * v);
        break;
      case id === 'wave_clear':
        this.blip(392, 0.12, 'sine', 0.12 * v);
        setTimeout(() => this.blip(523, 0.14, 'sine', 0.12 * v), 90);
        setTimeout(() => this.blip(659, 0.18, 'sine', 0.1 * v), 180);
        break;
      case id === 'ui_click':
        this.blip(520, 0.035, 'triangle', 0.06 * v);
        break;
      case id === 'ui_hover':
        this.blip(380, 0.025, 'sine', 0.03 * v);
        break;
      case id === 'wood_creak':
        this.noiseBurst(0.18, 0.12 * v, 400);
        this.blip(90 + Math.random() * 40, 0.22, 'sawtooth', 0.08 * v);
        break;
      case id === 'gate_open':
        // Ancient, heavy — low grind + boom
        this.noiseBurst(0.55, 0.28 * v, 180);
        this.blip(55, 0.7, 'sine', 0.22 * v);
        this.blip(70, 0.45, 'triangle', 0.12 * v);
        setTimeout(() => this.noiseBurst(0.35, 0.18 * v, 120), 200);
        setTimeout(() => this.blip(48, 0.5, 'sine', 0.15 * v), 280);
        break;
      case id === 'build':
        this.blip(330, 0.06, 'triangle', 0.12 * v);
        this.blip(440, 0.08, 'triangle', 0.1 * v);
        break;
      case id === 'sell':
        this.blip(300, 0.08, 'sine', 0.1 * v);
        break;
      case id === 'upgrade':
        this.blip(523, 0.06, 'sine', 0.1 * v);
        this.blip(659, 0.08, 'sine', 0.1 * v);
        this.blip(784, 0.1, 'sine', 0.1 * v);
        break;
      case id === 'wave':
        this.blip(220, 0.15, 'sawtooth', 0.12 * v);
        this.blip(330, 0.2, 'sawtooth', 0.1 * v);
        break;
      case id === 'leak':
        this.blip(150, 0.2, 'sine', 0.2 * v);
        break;
      case id === 'victory':
        [523, 659, 784, 1046].forEach((f, i) => {
          setTimeout(() => this.blip(f, 0.2, 'sine', 0.15 * v), i * 120);
        });
        break;
      case id === 'defeat':
        this.blip(200, 0.3, 'sawtooth', 0.2 * v);
        this.blip(120, 0.4, 'sine', 0.2 * v);
        break;
      case id === 'achievement':
        this.blip(660, 0.08, 'sine', 0.12 * v);
        this.blip(880, 0.12, 'sine', 0.12 * v);
        break;
      case id === 'ability':
        this.blip(400, 0.1, 'triangle', 0.15 * v);
        this.noiseBurst(0.15, 0.2 * v, 400);
        break;
      case id === 'hero_attack':
        this.blip(280, 0.05, 'triangle', 0.12 * v);
        this.noiseBurst(0.04, 0.1 * v, 600);
        break;
      case id === 'hero_ability':
        this.blip(360, 0.1, 'sine', 0.14 * v);
        this.blip(520, 0.14, 'triangle', 0.12 * v);
        this.noiseBurst(0.2, 0.18 * v, 350);
        break;
      case id === 'hero_death':
        this.blip(180, 0.25, 'sawtooth', 0.16 * v);
        this.blip(90, 0.35, 'sine', 0.14 * v);
        break;
      case id === 'hero_respawn':
        this.blip(440, 0.1, 'sine', 0.12 * v);
        this.blip(660, 0.12, 'sine', 0.12 * v);
        this.noiseBurst(0.15, 0.12 * v, 500);
        break;
      case id === 'hero_footstep':
        this.noiseBurst(0.03, 0.06 * v, 200);
        break;
      case id === 'faction_hollow':
        this.blip(90, 0.35, 'sine', 0.14 * v);
        this.noiseBurst(0.28, 0.16 * v, 180);
        this.blip(140, 0.2, 'triangle', 0.08 * v);
        break;
      case id === 'faction_iron':
        this.noiseBurst(0.12, 0.2 * v, 220);
        this.blip(70, 0.25, 'sawtooth', 0.12 * v);
        this.blip(110, 0.15, 'square', 0.08 * v);
        break;
      case id === 'faction_wild':
        this.blip(520, 0.06, 'triangle', 0.1 * v);
        this.blip(780, 0.05, 'square', 0.08 * v);
        this.noiseBurst(0.08, 0.1 * v, 900);
        break;
      case id === 'faction_ash':
        this.noiseBurst(0.22, 0.18 * v, 280);
        this.blip(200, 0.18, 'sawtooth', 0.1 * v);
        this.blip(340, 0.22, 'sine', 0.09 * v);
        break;
      default:
        this.blip(440, 0.05, 'sine', 0.08 * v);
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.sfxGain) return;
    // Per-voice pitch ±5% so procedural layers never sound identical
    const f = freq * (0.95 + Math.random() * 0.1);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, filterFreq: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq * (0.95 + Math.random() * 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
  }
}
