# Bastion Defense — Art Direction & Frontend Audit

**Date:** 2026-07-31
**Auditor role:** Lead Art Director / Lead Frontend Engineer review
**Status:** Report only — nothing implemented. Awaiting direction decision (see "The decision" at the end).

---

## Context for the reader

Bastion Defense is a browser tower-defense game: Vite + TypeScript, no framework, GSAP for title-scene animation only. ~26,600 lines of source. All art is **procedural** — canvas 2D drawing plus DOM/CSS — except two AI-painted PNGs used on the title screen (`public/assets/landing/bastion-hero.png`, `bastion-ui-ref.png`). Rendering is a single world canvas (plus a minimap canvas and an offscreen sprite atlas); UI is hand-built DOM rebuilt per screen by one `UIManager`. Fonts: Cinzel (display) + Source Sans 3 (body).

The project carries an extensive design-doc tree (`docs/03_Art/ART_BIBLE.md`, `COLOR_SYSTEM.md`, `STYLE_GUIDE.md`, `VISUAL_LANGUAGE.md`, `LIGHTING.md`, `UI_PHILOSOPHY.md`, `MAIN_MENU.md`, …) that defines a strict identity: moonlit, grounded, late-medieval, "never cartoon, never neon," two accent colors only (soft gold + deep crimson), darkness as a value.

**Audit methodology:** four parallel deep code-analysis passes (rendering/VFX pipeline; UI/CSS system; gameplay presentation; docs-vs-config gap analysis) plus a full hands-on playthrough in Chrome covering every screen: title, all title sub-screens, world map, mission brief, gameplay (build, upgrade to max branch, combat, elite wave, mini-boss, full boss fight, relic overlay, world events, hero talent choice, pause), and the victory/mission-summary flow. Live playthrough used the DEV playtest panel (F8: +gold, god mode, skip wave, spawn boss/enemies). All file:line references verified against source at audit time.

---

## The headline

**The game ships three different visual identities:**

1. **The title screen** — a moonlit, painted, Art-Bible-perfect fortress with the Great Tree, torch lighting, weather, and parallax. Portfolio-grade.
2. **Gameplay** — a bright daylight "Cozy Forest" green checkerboard with soft pixel wildlife and candy-neon accent colors. This is the aesthetic the Art Bible **explicitly forbids** ("Cute / Cartoon / Mobile / Arcade / Neon" are named forbidden keywords; `artThemes.ts:45` literally describes the ship style as "Cozy Forest — Warm moss, timber towers, and soft pixel wildlife").
3. **The menus** — competent but generic dark-green DOM panels that belong to neither.

The transition from title painting → empty world map → gingham gameplay is the most damaging 30 seconds of the product: it breaks the promise the key art just made. Meanwhile the bible-compliant **Grim Dark style is dead content** — its unlock hint says "Complete Legend March" (`artThemes.ts:74`) but no code path ever grants `art:grimDark` (`artThemes.ts:109`; nothing in `campaign.ts` or `unlocks.ts` grants it).

---

## What works

- **The title screen is genuinely excellent.** Painted key art, Cinzel typography, diamond-framed single-stroke SVG nav icons (`TitleUI.ts:13–28`), a 17-layer parallax scene with a rigid-stone rule (banners/torches nested inside the fortress transform), a canvas lighting system (moon radial + warm torch glows in `screen` composite, wet-ground reflections), weather presets, torch flicker controllers, and disciplined reduce-motion gating (`TitleScene.ts:26–29`). This is the reference composition the rest of the game should be measured against.
- **HUD information architecture is sound.** Top stat bar; dock with Towers/Powers tabs; tower panel with stat line, lifetime damage/kills, branch-choice cards, targeting cycle, sell with undo window; boss bar with phase name + shield overlay; wave preview line. The *content* of the UI is right — the skin, scale, and consistency lag.
- **Game-feel plumbing is real:** camera impact-zoom punches (`camera.ts:176–186`), smoothed noise shake (`camera.ts:235–246`), enemy squash/stretch on hit (`renderer.ts:995–1002`), per-class death styles (pop/burst/fade/crumble, no gore), per-tower-type impact particle recipes (`particles.ts:236–283`), distinct projectile physics/shapes per type (`renderer.ts:1188–1263`), ribbon trails + motion-blur streaks on high quality. 120 FPS held through a 104-enemy boss fight at high quality in testing.
- **Copy at its best is on-brand:** "The road from the forest ends at iron and oak. Hold the gate until the horns fall silent." Region/mission/relic naming (Green Marches, Mire Reach, Masons' Bond, Heartwood Charm, Bodkin Tips) fits the world.
- **Accessibility effort exists:** aria-live on toast/banner/feed, `role="dialog"` on panels, aria-modal + focus on confirm, colorblind tile palette, double reduced-motion kill-switch (media query + settings attribute).
- **The sprite pipeline is a solid system** (`sprites.ts` + `pixelPaint.ts`): 24×24 logical grid, 4-neighbor outline pass, baked drop shadow, idle/attack/walk frames, memoized atlas rebuilt cheaply on style change (`renderer.ts:75–80` — the right hook for any future reskin). The direction and scale it serves are the problem, not the machinery.

---

## What looks amateur

### In-world (all verified visually in playthrough)

1. **The checkerboard tablecloth.** Every tile alternates two greens `(c+r)%2` with a repeating 6px darker "depth band" at each tile's bottom (`renderer.ts:421–429`). The map reads as gingham fabric. Water is flat blue checker rectangles with hard rectangular borders — no banks, no autotiling, no edge blending anywhere (`bastionApproach.ts:180–192` fakes "soft banks" with more water tiles). Strong banding/moire at low zoom, patched with a `+0.5px` overdraw hack (`renderer.ts:425`).
2. **Entities are illegible specks.** At fit-to-map zoom, enemies are ~10–16px dots barely distinguishable from path pebbles; the arrow tower is an unreadable green blob; the boss arrives under a full-width banner reading "THE SIEGE GOLEM — Living Siege Engine" and is a ~30px lump. The fiction and the pixels disagree everywhere.
3. **"Mixels."** Baked pixel sprites are drawn at fractional scales (tower 1.1, wall 1.05, enemy `radius/11`) and freely rotated — *including their baked shadows and highlight pads* (`renderer.ts:897–907, 1007–1014`) — under a continuous 0.45–2.2 zoom. Meanwhile the hero is smooth anti-aliased vector ellipses (`renderer.ts:693–823`), projectiles are vector shapes with `shadowBlur` glows, and all rings are thin AA circles. Three rendering metaphors share every frame.
4. **Named weather/lighting that doesn't render.** "Forest Night" environment plays in bright daylight (the night overlay is a single subtle wash, high-quality-only — `renderer.ts:274–279`). A "Heavy Rain (49s)" world event showed **zero rain** — events alter stats via `runMeta.ts:236–257` but never drive the renderer's weather, which listens only to biome/day-night (`game.ts:2818–2842`). The Bastion itself — the franchise landmark per `THE_BASTION.md` — is a cluster of grey rock tiles; no map has any landmark (`systems/map.ts:199–213` are waypoint lists only).
5. **Upgrades are invisible.** Tier 1 → Arcane Bolt → Void Spike produced pixel-identical towers; the only in-world tier signal is a row of 3px pips (`renderer.ts:864–869`); the atlas has no level/branch dimension (`sprites.ts:431–440`). **Elites and affix enemies have no in-world marker at all** ('elite' is a string in `modifiers`, never read by the renderer — `game.ts:2930–2933`). **Stun has no visual.** Three near-identical blue rings encode three different mechanics (slow `rgba(150,220,255)` / shield `rgba(100,200,255)` / directional shield `rgba(140,200,255)` — `renderer.ts:1056–1083`).
6. **Boss abilities damage the gate with zero telegraph** — groundSlam/boulderThrow chip the gate abstractly from anywhere with only a particle burst at the boss (`bossController.ts:197–219`). In testing the gate silently dropped 35→14 *through dev god mode* during a boss fight.

### In the UI (all verified visually)

7. **Native browser controls inside the fantasy skin:** default blue OS checkboxes, default `<select>` dropdowns, default scrollbars in Settings; checkbox sits far-left while its label sits far-right across a panel of dead space; slider rows are labeled on the opposite side from checkbox rows.
8. **The world map is programmer art** — flat translucent ellipse blobs for regions, faint spider-lines between missions, tiny labels in **Georgia serif** (`main.css:1978`; canvas text `'14px Georgia, serif'` at `worldMapView.ts:160`, `'11px system-ui'` at `:227`), one gold circle per mission, a mostly empty dark void. It is the worst screen in the game and sits directly after the best one.
9. **Raw internals leak into player copy:** Research prerequisites render as "Needs starting_gold@1 / interest@2 / crit_boost@1"; Encyclopedia meta line shows "shieldBearer"; Profile shows Favorite Hero "warden" (lowercase id); boss ability icons are emoji plus the raw CJK character **`吼`** (`bosses.ts:138`); Credits list "Orbitron & Rajdhani" — fonts the game doesn't ship (`uiManager.ts:1827`).
10. **Four icon languages coexist:** crafted single-stroke title SVGs vs. multicolor emoji (all 30 achievements, hero portrait 🛡, locks 🔒, enemy ability pips) vs. 3-letter ASCII codes (MTR/FRZ/NKE) vs. colored-square swatches standing in for tower art in the build dock. `UI_PHILOSOPHY.md` demands "single color, consistent stroke width."
11. **Confirmed live CSS bug:** the relic/elite-reward modal panel is **transparent** — `.choice-panel` uses `var(--surface)` which is never defined anywhere; computed background is `rgba(0,0,0,0)` (`main.css:1681`). Verified both by computed-style probe and visually (the "Relic Found" overlay is a floating border with gameplay showing through). Sibling token `--accent` is also phantom — referenced 6× only via fallback (`main.css:1576, 1661, 1718, 1729, 1745`). Meanwhile the real bronze token `--bronze #c4a35a` competes with hardcoded `#c4a070` (×10), `#c4a050`, `#d4a050`, `#d4b070`, `#e0c48a`, `#f0d090`, `#ffe28a`.
12. **Moment collisions:** the Victory/Defeat cinematic banner is covered the *same frame* by the report overlay (`game.ts:2610–2611`, `2577–2582`) — the beat is never seen (confirmed: victory jumped straight to the summary card). An achievement popup fired directly over the boss intro. ~80 call sites share one single-slot 2.2s toast that overwrites itself (`uiManager.ts:1537–1543`). Pause shows no state beyond a 2px button highlight — a paused game looks identical to a running one.
13. **Type-scale chaos with illegible floors:** 23 distinct ad-hoc rem sizes in `main.css`; HUD stat labels at 8.7px (`0.58rem`, `:600`) in ~3.2:1 grey (WCAG fail); large parts of the UI sit under 12px. **Zero `:focus-visible` rules** in the game UI; viewport locks `user-scalable=no` (`index.html:5`). Locked/disabled content at 0.35–0.45 opacity is unreadable.
14. **Patch-on-patch CSS:** ~15 parallel button families (`.diff-btn` duplicates `.btn` nearly verbatim — `main.css:291` vs `:345`); `.upgrade-choice` and `.hud-chrome-top` each defined twice with conflicting values (`:989` vs `:1566`, `:520` vs `:1523`); 24 `!important`; `.hidden` re-implemented 5 times; z-index ladder 1/2/3/6/10/40/50/80/100/200 with collisions (tooltip 40 = photo chrome 40).
15. **Misc amateur signals:** speed-button highlight desyncs from keyboard speed keys (`uiManager.ts:1040–1047` vs `game.ts:2734`); hero panel rebuilds its abilities/talents `innerHTML` every frame while open, destroying hover states (`uiManager.ts:1476–1501`); the brief screen's animated scanline gradient renders as literal venetian-blind stripes (`main.css:1294–1316`); kill feed sits on top of the primary enemy lane (`main.css:1156–1164`); ability aim preview is a fixed 100px circle regardless of the ability's real radius (`renderer.ts:225–233`); minimap is near-unreadable (flagged in `MILESTONE_6_AUDIT.md` as well); "Suggested Diff" truncated jargon in the mission sidebar; prestige logic mutates save data inside a render function (`uiManager.ts:430–448`); unescaped user strings interpolated into `innerHTML` (slot names, `uiManager.ts:767`).

---

## What should be removed

- **Premium/monetization copy leak** — "Cozy Forest is free. Extra styles can unlock later (premium)." in Settings.
- **The sci-fi register (as named):** Tesla / Laser / Rocket towers, EMP Pulse, Tactical Nuke, Air Strike, "Servo Tuning," "Ghost Protocol," Railshot / Anti-Materiel / Arc Capacitor / Thermite / Overcharge / Swarm Pods / Saturation / Sweep Array (`towers.ts:349–441`, `abilities.ts:51–83`, `upgradeBranches.ts:183–347`, `runResearch.ts:26–31`, `cosmetics.ts:96`). `WORLD_OVERVIEW.md`: "late medieval period. No firearms. No steam engines." Keep the mechanics; rename and recolor them.
- **Emoji as UI iconography** everywhere: achievements (`achievements.ts:66–97`), hero portrait (`heroes.ts:91`), locks, enemy ability pips (`enemyAbilities.ts:37–108`), boss abilities incl. `吼` (`bosses.ts:88–141`).
- **The brief screen scanline overlay** (`main.css:1294–1316`).
- **Georgia/system-ui fonts** on the world map (`main.css:1978`, `worldMapView.ts:160, 227`).
- **Dead weight:** unused `cbColor()` — meaning colorblind mode never reaches sprites/particles/status rings today (`renderer.ts:1352–1363`); `.btn.ghost`, `.menu-status`, `.daily-board-list` family, `.stats-block`, `.choice-card.active`, `#fps-meter` element+rule; duplicate `.hud-chrome-top`/`.upgrade-choice` blocks; 6 deprecated enemy aliases; dead cosmetic ids `path-moonlit` / `tower-frost` granted by campaign m04/m09 but absent from `cosmetics.ts` (`campaign.ts:215, 333`); orphaned desert biome (defined, used by zero maps — `biomes.ts:111–143`); doc dependencies pointing at eight nonexistent files; stale credits font copy.
- **Relic id↔name off-by-one** (migration artifact): id `royal_banner` displays "Broken Crown", `ancient_compass`→"Dragon Tooth", `broken_crown`→"Ash Circlet", `dragon_tooth`→"Blessed Hammer", `blessed_hammer`→"Heartwood Charm", while id `global_fire_rate` displays "Royal Banner" (`relics.ts:41–135`). Live-confirmed in the relic overlay ("Royal Banner — Towers attack 10% faster").

---

## What should be redesigned

1. **Gameplay lighting & palette → the Art Bible.** Keep Cozy Forest's readability; kill its daylight-picnic mood. Desaturate tile palettes toward `COLOR_SYSTEM.md` values (background `#1E2320`, stone `#555B57`, moss `#556B4C`, oak `#6E5134`, bronze `#8B6B35`, torch `#E2A54A`, moon `#8EA6C4`); make twilight the campaign default with warm torch light-pools as the signature (the `screen`-composite pool system already exists — `renderer.ts:344–366`); route the ~60 hardcoded warm hexes in markers/hero/FX/backdrop through the art-style system so a style swap actually restyles the game (today `grimDark` retints tiles/decor only).
2. **Accent discipline.** Two sanctioned accents (soft gold, deep crimson) plus a constrained per-damage-type set, derived from **one palette module consumed by both CSS custom properties and the renderer/configs**. Today's accents include neon `#7dff6a` (poison), `#ffe066` (tesla), `#ff4d6d` (laser), `#ff6aaa` (miniboss), `#6dffb0` (healer), `#e878a0` (flowers) — and the doc's semantics ("red is reserved for danger, gold for importance") are inverted by a red player tower and gold-accented enemies.
3. **Entity presence & hierarchy.** Raise the default zoom floor / bigger silhouettes; stop rotating baked sprites (rotate a weapon layer only, or pre-bake 8 facings); tier/branch sprite variants via the cheap atlas-rebuild hook; elite crowns/auras and affix markers; an icon-based status strip replacing the ring soup; a stun visual; a real Bastion gate structure as the landmark anchor.
4. **World map** re-imagined as a painted-parchment campaign map in the title screen's art language. This screen carries the campaign fantasy and currently kills it.
5. **A UI component system:** one button family with modifiers, one card recipe, one tooltip system, tokenized spacing/radius/type scale (5–6 sizes), styled form controls, focus-visible states, and a **feedback bus** (toast queue with priority lanes) so banners, achievements, and boss moments stop overwriting each other.
6. **Ceremony for outcomes:** hold the Victory/Defeat banner, then present the report; boss intros protected from popup collisions; boss ability ground telegraphs; a visible pause state.
7. **Perf-as-art enablers:** cache terrain to an offscreen canvas — 1,120 tiles × 3–8 fill ops are re-issued **every frame** (`renderer.ts:411–492`), which is both the render budget and the shimmer/banding; replace per-particle `shadowBlur` (`particles.ts:464–466`) and per-enemy `ctx.filter='brightness(1.85)'` (`renderer.ts:1004–1006`) with cheap alternatives (pre-brightened atlas row / additive sprite); stop quality tiers from deleting the art direction (night overlay, weather, shadows, speckles all vanish below "high"/"medium" — `renderer.ts:170, 274–285, 431` — so low-end players get a different game).

---

## Prioritized implementation plan

### P0 — Broken-glass fixes (≈1–2 days, direction-neutral)
1. Define `--surface` and `--accent` tokens (or replace their usages) — fixes the transparent relic modal (`main.css:1681`).
2. Fix raw-ID leaks: research prereq labels, encyclopedia meta lines, profile hero name. Replace `吼` and ASCII ability codes with placeholders from one glyph set. Delete premium copy and stale credits.
3. Sequence the endgame: delay the report overlay until the Victory/Defeat banner completes; queue achievement popups outside boss intros; give pause a visible state (dim + label).
4. Fix the relic id↔name mapping; wire or remove `path-moonlit`/`tower-frost`; decide and implement Grim Dark's unlock path (or hide the style).
5. Add `:focus-visible` styles; remove `user-scalable=no`; sync speed-button state with keyboard shortcuts.

### P1 — Readability core (≈1–2 weeks, direction-neutral)
1. **Terrain pass:** offscreen terrain cache; mute checker contrast; edge-blend tile transitions; calmer buildable-pad treatment; water banks.
2. **Entity pass:** raise default/min zoom; un-rotate baked sprites (weapon-layer rotation or 8 pre-baked facings); enemy scale bump; elite/affix markers; status icon strip; stun visual; boss ground telegraphs.
3. **Feedback pass:** toast queue with lanes; kill feed moved off the enemy lane; damage-number pool sized for splash volleys (80 slots churns under cannon/rocket volleys — `particles.ts:63–116`).
4. Hook world events to visible weather ("Heavy Rain" must rain); make quality tiers degrade gracefully instead of deleting night/shadows/weather.

### P2 — One identity (≈2–4 weeks, requires the A/B decision below)
1. Single palette module → CSS tokens + renderer + configs; accent reduction; recolor 11 towers / 13 enemies / abilities inside sanctioned ramps; re-theme sci-fi names to medieval-arcane equivalents (Tesla→Storm Spire, Laser→Sunbrand/Beacon, Rocket→Mortar Battery, Tactical Nuke→Cataclysm, EMP→Null Ward, etc.).
2. Twilight/torch lighting as the campaign look; Bastion gate landmark structure on maps; Grim Dark finished as the earned prestige style.
3. One single-color SVG icon set (extend the 9 title icons) replacing emoji/ASCII/swatches everywhere — including real tower icons in the build dock.
4. World map re-art; brief screen de-striped and widened; Settings rebuilt with custom controls.
5. Type scale, spacing/radius tokens, one button/card/tooltip system; eliminate `!important` patches and duplicate blocks.

### P3 — Polish & cohesion (ongoing)
- Screen transitions (currently impossible: every screen change wipes `root.innerHTML` — `uiManager.ts:245`); victory/defeat ceremony art; minimap legibility; hero folded into the atlas sprite style; tier/branch sprite variants; cosmetics that visibly read; seasonal/biome variation building on the unused desert biome and seasons material; colorblind mode extended to sprites/FX (currently tiles-only).

---

## The decision required

Everything in P2 hinges on one call:

- **Option A — Enforce the Art Bible** (recommended): moonlit, grounded, two-accent, medieval. Drag gameplay and menus toward the title screen. It is differentiated, the title screen proves it works, the key art already exists, and most of the work is palette/lighting/config routing — not re-spriting.
- **Option B — Embrace Cozy Forest:** rewrite the Art Bible around the shipped aesthetic and re-art the title/key art to match.
- A hybrid ("cozy by day, bible by night") is viable but roughly doubles the palette work.

P0 and P1 are direction-neutral and can start immediately.

---

## Appendix A — Screen-by-screen playthrough notes

| Screen | Verdict | Key observations |
|---|---|---|
| Title | Excellent | Painted backdrop, strong type, crafted SVG icons; dimmed War Room entry nearly invisible; 12 interactive items vs. doc's 6; menu centered vs. doc's "lower-left, never centered" |
| Settings | Weak | Native checkboxes/selects/scrollbars; inverted checkbox alignment; premium copy leak; keybind grid is the best part |
| Achievements | Mid | Emoji icons; locked cards below readable contrast; card grid itself fine |
| Research Lab | Weak | "Needs starting_gold@1" raw ids; no icons; no tree visualization; locked cards near-invisible |
| Encyclopedia | Mid | Candy-colored entry names (per-tower accents); camelCase ids in meta lines; zero imagery anywhere; detail row adds one line over the card |
| Commander Profile | Mid | Flat stat cards; "warden" raw id; no portrait/rank visual |
| World map | Worst screen | Empty void, ellipse blobs, Georgia fonts, faint lines; sidebar competent |
| Mission brief | Mid | Good lore copy; scanline stripes artifact; emoji hero portrait; narrow column in a void |
| Gameplay | Core problem | Checkerboard dominates; "Forest Night"/"Heavy Rain" invisible; entities tiny; swatch-only build dock; 8.7px HUD labels; kill feed on enemy lane; minimap unreadable |
| Tower panel | Good bones | Clear stats/branches/targeting/sell+undo; no imagery; overlapped by dev panel (z-order) |
| Relic overlay | Broken | Panel background transparent (`--surface` bug) — confirmed visually; relic name/effect mismatches live |
| Boss fight | Mixed | Banner + boss bar good; boss is a 30px lump; achievement popup collided with intro; untelegraphed gate damage |
| Hero panel | Mid | Talent cards fine; emoji portrait; rebuilt per frame (hover states die) |
| Pause | Broken UX | No visible paused state beyond tiny button highlight |
| Victory / summary | Flat | Cinematic banner never visible (covered same frame); summary reads like a receipt ("Gold earned 80" beside run gold 7,499) |

## Appendix B — Rendering pipeline facts (for reference)

- 3 canvases: main world (`{alpha:false}`), DOM minimap, offscreen sprite atlas. DPR capped at 2 (1 on low quality). No terrain cache — full tile repaint every frame (`renderer.ts:411–492`).
- Sprites: 24×24 logical px at 2px per logical px (48px cell); towers 4 idle + 2 attack frames; enemies 4 walk frames; outline + baked (+1,+1) shadow imply top-left key light — broken by free rotation toward targets.
- Two divergent shade utilities (`renderer.ts:1367` vs `pixelPaint.ts:103`) plus a third highlight method; only one true blend mode in the whole layer (`screen` for bastion lights, `renderer.ts:348`); glow language otherwise faked with `shadowBlur` (expensive, per-primitive).
- Particle system: flat circles only, alpha=life, 4,000-slot pool; no `globalCompositeOperation`; weather split — rain is world-space, mist is screen-space (zoom changes one, not the other, `renderer.ts:368–390` vs `1290–1304`).
- Camera: zoom 0.45–2.2 (auto-fit expands min); wheel zoom cursor-anchored; shake accumulator + impact zoom punches; cinematic flyTo with failsafes; **no hitstop** anywhere.
- Quality tiers remove art, not just cost: night overlay, weather, entity shadows, tile speckles, trails, motion blur, bastion lights all gated to medium/high.

## Appendix C — Docs-vs-config gaps (top items)

1. Ship style is the forbidden aesthetic (ART_BIBLE forbidden keywords vs `artThemes.ts:45`); compliant Grim Dark locked and unobtainable.
2. Sci-fi layer vs "late medieval, no firearms" (`WORLD_OVERVIEW.md` Technology).
3. "Never use saturated colors" vs system-wide neons (`#7dff6a`, `#ffe066`, `#ff4d6d`, `#ff4444`, `#6dffb0`, `#ff6aaa`).
4. Two sanctioned accent hues vs ~9 hue families in configs.
5. "Red = danger, gold = importance" inverted (laser tower `#ff4d6d`; siege enemies gold `#d4a040/#d4a050`).
6. Night/moonlit identity exists only on the title screen; biome skies are bright daylight pastels (`biomes.ts` skyBottom `#c8d8b0`, `#e8f0f8`, `#f0d8a0`).
7. Landmark language ("every map must contain landmarks"; the Great Tree as franchise symbol) absent from all gameplay maps.
8. Main menu spec (6 items, lower-left, wooden signboards) vs TitleUI (12 items, centered hero button).
9. Faction docs define 3 factions and forbid adding more; configs ship 4 with different names.
10. Forbidden vocabulary in shipping content: "Epic" (`bosses.ts:55`), "Legend/legend" (mission, difficulty, title copy), "Corrupted Forest," "Abandoned Village" (vs "nothing should feel abandoned"), "Dragon Tooth."
11. Docs reference eight files that don't exist (GAMEPLAY.md, TOWERS.md, ENEMIES.md, WEATHER.md, HUD.md, SETTINGS.md, RESEARCH.md, CAMPAIGN.md); `TitleUI.ts:50` cites an archived doc path.

## Appendix D — Content scale (visual identity coverage)

| System | Count | Bespoke visual identity? |
|---|---|---|
| Towers | 12 | Yes — pixel sprite + color/accent each; but zero tier/branch visuals |
| Upgrade branches | 44 named choices | Only 4 towers get real spec skins (`towerSpecs.ts:45–89`); 7 fall through generic |
| Enemies | 13 (+6 deprecated aliases) | Distinct silhouettes; elites/affixes invisible |
| Bosses | 3 (10 phases, 6 abilities) | 2 of 3 reuse miniboss/boss sprites; emoji icons |
| Heroes | 1 | Emoji portrait; bespoke vector draw outside atlas style |
| Biomes | 5 (1 unused) | Tint + 2 sky colors only |
| Maps | 7 | Waypoints only; no landmarks |
| Campaign | 1 campaign, 4 regions, 9 missions | World-map node enum is the only visual hook |
| Relics | 15 | Names only — no icons/colors; id↔name bug |
| Synergies | 8 | Label strings only |
| Factions | 4 | Accent hex only ("gameplay identity, not VFX pass") |
| Art styles / path themes / skins | 2 / 4 / 3 | Grim Dark unobtainable; skins are single tint overlays |

*Report ends. Nothing has been implemented; P0/P1 are safe to start on approval; P2 awaits the A/B direction decision.*
