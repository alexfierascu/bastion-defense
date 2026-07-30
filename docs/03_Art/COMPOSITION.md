# Composition

Status: Approved

Version: 1.0

Owner: Art Direction

---

# Purpose

This document defines how every scene in Bastion Defense is composed.

Composition is responsible for guiding the player's eye before lighting, animation or color.

A good composition should remain readable as a black silhouette.

---

# Design Goals

Every scene must immediately communicate:

- Where the player should look.
- Where the action is happening.
- Where the Bastion is.
- What is important.
- What is background.

If the eye does not naturally travel through the scene, the composition has failed.

---

# Composition Hierarchy

Every screen follows this order:

1. Hero Subject
2. Secondary Subject
3. Supporting Elements
4. Foreground
5. Background
6. Atmosphere

Never create two competing hero subjects.

---

# Hero Subject

Every screen has exactly one.

Examples:

Main Menu

The Bastion

Gameplay

Enemy Wave

Upgrade Screen

Selected Tower

Settings

Active Panel

Nothing should visually compete with the hero subject.

---

# Rule of Thirds

Whenever possible:

- Hero subjects align to thirds.
- Horizons never sit exactly in the middle.
- Vertical structures break symmetry.

Perfect centering should only be used intentionally.

---

# Leading Lines

Guide the player naturally.

Examples:

- Roads
- Bridges
- Walls
- Rivers
- Shadows
- Tree lines

Every major line should eventually lead toward the Bastion or gameplay objective.

---

# Framing

Foreground objects should frame important subjects.

Examples:

- Trees
- Gate pillars
- Towers
- Banners
- Branches

Never block important gameplay.

---

# Negative Space

Empty space is valuable.

It creates:

- Focus
- Scale
- Calm
- Readability

Do not fill every corner with detail.

---

# Depth Layers

Every environment should contain:

Layer 1

Foreground

Layer 2

Midground

Layer 3

Hero Subject

Layer 4

Background

Layer 5

Sky

Layer 6

Atmospheric Effects

These layers should remain visually distinct.

---

# Scale

Large objects should emphasize the player's size.

Examples:

- Walls
- Trees
- Towers
- Gates

Human-scale details should only appear when the player gets closer.

---

# Visual Rhythm

Alternate between:

Large

↓

Medium

↓

Small

Avoid repetitive spacing.

Avoid identical building sizes.

Nature should break architectural repetition.

---

# Camera Framing

Never clip landmarks.

The Great Tree should always remain readable.

The Main Gate should dominate its surroundings.

The player should immediately recognize where they are.

---

# Gameplay Composition

Gameplay readability is always more important than realism.

Enemy paths must remain obvious.

Tower silhouettes must remain clear.

Projectiles must never visually merge with the background.

---

# Menu Composition

The Main Menu is the reference composition for the entire project.

Composition order:

1. Bastion
2. Great Tree
3. Main Gate
4. Bridge
5. Foreground Grass
6. Fog
7. Mountains
8. Moon

The UI occupies only a small portion of the frame.

---

# AI Rules

When generating scenes ask:

What is the hero subject?

What guides the eye?

Is there unnecessary clutter?

Could I remove 30% of the objects without losing meaning?

If yes, simplify.

---

# Dependencies

Depends on

ART_BIBLE.md

LIGHTING.md

CAMERA.md

WORLD_OVERVIEW.md

Referenced by

Every environment

Every menu

Every gameplay map

Every concept illustration

---

# Success Criteria

The player's eye should naturally reach the intended focal point within one second without relying on UI, arrows or text.