# Enemy Philosophy

Status: Approved

Version: 1.0

Owner: Game Design

---

# Purpose

This document defines the design philosophy behind every enemy in Bastion Defense.

Enemies are not obstacles.

Enemies are puzzles.

Every enemy should force the player to think differently.

---

# Philosophy

Enemies should challenge strategies.

Not reactions.

Every new enemy should ask a new question.

If two enemies create the same decision,

one should be redesigned.

---

# Design Goals

Enemies should:

Create interesting choices.

Encourage adaptation.

Punish tunnel vision.

Promote tower diversity.

Remain readable.

Reward preparation.

---

# Enemy Formula

Every enemy must define:

Role.

Health.

Movement Speed.

Armor.

Threat Level.

Priority.

Counterplay.

Synergies.

Weaknesses.

Visual Identity.

---

# Enemy Roles

## Grunt

The baseline enemy.

Teaches mechanics.

Appears frequently.

Low threat individually.

Dangerous in numbers.

---

## Tank

High durability.

Slow movement.

Consumes tower attention.

Punishes low sustained damage.

---

## Runner

Fast.

Low health.

Punishes poor coverage.

Rewards prediction.

---

## Siege Unit

Targets structures.

Ignores distractions.

High priority target.

---

## Support

Improves nearby enemies.

Buffs.

Healing.

Armor.

Speed.

Must become a priority target.

---

## Summoner

Creates additional enemies.

Increases battlefield complexity.

Low direct damage.

High strategic value.

---

## Flying

Ignores terrain.

Requires specialized defenses.

Never appears without warning.

---

## Elite

Rare.

Mechanically unique.

Requires adaptation.

Should feel memorable.

---

## Boss

Tests everything learned so far.

Never relies on inflated statistics.

Always introduces unique mechanics.

---

# Counterplay

Every enemy must have:

At least one strong counter.

At least one weak matchup.

At least one alternative strategy.

No enemy should require exactly one solution.

---

# Synergy

Enemies should become dangerous together.

Examples

Tank

+

Healer

Runner

+

Support

Flying

+

Ground Swarm

Shield Bearer

+

Siege Unit

Groups create interesting decisions.

Not individual stats.

---

# Wave Design

Difficulty comes from composition.

Not numbers.

Later waves introduce:

More combinations.

Better formations.

Smarter timing.

Mixed priorities.

---

# Readability

Players should immediately identify:

Role.

Threat.

Movement.

Attack style.

Priority.

Recognition should happen in less than one second.

---

# Visual Identity

Every enemy needs:

Unique silhouette.

Unique movement.

Unique sound.

Unique death animation.

Unique attack.

Never rely only on color.

---

# Spawn Philosophy

Players deserve preparation.

Never spawn dangerous enemies without information.

Players should have time to adapt.

---

# Scaling

Enemies become harder by:

Better cooperation.

New abilities.

Improved formations.

Environmental interaction.

Never by multiplying health endlessly.

---

# AI Rules

Before approving a new enemy ask:

Does it create a new decision?

Does it change player strategy?

Does it have clear counterplay?

Can players understand it immediately?

Would experienced players enjoy fighting it?

If any answer is "No",

redesign it.

---

# Dependencies

Depends on

GAMEPLAY_PILLARS.md

DIFFICULTY_PHILOSOPHY.md

PLAYER_EXPERIENCE.md

TOWER_PHILOSOPHY.md

Referenced by

All enemy documents.

Wave generation.

Boss design.

Campaign.

Endless Mode.

Balancing.

---

# Success Criteria

Players should fear enemy combinations,

not individual enemies.

The best strategy should constantly evolve as new enemy compositions appear.