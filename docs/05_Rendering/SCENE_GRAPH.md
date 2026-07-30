# Scene Graph

Status: Approved

---

# Purpose

Defines how every visual element exists in the game.

The application is NOT a website.

The application is a rendered scene.

Everything visible belongs to the scene graph.

---

# Philosophy

Never think in pages.

Think in scenes.

Never think in sections.

Think in layers.

Every object exists independently.

Every object can animate independently.

Every object has its own responsibility.

---

# Scene

Scene

├── Camera
├── Lighting
├── Weather
├── Audio
├── UI
├── Background
├── Midground
├── Foreground
├── Particle System
└── Effects

---

# Background

Sky

Moon

Stars

Far Mountains

Cloud Layer Far

---

# Midground

Great Tree

Fortress

Walls

Gate

Towers

Bridge

Banners

Torches

---

# Foreground

Grass

Flowers

Roots

Small Rocks

Fog

Ground

---

# Dynamic Objects

Fireflies

Leaves

Dust

Embers

Rain

Snow

Birds (optional)

---

# UI

The UI belongs to the world.

It is not placed over the world.

Menus should feel physically attached to locations whenever possible.

---

# Rules

Every node owns:

position

scale

rotation

opacity

animation

parallax factor

visibility

z-index

No node may directly manipulate another node.

Communication happens through systems.