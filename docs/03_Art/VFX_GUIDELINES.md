# VFX Guidelines

Status: Approved

Version: 1.0

Owner: Art Direction

---

# Purpose

This document defines every visual effect used throughout Bastion Defense.

Visual effects exist to improve gameplay readability, reinforce impact and make the world feel alive.

VFX never exist purely for spectacle.

---

# Philosophy

The player should understand gameplay before admiring the effects.

Every effect should answer one question:

"What information does this communicate?"

If the answer is "nothing", remove the effect.

---

# Pillars

Every effect should satisfy at least one objective.

• Improve readability

• Reinforce impact

• Show cause and effect

• Increase immersion

• Support atmosphere

Never create effects only because they look cool.

---

# Categories

Environment

Weather

Combat

Tower Effects

Enemy Effects

Construction

Destruction

Magic (future only)

UI

---

# Environmental Effects

Always subtle.

Examples

Dust

Leaves

Fog

Smoke

Embers

Rain

Snow

Pollen

Mist

These effects should never distract from gameplay.

---

# Combat Effects

Every attack consists of four phases.

Preparation

↓

Projectile

↓

Impact

↓

Recovery

Each phase should be visually distinct.

---

# Projectile Effects

Projectile effects must remain readable.

Arrow

Simple motion blur.

Ballista

Heavy trail.

Cannon

Smoke burst.

Fire

Small ember trail.

Poison

Soft green particles.

Never obscure the battlefield.

---

# Impact Effects

Every impact should communicate material.

Stone

Dust

Fragments

Small debris

Wood

Splinters

Dust

Leaves

Metal

Sparks

Small fragments

Soil

Dust

Pebbles

Grass

Water

Splash

Ripples

Mist

Different materials require different effects.

---

# Tower Effects

Tower VFX communicate power.

Weak towers

Minimal effects.

Powerful towers

Larger effects.

Legendary towers

Unique silhouettes.

Effects should never replace gameplay clarity.

---

# Enemy Effects

Enemies communicate state.

Idle

Almost no effects.

Moving

Dust.

Attacking

Wind-up effect.

Burning

Smoke.

Poisoned

Green particles.

Frozen

Light frost.

Stunned

Stars or cartoon symbols are forbidden.

---

# Weather Effects

Rain

Thin streaks.

Ground splashes.

Roof drips.

Snow

Layered flakes.

Accumulation.

Wind influence.

Fog

Slow movement.

Depth separation.

Storm

Occasional lightning.

Never excessive.

---

# Fire

Fire consists of:

Flame.

Glow.

Smoke.

Embers.

Heat distortion.

Every component should be subtle.

---

# Smoke

Smoke rises.

Expands.

Slows.

Dissolves.

Never loops obviously.

---

# Dust

Dust reacts to movement.

Projectiles.

Construction.

Destruction.

Walking.

Wind.

Dust should remain low to the ground.

---

# Construction Effects

Building placement

Dust.

Workers.

Wood movement.

Hammer particles.

Construction should feel physical.

---

# Destruction Effects

Buildings never disappear instantly.

Sequence

Impact.

Cracks.

Debris.

Dust.

Collapse.

Silence.

Every destruction event should have weight.

---

# Particle Lifetime

Very Small

0.2–0.5 sec

Small

0.5–1 sec

Medium

1–3 sec

Large

3–6 sec

Fog

20–90 sec

Avoid unnecessarily long lifetimes.

---

# Performance

Use particle pooling.

GPU particles where appropriate.

LOD particle systems.

Distance culling.

Limit overdraw.

Avoid expensive transparency.

---

# Accessibility

Reduced Effects Mode

Removes

Excess dust

Extra embers

Decorative particles

Keeps

Gameplay-critical effects

Projectile visibility

Enemy state indicators

Impact feedback

---

# AI Rules

Reject effects that are:

Flashy.

Neon.

Arcade-like.

Oversaturated.

Screen-filling.

Accept effects that are:

Grounded.

Purposeful.

Readable.

Subtle.

Material-aware.

---

# Dependencies

Depends on

ART_BIBLE.md

LIGHTING.md

MATERIALS.md

ANIMATION_GUIDELINES.md

PARTICLES.md

Referenced by

GAMEPLAY.md

TOWERS.md

ENEMIES.md

MAIN_MENU.md

WEATHER.md

---

# Success Criteria

Players should immediately understand what happened by looking only at the visual effects.

Effects should communicate gameplay first and beauty second.

The battlefield should always remain readable.