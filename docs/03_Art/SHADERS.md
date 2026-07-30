# Shaders

Status: Approved

Version: 1.0

Owner: Rendering Team

---

# Purpose

This document defines every shader used in Bastion Defense.

Shaders should support the visual identity.

They should never become the visual identity.

Players should notice the world.

Not the rendering technology.

---

# Philosophy

Rendering should feel invisible.

The player should think:

"That fortress feels real."

Never:

"Those shaders look impressive."

Technology serves art.

Art serves gameplay.

---

# Rendering Goals

Priority order

1. Readability
2. Stability
3. Performance
4. Atmosphere
5. Realism

If realism hurts readability,

readability wins.

---

# Visual Style

Grounded.

Natural.

Subtle.

Timeless.

Avoid trends.

Avoid fashionable rendering techniques.

The game should still look good ten years from now.

---

# Material Response

Every material reacts differently to light.

Stone

Low roughness variation.

Diffuse.

Heavy.

Oak

Soft highlights.

Visible grain.

Iron

Sharper reflections.

Dark.

Forged.

Bronze

Warm reflections.

Oxidized edges.

Leather

Soft highlights.

Micro variation.

Canvas

Almost entirely diffuse.

Water

Dynamic reflections.

Wind distortion.

Never use identical values across different materials.

---

# Physically Based Rendering

Use PBR.

Every material should define:

Albedo

Normal

Roughness

Metallic

Ambient Occlusion

Height (optional)

Do not fake materials using color alone.

---

# Surface Variation

Perfect surfaces do not exist.

Stone

Small cracks.

Wood

Fiber variation.

Iron

Hammer marks.

Leather

Stretch marks.

Bronze

Patina.

Variation should remain subtle.

---

# Normal Maps

Support form.

Never replace geometry.

Large forms belong in the mesh.

Fine detail belongs in the normal map.

---

# Ambient Occlusion

Use AO conservatively.

Purpose:

Ground objects.

Improve contact.

Reveal depth.

Never create dirty-looking assets.

---

# Specular Response

Stone

Very low.

Wood

Low.

Leather

Low.

Iron

Medium.

Bronze

Medium.

Water

High.

Specular highlights should reinforce material identity.

---

# Water Shader

Requirements

Reflection.

Refraction.

Soft ripples.

Wind response.

Rain interaction.

Shore blending.

Never create mirror-perfect water.

---

# Wind Shader

Applied to

Grass.

Leaves.

Flowers.

Small branches.

Canvas.

Flags.

Never affect buildings.

Never affect stone.

Movement should remain subtle.

---

# Snow Shader

Supports

Accumulation.

Height blending.

Footprints.

Roof buildup.

Shadow tint.

Snow should appear where gravity allows.

---

# Rain Shader

Wet surfaces.

Darkened stone.

Darkened wood.

Puddles.

Roof runoff.

Soft reflections.

Rain should never reduce gameplay visibility.

---

# Fog Shader

Used for depth.

Never hide gameplay.

Multiple layers.

Soft movement.

Color influenced by time of day.

---

# Shadow Quality

Stable.

Soft.

Predictable.

No shimmering.

No visible aliasing.

Shadows should communicate form.

Not noise.

---

# Color Grading

Use subtle grading.

No cinematic teal/orange.

No extreme LUTs.

Color grading should unify the world.

Not redefine it.

---

# Outline Effects

Reserved for gameplay.

Selected tower.

Hovered building.

Important interaction.

Never outline scenery.

---

# Transparency

Use sparingly.

Examples

Fog.

Smoke.

Water.

Glass.

Canvas edges.

Avoid excessive overdraw.

---

# Performance

Target

60 FPS minimum.

Prefer

GPU instancing.

Shared materials.

Texture atlases.

LOD support.

Avoid

Expensive full-screen effects.

Real-time reflections everywhere.

Unnecessary post-processing.

---

# Accessibility

Reduced Graphics Mode

Disables

Screen-space reflections.

Extra ambient occlusion.

Volumetric fog.

High-quality shadows.

Maintains gameplay readability.

---

# AI Rules

Reject shaders that look:

Plastic.

Overprocessed.

Neon.

Hyper-realistic.

Stylized.

Accept shaders that look:

Natural.

Grounded.

Stable.

Material-aware.

Timeless.

---

# Dependencies

Depends on

ART_BIBLE.md

LIGHTING.md

MATERIALS.md

COLOR_SYSTEM.md

VISUAL_LANGUAGE.md

Referenced by

All environments.

All props.

All towers.

All characters.

All UI materials.

Every gameplay scene.

---

# Success Criteria

A player should immediately recognize the material of every object without touching it.

Shaders should reinforce craftsmanship, age and realism while remaining invisible to the player.