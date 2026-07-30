# Animation Guidelines

Status: Approved

Version: 1.0

Owner: Art Direction

---

# Purpose

This document defines every environmental and visual animation used throughout Bastion Defense.

Animation exists to make the world feel alive.

It never exists simply because something can move.

---

# Philosophy

The player should never consciously notice most animations.

Instead, they should feel that the world is breathing.

Movement should create immersion, not distraction.

---

# Principles

Every animation must satisfy at least one of these goals:

Communicate life.

Improve readability.

Increase immersion.

Provide gameplay feedback.

Guide the player's attention.

If none apply, remove the animation.

---

# Animation Categories

Environmental

Ambient

Gameplay

Character

UI

VFX

Each category follows different timing but the same philosophy.

---

# Environmental Animation

Always subtle.

Examples

Trees swaying.

Grass moving.

Leaves falling.

Fog drifting.

Clouds moving.

Torch flames.

Smoke.

Flowing water.

Nothing should remain perfectly still.

---

# Idle Motion

Large objects move less.

Small objects move more.

Examples

Castle

No movement.

Bridge

Minimal movement.

Tree

Gentle sway.

Grass

Constant movement.

Flowers

Soft movement.

Torch

Continuous flicker.

---

# Timing

Avoid synchronized loops.

Every animation should begin at a random phase.

Animation lengths should vary.

Example

Grass

4–8 seconds.

Tree branches

6–14 seconds.

Torch flames

0.3–0.8 seconds.

Fog

20–60 seconds.

Clouds

90–240 seconds.

---

# Wind

Wind affects:

Grass.

Flowers.

Branches.

Leaves.

Smoke.

Flags.

Canvas.

Fire.

Wind never affects stone.

---

# Fire

Fire should never repeat.

Brightness changes.

Height changes.

Shape changes.

Color changes.

Movement remains believable.

---

# Water

Water always moves.

Slow rivers

Smooth movement.

Fast rivers

Visible turbulence.

Rain

Ripples.

Wind

Surface distortion.

---

# Fog

Fog should:

Drift slowly.

Reveal depth.

Never obscure gameplay.

Remain subtle.

---

# Clouds

Clouds move slowly.

They should not loop noticeably.

Layer multiple cloud speeds.

---

# Wildlife

Butterflies

Random movement.

Birds

Occasional crossings.

Fireflies

Summer evenings only.

Fish

Occasional surface movement.

Never create repetitive animation cycles.

---

# Architecture

Buildings remain static.

Only attached elements move.

Examples

Flags.

Lanterns.

Chains.

Windmills.

Doors.

Shutters.

Ropes.

---

# UI Animation

UI follows the same philosophy.

Small.

Elegant.

Purposeful.

Hover

150ms.

Open

250ms.

Close

200ms.

Never bounce.

Never overshoot.

---

# Camera Animation

Camera movement is slow.

Smooth.

Weighted.

Never mechanical.

Never instant.

---

# Gameplay Animation

Animations should improve readability.

Examples

Tower rotates before firing.

Enemy prepares attack.

Projectile leaves the tower.

Impact creates feedback.

Everything communicates intent.

---

# Performance

Prefer transform animations.

Avoid layout recalculations.

Reuse animation curves.

Pause off-screen animations when possible.

Target constant 60 FPS.

---

# Accessibility

Reduced Motion Mode

Disables:

Camera sway.

Grass movement.

Fog movement.

Cloud movement.

Menu idle motion.

Retains gameplay-critical animations.

---

# AI Rules

Reject animations that are:

Hyperactive.

Cartoonish.

Elastic.

Attention-seeking.

Overly cinematic.

Accept animations that are:

Natural.

Subtle.

Purposeful.

Readable.

Grounded.

---

# Dependencies

Depends on

ART_BIBLE.md

LIGHTING.md

PARTICLES.md

CAMERA.md

Referenced by

MAIN_MENU.md

GAMEPLAY.md

HUD.md

Every environment.

Every VFX asset.

---

# Success Criteria

If every animation stopped except gameplay, the world would immediately feel dead.

If players actively notice every animation, there are too many.

The correct animation is one that players feel more than they see.