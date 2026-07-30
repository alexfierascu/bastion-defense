# Assets

This build ships with **procedural Canvas sprites** and **Web Audio synthesized SFX/music**, so it runs without binary media.

Drop real files here to upgrade fidelity — the game loads them at unlock and falls back to procedural audio when a file is missing.

## Sounds

Place files under `sounds/` using any of: `.ogg`, `.mp3`, `.wav`.

Recommended keys (matched by `AudioManager.play(id)`):

- `attack_arrow`, `attack_cannon`, `attack_magic`, `attack_sniper`
- `attack_poison`, `attack_freeze`, `attack_tesla`, `attack_laser`, `attack_rocket`
- `explosion`, `build`, `sell`, `upgrade`, `wave`, `leak`
- `ui_click`, `ui_hover`, `victory`, `defeat`, `achievement`, `ability`
- `music_loop` (looped when present)

Example: `public/assets/sounds/explosion.ogg`

## Landing

`landing/bastion-hero.png` — clean cinematic fortress (no baked UI).
`landing/bastion-ui-ref.png` — design reference with menu layout (not used at runtime).

## Sprites

Runtime sprite atlases are **procedural pixel art** (Cozy Forest by default).
Art styles live in `src/config/artThemes.ts` + `src/engine/sprites.ts`.

Optional future path: drop PNG/WebP sheets under `sprites/` keyed like
`tower:arrow:idle` — a file loader can replace generators the same way sounds work.

## Maps

Tile atlases can go in `maps/`. Path data is generated in `src/systems/map.ts`.
