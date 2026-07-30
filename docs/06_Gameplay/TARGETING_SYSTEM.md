# Targeting System

Status: Approved

Version: 1.0

Owner: Gameplay Engineering

---

# Purpose

This document defines how towers select, prioritize and switch targets.

Targeting is one of the most important strategic systems in Bastion Defense.

The player should feel responsible for choosing the correct targeting logic.

---

# Philosophy

A tower is only as effective as the decisions it makes.

Better targeting should outperform higher damage.

Players should be rewarded for understanding enemy behavior.

---

# Design Goals

The targeting system should:

Reward planning.

Be predictable.

Remain readable.

Allow advanced strategies.

Never surprise the player.

---

# Default Targeting

Every tower has a default targeting mode.

Arrow Tower

First

Ballista

Strongest

Cannon

Largest Cluster

Support Tower

Closest Ally

Barracks

Nearest Enemy

These defaults may change during balancing.

---

# Targeting Modes

## First

Prioritize the enemy closest to the exit.

Best against:

Fast enemies.

Runners.

Leaking enemies.

---

## Last

Prioritize the enemy furthest from the exit.

Useful for:

Cleaning leftovers.

Weak enemies.

Economy towers.

---

## Closest

Attack the nearest enemy.

Reliable.

Simple.

Useful for short-range towers.

---

## Furthest

Attack the furthest enemy inside range.

Useful for:

Opening damage.

Long-range support.

---

## Strongest

Highest effective health.

Best against:

Tanks.

Bosses.

Elite enemies.

---

## Weakest

Lowest remaining health.

Improves efficiency.

Useful for cleanup.

---

## Fastest

Highest movement speed.

Counters:

Scouts.

Runners.

Flying swarms.

---

## Slowest

Lowest movement speed.

Useful for:

Area control.

Splash towers.

---

## Highest Threat

Uses an internal threat score.

Factors include:

Boss.

Siege unit.

Support unit.

Summoner.

Hero killer.

Threat score is visible to players.

---

## Manual Priority

Players may manually prioritize specific enemy types.

Examples

Flying

Bosses

Summoners

Siege Units

Support Units

Armored Units

Manual priorities override automatic logic.

---

# Threat Score

Threat is calculated from:

Objective damage.

Health.

Abilities.

Support value.

Movement speed.

Wave role.

Threat calculation should remain deterministic.

---

# Target Switching

Towers should switch targets only when:

Current target dies.

Current target leaves range.

Player changes targeting mode.

A significantly higher priority target appears.

Avoid excessive switching.

---

# Smart Targeting

Optional upgrade.

Allows towers to:

Ignore nearly dead enemies.

Coordinate with nearby towers.

Reduce overkill.

Prioritize dangerous targets.

Smart targeting should feel intelligent,

not magical.

---

# Readability

Current targeting mode must always be visible.

Players should never wonder:

"Why did that tower attack this enemy?"

Every targeting decision should be explainable.

---

# Upgrade Interaction

Some upgrades unlock:

New targeting modes.

Multiple target priorities.

Predictive targeting.

Support coordination.

Target marking.

Upgrades should create new strategies.

---

# Performance

Target acquisition should remain lightweight.

Use cached enemy lists.

Avoid scanning every enemy every frame.

Prioritize deterministic behavior.

---

# AI Rules

When designing a targeting mode ask:

Does it create a new decision?

Can the player understand it?

Does it solve a unique problem?

Does it avoid replacing another targeting mode?

If any answer is "No",

redesign it.

---

# Dependencies

Depends on

TOWER_PHILOSOPHY.md

ENEMY_PHILOSOPHY.md

GAMEPLAY_PILLARS.md

Referenced by

All tower implementations.

Tower upgrades.

Balancing.

Enemy AI.

Gameplay UI.

---

# Success Criteria

Experienced players should win battles through superior targeting decisions,

not simply by building more towers.