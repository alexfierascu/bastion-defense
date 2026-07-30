# Main Menu

Status: Approved

Version: 1.0

Owner: Creative Direction

---

# Purpose

This document defines the complete Main Menu experience.

The Main Menu is not a screen.

It is the player's first visit to the world.

Everything should communicate quality before the player clicks a button.

---

# Experience Goals

The player should immediately feel:

Safe.

Curious.

Small.

Welcome.

Prepared.

The player should spend several minutes simply looking around.

---

# Design Philosophy

The Main Menu should resemble a cinematic establishing shot.

It should not resemble:

- A website
- A launcher
- A dashboard
- A mobile menu

The menu is simply another scene inside the game world.

---

# Scene Composition

```
                    Moon

              Slow Clouds

      Mountain Silhouette

             The Bastion

          Warm Gate Torches

       Great Tree (left side)

 Bridge -------------------------

Foreground Grass

Foreground Flowers

Fog

Menu
```

---

# Camera

Default Position

Outside the southern bridge.

Looking toward the Main Gate.

Perspective

Slightly below the fortress.

The Bastion should appear dominant.

Camera Angle

Approximately 8° upward.

Never perfectly horizontal.

---

# Camera Behaviour

Idle Zoom

100%

↓

100.25%

↓

100%

Duration

40 seconds.

Mouse Movement

Maximum horizontal movement

16px

Maximum vertical movement

10px

Always smoothed.

Never instant.

---

# Scene Layers

Layer 1

Sky

Layer 2

Moon

Layer 3

Clouds

Layer 4

Mountains

Layer 5

Forest

Layer 6

The Bastion

Layer 7

Torches

Layer 8

Bridge

Layer 9

Grass

Layer 10

Flowers

Layer 11

Fog

Layer 12

Particles

Layer 13

Menu

Every layer moves independently.

---

# Menu Placement

The menu belongs to the lower-left portion of the screen.

Never centered.

The fortress remains the hero.

The UI is secondary.

---

# Logo

Placed above the menu.

Large.

Simple.

No glow.

No gradients.

No bevel.

The logo should feel carved.

Not digitally designed.

---

# Menu Items

Continue

New Campaign

Load Game

Settings

Credits

Exit

Spacing should be generous.

Never stack items tightly.

---

# Button Design

Buttons are wooden signboards.

Bronze corner reinforcements.

Subtle wood grain.

Slight edge wear.

Soft shadow.

No heavy borders.

---

# Button States

Idle

Natural.

Hover

Slight lift.

Slight brightness increase.

Torch reflection intensifies.

Pressed

Moves down 2px.

Small shadow reduction.

Disabled

Lower contrast.

Reduced saturation.

---

# Hover Behaviour

Hover duration

150ms

Movement

Translate Y -2px

Scale

1.01

Never bounce.

Never overshoot.

---

# Click Behaviour

Small sound.

Small movement.

Short fade.

Camera begins transition only after click completes.

---

# Ambient Animation

Always active.

Torch flicker.

Fog drift.

Grass movement.

Leaf movement.

Cloud movement.

Fireflies (summer only).

Floating embers.

Nothing stops while menus are open.

---

# Lighting

Primary

Moonlight.

Secondary

Torchlight.

Menu receives subtle warm light.

No artificial UI glow.

---

# Audio

Start with silence.

After 2 seconds

Wind.

After 4 seconds

Torch crackle.

After 6 seconds

Leaves.

After 10 seconds

Music begins.

Music should fade in over 6 seconds.

---

# Music

Slow.

Orchestral.

Minimal.

No choir.

No combat.

No percussion.

The menu should feel peaceful.

---

# Performance

Target

60 FPS

Animation budget

Minimal CPU usage.

Transforms only.

No layout recalculations.

Avoid expensive filters.

---

# Accessibility

Keyboard navigation.

Visible focus indicators.

Reduced motion mode.

Mute ambient audio.

Independent music volume.

Scalable text.

---

# AI Rules

Never redesign the menu into a modern application.

Never center everything.

Never place UI over the fortress.

Never hide the environment.

The environment is always the hero.

The menu simply provides interaction.

---

# Cursor Implementation Notes

Suggested Structure

Scene

├── Camera

├── Sky

├── Moon

├── Clouds

├── Mountains

├── Forest

├── Bastion

├── Great Tree

├── Gate

├── Torches

├── Bridge

├── Grass

├── Fog

├── Particles

└── MainMenu

Each element should exist as its own component.

No single background image should contain multiple independently animated objects.

---

# Dependencies

Depends on

WORLD_OVERVIEW.md

THE_BASTION.md

ART_BIBLE.md

SCENE_GRAPH.md

CAMERA.md

LIGHTING.md

PARTICLES.md

UI_PHILOSOPHY.md

Referenced by

HUD.md

SETTINGS.md

CAMPAIGN.md

---

# Success Criteria

The player should recognize Bastion Defense from a screenshot of the Main Menu alone.

Without reading the title.

Without seeing the logo.

Without interacting.

The scene itself should communicate the identity of the game.