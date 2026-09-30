# First native planet segment review

**Overall pending / visual gate not passed.** UTC 2026-09-27T15:15:10; eight relevant sources unchanged during the run. Full hashes in `segments01/results.json` and `summary.json`. This is segmented fixture evidence, not continuous travel or a completed planet acceptance.

## Confirmed

Actual Main and Player physics stayed enabled. Each of nine destinations was placed once 8 m above the field surface, then ran 150 ordinary engine physics frames without calling product movement steps manually. The six dry destinations (8/17/27/34 km, south pole, back hemisphere) ended at reported AGL 0 with zero velocity and radial body up dot approximately 1. Independent layer-16 rays hit actual named `PlanetTriangleCollision` bodies at every destination; field-to-ray discrepancy ranged 0–1.36 cm. Nominal loaded support spacing was 14.6484375 m. The cube corner began unready and later became ready; it did not remain indefinitely pending in this sample.

The other three destinations (42 km ocean, north pole and cube corner) were deliberately injected above the **solid seabed**, below water, and also settled onto it. These are collision diagnostic fixtures only: they do **not** prove safe legal ocean entry, swimming or playable underwater landings. Reported water depths were approximately 180 m, 2047 m and 962 m. Separate real coast/ocean approach behavior is still required.

## Visual findings

Directly viewed `route-17000-ground.png`: dark nearly bare ground and distant low silhouette; no recognizable forest trees. `route-34000-oblique.png` is overwhelmingly uniform purple haze, so it cannot establish a visible irregular coast. `orbit-no-fog-diagnostic.png` shows a roughly spherical terrain body, but it is small and dark; readable continents/biome transitions are not established. This is insufficient for the requested surface/organic-geography scope. These images were sent to World/Main/controller for revision.

Orbit screenshots use a free independent camera, not a player ascent. No-fog is explicitly diagnostic and is applied only after the default shots. Camera/background or fog changes cannot alone clear a missing geometry/ecology gate. A field's forest/wetland weights are not visible forest/wetland implementation.

## Remaining gates

Real-input ±3 km crossings, legacy height preservation, protected-state save/reload, legal ocean approach, high-altitude connected flight, actual playable geometry/biome boundaries and additional near-pole/seam movement remain open. Normal-time visual motion and full save compatibility cannot be inferred from these nine initial-position tests. Source updates after this run require new labelled evidence.

Reproduce from the verification worktree with `py -3 godot\reports\planet-native-r1-independent\run_segments.py`; current script output is fixed to `segments01`, so copy/update the output label before any later run to preserve this evidence. Summarize with `summarize_segments.py`. Do not rerun over this historical directory.
