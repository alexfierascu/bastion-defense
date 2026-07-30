/** Shared types for the Bastion title scene engine. */

export type LayerId =
  | 'sky'
  | 'moon'
  | 'cloudsFar'
  | 'cloudsNear'
  | 'tree'
  | 'fortress'
  | 'towers'
  | 'walls'
  | 'gate'
  | 'banners'
  | 'torches'
  | 'ground'
  | 'grass'
  | 'fog1'
  | 'fog2'
  | 'fog3'
  | 'weather'
  | 'particles'
  | 'lighting'
  | 'ui';

export type WeatherId = 'clear' | 'mist' | 'rain' | 'storm' | 'snow' | 'dawn';

export interface Vec2 {
  x: number;
  y: number;
}

export interface LayerDef {
  id: LayerId;
  /** DOM depth (higher = closer to camera). */
  z: number;
  /** Parallax amplitude in CSS px (docs/05-PARALLAX.md). */
  parallax: number;
  /** Optional asset URL for image plates. */
  src?: string;
  /** CSS class hooks for styling / weather modulation. */
  className?: string;
  /** Nest under another layer (scene graph hierarchy). */
  parent?: LayerId;
}

export interface EnvironmentState {
  weather: WeatherId;
  /** 0 day … 1 night */
  timeOfDay: number;
  wind: number;
  moonDim: number;
  particleScale: number;
  fogDensity: number;
  skyWarmth: number;
}

export interface TorchState {
  brightness: number;
  radius: number;
  intensity: number;
  flame: number;
}

export interface TitleAudioBridge {
  unlock: () => Promise<void>;
  play: (id: string, volume?: number) => void;
  startAmbient: () => void;
  stopAmbient: () => void;
  startMusic: () => void;
  stopMusic: () => void;
}

export interface TitleSceneOptions {
  root: HTMLElement;
  reduceMotion?: boolean;
  onAction: (action: TitleAction) => void;
  hasContinue?: boolean;
  hasReplay?: boolean;
  version?: string;
  title?: string;
  audio?: TitleAudioBridge;
}

export type TitleAction =
  | 'new'
  | 'continue'
  | 'daily'
  | 'research'
  | 'achievements'
  | 'encyclopedia'
  | 'replay'
  | 'settings'
  | 'credits'
  | 'slots'
  | 'copy-seed';

export interface TitleSceneHandle {
  destroy: () => void;
  setEnvironment: (partial: Partial<EnvironmentState>) => void;
  getFps: () => number;
}
