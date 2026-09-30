# Basin 1.6 km defect: static review and pending independent capture

## Superseding implementation notification

Controller reports Main replaced the screen-door/unshaded approach with shaded two-sided rendering and `if (!FRONT_FACING) NORMAL = -NORMAL`, regional loading beginning at 300 m, and fog thinning continuously over 350–900 m. New developer static evidence is `godot/reports/planet-basin-normal-flip01`. The screen-door-specific concerns below describe the superseded approach and must not be presented as findings against the new one. Main still owns GPU; no independent dynamic pass is implied.

Current acceptance must check actual triangle winding and normals, visible coverage with default fog, absence of holes/overlap, transition while moving, near-ground detail and normal-physics frame timing. A fragment normal flip can fix brightness without changing mesh orientation or support; therefore matching brightness in a still image does not establish geometric correctness. Check the 300 m regional enable boundary and the 350–900 m fog range in addition to the original 1.6 km view; the former hard 500 m branch is historical if removed from final sources.

2026-09-29. User's basin screenshot exposes a gap in the prior location coverage. Coast/orbit fixtures do not certify the basin from the user's camera. This defect remains open until the matching final-source independent view and movement sequence passes. No Godot/GPU process was started for this review; Main owns the current render window.

Read `native_planet.gd`, `native_world.gd`, `planet_surface.gdshader`, `far_basin.gdshader`, and `tests/native_planet_basin_visual.gd`. Viewed developer original `planet-basin-repro/arena-yaw-3.14-pitch--0.65.png`: a long straight rectangular material/terrain boundary is clearly visible while HUD reads 1.6 km AGL. This confirms the reported visual defect in developer evidence.

## Repair under review

Regional tiles now load over the basin above 500 m, with a larger neighboring apron; outer terrain colour/texture approaches the basin material. In the 2600–3000 m square-distance band, far-basin and planet shaders discard complementary screen-space pseudorandom pixels. This is a proposed visual transition, not proof of continuous geometry or stable temporal appearance.

Static risks sent to Main (not independently reproduced new bugs):

- `_stream_signature` includes near/mid keys and pin count but not `basin_apron`; a radius-4/radius-2 policy change with otherwise identical keys can skip desired-tile recomputation.
- Complementary screen-space hashes use each surface's own world-position-derived apron factor. Different underlying surfaces can meet the same camera ray at different X/Z, so algebraically opposite comparisons alone do not guarantee complete pixel coverage.
- Far-basin fading does not also modify the original near-chunk StandardMaterial. Loaded near terrain in the edge band needs explicit ownership/overlap inspection.
- Planet surface is unshaded whereas the basin remains lit. Matching texture scale/tint alone cannot establish matching final brightness.
- The hard camera-height 500 m branch requires approach/retreat checks; apparent continuity at one fixed altitude is insufficient.

## Evidence classification

Main's current `native_planet_basin_visual.gd` freezes Player physics, places a fixture, updates the world repeatedly, sets yaw/pitch and calls `_update_visual(0.05)`. It uses the actual Player camera and default world environment, but is a controlled still-image reproduction, not normal-motion or frame-time proof. The development script has layer-hide diagnostic captures; those must remain distinct from the default scene captures.

## Independent run after explicit GPU release

Use a new `basin1600-*` directory. Record source SHA256 before/after, UTC, canonical and scene position, measured AGL, Player camera transform/far/near, fog settings, loaded/queued tile counts and frame intervals. Preserve Main's reproduction coordinates as fixture references: basin (0, height+1600, 190) and arena (1370, height+1600, -1022), yaw 0/PI, pitches -0.35/-0.65/-1.0. Obtain exact user coordinates if available; do not imply inferred fixture coordinates came from the screenshot.

Capture matching stills with normal Main/Player processing and default fog, then small actual-input translation/rotation sequences to inspect straight edges, see-through pixels, screen-door shimmer and LOD replacement. Include steady and initial-streaming periods; report p50/p95/max frame intervals and wall/simulation time with PNG readback cost separated where possible. Check near-ground detail and the 500 m transition, plus edge-band loaded near tiles. Diagnostic layer hiding or no-fog shots may explain failures but cannot be acceptance images. Run only after Main explicitly releases GPU and declares stable source versions.
