# Environment Art

Status: Approved

Version: 1.0

Owner: Art Direction

---

# Purpose

This document defines how environments are built in Bastion Defense.

Environment Art is responsible for making the world believable.

Every environment should tell a story before gameplay begins.

---

# Philosophy

Environment Art is not decoration.

Environment Art explains:

- Geography
- History
- Civilization
- Nature
- Warfare
- Daily Life

Every asset exists for a reason.

---

# Design Pillars

Every environment combines five elements.

1. Terrain
2. Architecture
3. Nature
4. Atmosphere
5. Storytelling

If one pillar is missing, the scene feels incomplete.

---

# Environment Layers

Each level is composed from multiple readable layers.

Layer 1

Sky

Layer 2

Mountains

Layer 3

Forest

Layer 4

Architecture

Layer 5

Roads

Layer 6

Gameplay Area

Layer 7

Foreground Details

Layer 8

Atmosphere

Every layer should be visually distinct.

---

# Terrain

Terrain should never feel procedural.

Use:

Natural slopes.

Rock formations.

Riverbeds.

Small elevation changes.

Avoid perfectly flat landscapes.

---

# Roads

Roads explain civilization.

Major Roads

Stone.

Wide.

Well maintained.

Secondary Roads

Packed earth.

Narrow.

Village Paths

Natural soil.

Grass growing at the edges.

Roads should naturally guide the player's eye.

---

# Rivers

Rivers create life.

Every river should justify:

Villages.

Bridges.

Fishing.

Trade.

Defense.

Water should always appear to flow naturally.

---

# Bridges

Every bridge has a purpose.

Military.

Trade.

Agriculture.

Maintenance.

Bridges should match nearby architecture.

---

# Forests

Forests feel ancient.

Tree density changes naturally.

Light enters through openings.

Clearings should have a reason.

Never generate random tree placement.

---

# Vegetation

Vegetation reflects usage.

Busy roads

Little vegetation.

Abandoned ruins

Heavy vegetation.

Near rivers

Lush vegetation.

Courtyards

Maintained gardens.

Everything reacts to people.

---

# Cliffs

Cliffs create natural borders.

Avoid invisible walls.

Terrain should explain gameplay limits.

---

# Landmarks

Every map must include memorable landmarks.

Examples

Great Tree.

Bell Tower.

Gatehouse.

Bridge.

Windmill.

Waterfall.

Players should navigate using landmarks.

---

# Storytelling

Every environment should answer:

Who built this?

Who maintains it?

Who uses it?

Why is it here?

What happened here?

If these cannot be answered, redesign the scene.

---

# Human Presence

Evidence of civilization should appear naturally.

Examples

Wheel tracks.

Firewood.

Fences.

Barrels.

Lanterns.

Gardens.

Workshops.

Training grounds.

Never overpopulate scenes.

---

# Signs of War

War leaves scars.

Examples

Broken walls.

Arrow impacts.

Collapsed scaffolding.

Emergency repairs.

Burn marks.

Abandoned siege equipment.

Damage should always have a logical cause.

---

# Weather Integration

Rain creates puddles.

Snow accumulates.

Fog fills valleys.

Wind bends grass.

Leaves collect in corners.

The world reacts to weather.

---

# Lighting Integration

Lighting supports composition.

Warm areas

Civilization.

Cold areas

Nature.

Never illuminate everything equally.

---

# Gameplay Readability

Gameplay areas remain readable.

Trees never hide enemies.

Buildings never block important paths.

Particles never obscure gameplay.

Environment supports gameplay.

---

# Optimization

Reuse modular assets.

Use decals for variation.

Minimize draw calls.

Prefer instancing.

Reduce unique materials.

LOD transitions should be invisible.

---

# AI Rules

Every generated environment must answer:

Could people realistically live here?

Does the terrain make sense?

Does every structure have a purpose?

Does nature belong here?

Is the scene immediately readable?

If any answer is "No", redesign the environment.

---

# Dependencies

Depends on

ART_BIBLE.md

MATERIALS.md

COMPOSITION.md

LIGHTING.md

ARCHITECTURE.md

NATURE.md

Referenced by

All gameplay maps.

Campaign missions.

Main Menu.

Cutscenes.

Concept Art.

---

# Success Criteria

A player should pause simply to admire the environment.

Without dialogue or gameplay, the world should communicate:

"This place has existed for centuries, and people still call it home."