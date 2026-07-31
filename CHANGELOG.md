# Changelog

## SPRINT-P0 — Art Direction Foundation (2026-07-31)

P0 items from `docs/08_Development/ART_DIRECTION_AUDIT.md`. UI/copy/data-label fixes only —
no gameplay values, no visual redesign, no new systems. Typechecked (`tsc --noEmit` clean),
production build clean, and verified live in-browser (title → menus → full campaign mission
→ relic overlay → victory flow).

### Modified files and why

| File | Why |
|---|---|
| `index.html` | **(T9)** Removed `maximum-scale=1.0, user-scalable=no` from the viewport meta — browser zoom is no longer blocked (WCAG 1.4.4). |
| `src/styles/main.css` | **(T1)** Defined the previously-missing `--surface` (`#171e18`) and `--accent` (`#c4a070`) tokens — fixes the fully transparent relic/reward modal (`.choice-panel` background computed `rgba(0,0,0,0)`, now opaque); `--accent` matches the fallback value already rendered everywhere, so no color shifts. **(T8)** Added global `:focus-visible` outline rules for `button`/`input`/`select`/`[tabindex]`. **(T7)** Added `.pause-veil` / `.pause-veil-card` styles and added the veil to the `#ui-root` pointer-events allowlist. |
| `src/title/styles/title-scene.css` | **(T8)** Removed three `outline: none` declarations on `:focus-visible` states (`.ts-nav`, `.ts-enter`, `.ts-foot button`) so the new global focus ring shows on the title screen. |
| `src/ui/uiManager.ts` | **(T6)** `showToast` now queues (max 4, consecutive-duplicate drop, faster drain when backed up) instead of overwriting; `showAchievement` now queues popups sequentially; queues reset on screen change since the toast/popup nodes are rebuilt. **(T2)** Research prerequisites render skill names ("Needs War Chest Rank 1" instead of "starting_gold@1"); save-slot meta shows the map name instead of the raw map id; Profile shows tower/hero display names and faction names instead of ids; Encyclopedia enemy meta uses new `ROLE_LABELS` ("Shield Bearer" instead of "shieldBearer"). **(T3)** Settings premium line replaced with "Additional art styles unlock through campaign play."; Credits font line corrected to "Cinzel & Source Sans 3" (was listing fonts the game doesn't ship). **(T7)** HUD template gains a "Paused" veil (dim + card + resume hint, click-to-resume); veil cached and toggled from HUD state. **(T10)** Speed buttons + veil are driven every frame from `state.speed`/`state.paused`, so keyboard shortcuts and any other speed source keep the buttons in sync; `updateHud` payload extended with `speed`/`paused`. |
| `src/game.ts` | **(T6)** Victory: mission summary now appears ~2.4s after the "Victory" banner (was same-frame), guarded on `phase === 'victory'` so quitting during the banner can't resurrect the screen; Defeat: report delayed ~2.0s behind the "Defeat" banner with the same guard. Achievement popups are held in `pendingAchievements` while a boss intro plays and re-emitted after it ends (new `presentAchievement` helper). **(T7)** Soft pause (speed 0) now disables gameplay input: map click/build/cast blocked via `canInteractMap`, sell/undo/ability hotkeys and hero move-orders guarded by `softPaused` (camera pan/zoom and UI buttons still work). **(T10/T7)** HUD payload includes `speed` and `paused`. **(T2)** Mission-summary "Unlocked" line now resolves map names and cosmetic display names (was raw ids for maps; cosmetics were omitted). |
| `src/systems/achievements.ts` | **(T2)** Live unlock toast/popup text now uses tower display names and `cosmeticDisplayName` ("Cosmetic: Ghost Protocol" instead of "Cosmetic: ghost") — this path built its own strings separate from the achievements screen. |
| `src/config/achievements.ts` | **(T2)** `formatAchievementReward` (achievements screen) uses tower display names and `cosmeticDisplayName`. |
| `src/config/cosmetics.ts` | **(T2 support)** New `cosmeticDisplayName(id)` helper resolving `'art:<style>'`, tower-skin, and path-theme ids to display names; used by game, achievements system, and achievements config. |
| `src/config/abilities.ts` | **(T2)** Ability chip glyphs changed from pseudo-code triads (`MTR`/`FRZ`/`AIR`/`EMP`/`NKE`/`GLD`) to one consistent single-letter set (`M`/`F`/`A`/`E`/`N`/`G`); full names remain on the button label and tooltip. |
| `src/config/bosses.ts` | **(T3)** Replaced the stray CJK character `吼` (Enrage Roar icon) with `💢`, consistent with the existing emoji set for boss abilities. |
| `src/config/relics.ts` | **(T4)** Fixed the migration id↔name shift so every relic's display name matches its id and effect. Ids, effects, weights, and descriptions unchanged (no gameplay change): `global_fire_rate` → "War Drums" (frees the name for the real banner), `royal_banner` → "Royal Banner", `ancient_compass` → "Ancient Compass", `broken_crown` → "Broken Crown", `dragon_tooth` → "Dragon Tooth", `blessed_hammer` → "Blessed Hammer", and `pierce` → "Lance Point" (its old name "Ancient Compass" collided with the id of the same name). Names "Ash Circlet" and "Heartwood Charm" leave the pool. |
| `src/config/campaign.ts` | **(T5)** m09 "Legend March" now grants `art:grimDark` — Grim Dark is properly unlockable and its existing hint ("Complete Legend March to unlock") is finally true; replaces the dead cosmetic id `tower-frost` which matched nothing. m04 "Night Watch" reward `path-moonlit` (also a dead id) remapped to the existing `frost` (Frostveil) path theme so the promised reward actually delivers. |

### Verification performed

- `tsc --noEmit` and `npm run build` clean.
- Live in-browser: focus rings on title/menus; settings/credits/research/achievements/encyclopedia/profile/save-slots copy checked in DOM; relic modal opaque with correctly-paired names ("War Drums — Towers attack 10% faster"); pause veil dims playfield, blocks map input, click/1x resumes, speed buttons follow non-click speed changes; full mission ran to completion — Victory banner displayed alone (~2.4s, screen still HUD) before the mission summary appeared with named unlocks ("Emerald Road, Ballista").
- Player save (`localStorage bastion-defense-save-v1`) was backed up before verification and restored byte-identical afterward.

### Notes

- Soft pause (the "II" button / speed 0) previously allowed building and casting while frozen; per T7 it now disables gameplay input. The full pause menu (Space) is unchanged.
- Boss-intro achievement suppression is a hold-and-replay queue; verified by review (deterministically forcing an achievement during an intro isn't reproducible without contrived state).
- Pre-existing issue observed while testing (not in P0 scope, worth a ticket): keyboard input is frame-polled from a live key set (`input.ts consumeKey`), so key taps shorter than one frame (synthetic/automation input; theoretically ultra-fast physical taps) can be missed.
