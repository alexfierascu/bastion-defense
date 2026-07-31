# Milestone 6 — Internal Gameplay Audit

Generated for the Steam Quality Pass. No new content; classify and repair.

## Legend

| Tag | Meaning |
|-----|---------|
| Complete | Ships as intended |
| Needs Improvement | Works; polish/balance/perf gaps |
| Broken | Promised UX missing or incorrect |
| Placeholder | Label/API without real gameplay |

---

## Systems

| System | Status | Action taken in M6 |
|--------|--------|-------------------|
| Core combat / towers / projectiles | Complete | Perf: active buffer reuse; pool caps raised |
| Enemy AI / abilities | Complete | — |
| Wave generator | Needs Improvement | Mode + faction/director already wired |
| Campaign world map | Complete | — |
| Mission: standard / survive / boss / night / events | Complete | — |
| Mission: escort / protect / multiGate | Placeholder → Complete | Real runtime objectives added |
| Boss phases | Needs Improvement | `onPhase` wired (banner + minions) |
| Daily challenge board | Broken → Complete | History UI + brief board |
| Run meta / relics / director | Complete | — |
| Save / continue | Complete | — |
| Replay / War Room | Placeholder → Needs Improvement | Rematch-from-seed + export secondary |
| Localization | Placeholder | Deferred (English polish only this pass) |
| Audio | Needs Improvement | Feel cues on place/sell/upgrade; procedural pack |
| Art / themes | Needs Improvement | Grim Dark hidden until ready; minimap palette |
| Achievements | Complete | — |
| HUD / end report | Needs Improvement | Confirm modals, FS icon, blitz gated |
| Steam packaging | Placeholder | Out of scope for code pass |
| Dev / playtest tools | Missing → Complete | `import.meta.env.DEV` only |

---

## Definition of Done checklist

- [x] Broken / Placeholder gameplay systems fixed or made honest
- [x] Interaction feedback (place / sell / upgrade / wave / boss / end)
- [x] UI confirmations no longer use browser `alert`/`confirm`
- [x] Daily board visible (War Room + daily brief)
- [x] Mission objectives persist on HUD (`hud-mission`)
- [x] Performance: pool sizes + no per-frame projectile array alloc
- [x] Dev playtest mode never ships in production builds (dynamic import + `import.meta.env.DEV`)
- [x] Blitz gated behind settings (DEV can still blitz)
- [x] Production `npm run build` green

## Residual (honest deferred)

| Item | Why deferred |
|------|----------------|
| Full localization | Content pass, not M6 systems |
| Recorded SFX pack | Procedural audio remains; new assets out of scope |
| Steam packaging | Store/page/build pipeline |
| Controller map | Future — keyboard/mouse + aria improved |
| Grim Dark art polish | Locked behind campaign; Cozy Forest is ship style |
