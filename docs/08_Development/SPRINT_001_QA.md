# SPRINT-001 — Gameplay Stabilization QA

## Status: Ready for external alpha playtest

Browser smoke + code audit completed. Production `npm run build` green.

---

## Bugs fixed (pass 1 + pass 2)

| Area | Fix |
|------|-----|
| Continue / campaign | Restores `missionRuntime`, `missionBossKilled`, bridges, session stats |
| Mid-wave Continue | Abandons remainder (no wave replay / no double kill-gold) |
| Continue banked gold | `resetRunState({ consumeBank: false })` — no longer wipes bank |
| Pause during relic/research | Blocked until choice finishes (prevents soft-lock) |
| Quit during choice | Blocked with toast |
| Relic overlay | Skip dismiss path |
| Stealth | Non-detector towers cannot lock invisible enemies |
| Walls + gaps | Gap tiles walkable for path BFS |
| Bridge destroy | Repaths ground enemies + toast |
| Confirm Upgrade | Setting wired |
| Boss spoils | Per-boss grants |
| Explosive death | Splash kills resolve immediately |
| Targeting cycle | Does not overwrite type defaults |
| Hero talent / abilities / env | Pending talent, ability CDs, runTime, auto, speed, prepare restored |
| Gate HUD | Shows `ceil` lives so fractional HP never displays as 0 while alive |
| Sell undo | Decrements `towersSold` |

## Perf (top 3)

1. HUD DOM node cache + kill-feed dirty check  
2. Throttled `selectTarget` inspect (200ms)  
3. Projectile → tower lookup via `Map`

## Balance

- Arrow fire rate slightly down; Magic cost 110; Laser beam DPS down  
- Scout slower/sturdier; Brute less armor / better gold  
- Wave clear / flawless bonuses up slightly  

## UX

- Tower panel: Target + Apply to Type  
- Pause: live run stats; lean actions  
- Relic: Skip allowed  
- Tooltips on build / upgrade choices  

## Manual QA (browser smoke)

- [x] Main Menu loads  
- [x] Campaign → brief → HUD  
- [x] Wave prep / auto-start / combat / kill feed / gold feedback  
- [x] Hero combat  
- [x] Pause → Settings → Back → Resume  
- [x] FPS stable (~120 idle / light combat)  
- [ ] Full tower place/upgrade/sell (manual — camera click precision)  
- [ ] Continue after quit mid-run  
- [ ] Boss + relic pick  
- [ ] Endless mode  
- [ ] Defeat → menu  

## How to run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. DEV tools: **F8**.
