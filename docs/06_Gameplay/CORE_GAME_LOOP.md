# Core Game Loop

Status: Approved

Version: 1.0

Owner: Game Design

---

# Purpose

This document defines the primary gameplay loop of Bastion Defense.

Every feature in the game should strengthen this loop.

If a mechanic exists outside this loop, it must have a compelling reason.

---

# Design Goals

The gameplay loop should:

- Be immediately understandable.
- Encourage strategic thinking.
- Reward experimentation.
- Create long-term mastery.
- Generate replayability.

Players should always feel they could improve their strategy.

---

# The Core Loop

```
Observe

↓

Plan

↓

Build

↓

Prepare

↓

Defend

↓

Adapt

↓

Recover

↓

Upgrade

↓

Repeat
```

Each step naturally flows into the next.

---

# 1. Observe

The player studies:

- Enemy composition
- Enemy resistances
- Enemy speed
- Enemy routes
- Terrain
- Existing defenses

No building occurs before observation.

---

# 2. Plan

The player creates a strategy.

Questions include:

- Where is the choke point?
- Which tower covers the longest path?
- Which enemies are the biggest threat?
- Should economy be prioritized?

Planning should always feel rewarding.

---

# 3. Build

The player spends resources.

Possible actions:

- Place towers
- Upgrade towers
- Build walls
- Place traps
- Recruit defenders

Every placement matters.

---

# 4. Prepare

Before combat begins the player can:

- Rotate camera
- Inspect enemies
- Review tower coverage
- Reposition heroes
- Spend remaining resources

Preparation time should never feel rushed.

---

# 5. Defend

The wave begins.

Player actions include:

- Activate abilities
- Repair structures
- Reposition heroes
- Trigger emergency defenses
- Monitor weak areas

The battlefield should remain readable at all times.

---

# 6. Adapt

No plan survives perfectly.

The player reacts to:

- Unexpected enemy combinations
- Broken defenses
- Resource shortages
- Hero injuries
- New priorities

Adaptation separates beginners from experts.

---

# 7. Recover

After the wave:

Repair damage.

Collect rewards.

Analyze failures.

Prepare for the next wave.

Recovery creates pacing between battles.

---

# 8. Upgrade

Permanent improvements include:

Tower upgrades.

Technology unlocks.

Hero progression.

New defenses.

Economic investments.

Each upgrade should unlock new strategies.

---

# Repeat

Every loop increases complexity.

The player gains knowledge.

The enemies become stronger.

Strategies evolve.

The Bastion grows.

---

# Player Questions

At every moment the player should know:

What is happening?

Why is it happening?

What can I do?

What should I improve next?

---

# Failure States

Players lose because of:

Poor planning.

Poor positioning.

Poor resource management.

Failure should never feel random.

---

# Success States

Players win because they:

Built efficiently.

Adapted quickly.

Created synergies.

Managed resources wisely.

---

# Dependencies

Depends on

GAMEPLAY_PILLARS.md

WORLD_OVERVIEW.md

UI_PHILOSOPHY.md

Referenced by

All gameplay systems.

Campaign mode.

Endless mode.

Challenge mode.

Tutorial.

---

# Success Criteria

Every completed wave should leave the player thinking:

"My strategy worked...

...but I already know how I'll improve it next time."