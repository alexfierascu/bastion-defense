# Bastion Defense

A polished, production-oriented browser Tower Defense game.

No backend. No external game engine. Runs entirely in the browser with TypeScript, Vite, and Canvas 2D.

## Features

- **9 tower classes** with unique attacks, projectiles/beams, range indicators, 5-level upgrades, sell, and 6 targeting modes
- **10 enemy archetypes** including flying, invisible, armored, regenerating, shielded, mini-boss, and boss
- **50+ campaign waves** with bosses every 10 waves and endless mode afterward
- **6 player abilities** with cooldowns (Meteor, Freeze, Air Strike, EMP, Nuke, Gold Boost)
- **Economy**: kill rewards, wave clear bonus, flawless bonus, interest
- **Camera**: pan (WASD / arrows), zoom (wheel / pinch), fullscreen
- **3 maps**, daily challenge seed, minimap, day/night tint, weather
- **32 achievements**, persistent statistics, LocalStorage save/continue
- **Settings**: volume, music/SFX toggles, graphics quality, language (EN/ES/FR/DE/PT), colorblind mode, accessibility options
- **UI**: main menu, map select, pause, victory/defeat, encyclopedia, HUD with FPS & game speed (pause / 1x / 2x / 4x)
- **VFX**: particles, explosions, smoke, lightning, damage numbers, recoil, hit flash, screen shake, glow, shadows
- **Audio**: procedural Web Audio music bed + SFX (swap-in ready for real files)
- **Performance**: fixed timestep, object pools for projectiles/particles/damage numbers

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

Static output lands in `dist/`. Serve that folder from any static host.

## Controls

| Action | Input |
|--------|--------|
| Pan | W A S D / Arrow keys |
| Zoom | Mouse wheel / pinch |
| Build | Select tower in bar, click map |
| Select tower | Click existing tower |
| Cancel | Esc |
| Sell | X (or Sell button) |
| Pause | Space |
| Speed | 1 / 2 / 3 → 1x / 2x / 4x |
| Abilities | Q E R T Y U |
| Fullscreen | HUD button or Settings |

Touch: tap to build/select, pinch to zoom.

## Project structure

```
src/
  config/       # balance, towers, enemies, abilities, achievements, i18n
  engine/       # camera, input, renderer
  entities/     # enemy, tower, projectile
  systems/      # map, waves, combat, particles, abilities, achievements
  audio/        # AudioManager (Web Audio)
  save/         # LocalStorage save + settings/stats
  ui/           # menus + HUD
  utils/        # math, pooling, events
  styles/       # CSS
  game.ts       # orchestration / game loop
  main.ts       # entry
public/assets/  # placeholder asset slots + replacement guide
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system responsibilities and extension points.

## Balance notes

- Early game favors Arrow + Freeze support.
- Armored waves punish pure physical DPS — bring Magic / Tesla / Laser.
- Flying enemies ignore Cannon.
- Splash (Cannon / Rocket) shines on dense packs; Sniper and Laser handle elites/bosses.
- Interest rewards banking gold between waves; flawless clears pay extra.

## Replacing assets

Procedural art/audio keep the repo self-contained. To use real media, follow `public/assets/README.md` and keep the same `AudioManager.play(id)` / sprite keys.

## License

MIT — use freely for learning, mods, and portfolios.
