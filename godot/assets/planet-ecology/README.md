# Native planet ecology

## Image → geometry → runtime

The previously generated `docs/art/planet-v1/planet-ecology-concept.png` supplies the organic biome distribution intent. `surface-transition-concept.png` panels 03/04 specifically supply tapered branching trees with visible individual leaves, wetland reed stems and folded blades, and irregular riverbank stones. Both original images were visually reviewed before this native adaptation. No new image or paid 3D service was called.

The authored geometry source is `playable/src/planet-art/index.mjs`; `export.mjs` reproducibly exports its actual vertices/normals/linear vertex colors into six JSON meshes. Trees have curved tapered branch paths, buttress roots and individually folded leaf blades rather than sphere/cone stand-ins. Near/far trees contain 4420/878 triangles; reeds 846/376; rock clusters 630/180. The native far tree increases individual blade area to preserve the concept crown silhouette when reducing leaf count. This is a procedural low-poly adaptation of the reference, not a photorealistic match to the image.

`native_planet_ecology.gd` builds ArrayMesh/MultiMesh resources, with a hard shared 320-instance and 260,000-triangle cap, approximately 170m local coverage, two cell builds per update, and 55m near/far selection. At altitude >500m all ecological instances and trunk colliders are removed. Stable cube-sphere cell/asset seeds keep sites deterministic across unload/reload. The original basin's legacy weight excludes planting. Actual loaded terrain triangle `surface_at.ready`, water depth and surface-normal slope decide whether a site is allowed; no analytic plane is accepted as a physical support.

Forest/wetland/coast/river continuous weights determine probability rather than rectangular biome regions. Tree trunk collision is a conservative cylinder; leaves/reeds/pebbles are decorative. There is no full vegetation navigation system, wind animation, separate shrub species or orbital forest geometry in this slice. Distant forest color remains terrain shading; local trees are actual geometry. Near/far selection is made when a cell loads, not continuously crossfaded.

## Integration and verification

NativeWorld owns `World/PlanetEcology` (`_planet_ecology`), calls `setup(_planet)` once, and `update_stream(scene_position)` after the terrain stream update. The module changes no player, saves, original six-kilometre camp, sky, creatures or investigation data.

Run `node godot/assets/planet-ecology/export.mjs` to rebuild meshes. Run Godot with `--headless --path godot --script res://assets/planet-ecology/verify.gd` for the controlled streaming fixture, or `capture.py` using the bundled Python to obtain actual hidden OpenGL screenshots without taking focus. This fixture deliberately stops main/player movement and streams the actual world at three sites; it is not proof of a complete player journey or keyboard feel. Evidence is under `evidence/`.

Manual test: travel the existing route to 17km forest, 27km wetland and 34km coastal land; inspect tree branches/crowns, reed clumps and stones close up; try walking into a trunk. Move >170m and verify old sites unload; climb >500m, then descend to ensure plants return without spawning in the original camp. Independently check the terrain/water seam and lighting: plant-count or collider checks cannot certify the surrounding terrain visual quality.
