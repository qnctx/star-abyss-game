# R3 ecology independent verification

2026-09-29. Worktree: `C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game`.
Implementation was inspected read-only. This verifier added only the two `ecology_r3_independent_*` test files and this report.

## Executed checks

- `py -3 godot/tests/ecology_r3_independent_assets.py`: all 21 actual JSON meshes parsed; triangle counts and coordinate-based boundary edges inspected. All assets had zero duplicate-vertex triangles after correction. Floating rocks have zero open boundary edges at every LOD, 704/176/44 triangles and distinct topology from outcrops. Final performance revision tree LODs use 76400/7040/1254 triangles (resource counts exercised by the runtime test). Crystal height is consistently 7.95m across LODs.
- `D:/Godot_v4.6.2-stable_win64.exe/Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/ecology_r3_independent_runtime.gd`: repeated after corrections, exit 0, no failures. Actual Godot ArrayMesh/MultiMesh/colliders loaded/generated. Positive legacy weight `0.00001`, unavailable support, and 1m water prevent placement. Instance and render accounting agree; clear resets state. Each site stores five support points and invalidating a non-anchor point makes `_still_supported` return false.

| LOD | Trees | Grass | Colliders | Triangles / band budget | Support interface |
|---|---:|---:|---:|---:|---|
| 0, 20m | 2 | 94 | 2 | 199800 / 200000 | physics surface |
| 1, 80m | 41 | 56 | 41 | 299840 / 300000 | physics surface |
| 2, 400m | 296 | 0 | 0 | 371184 / 800000 | rendered visual surface |

The performance revision uses visual LOD thresholds 32/125m and a total triangle limit of 1300000. Support/collision is independent: cells inside 220m require physical terrain and retain tree collisions, even when using visual LOD2; farther cells use actual rendered visual support. The test distinguishes intentionally non-colliding grass/reeds. Each row is a separate clear/build run, not a simultaneous-world density measurement.

Additional independent regression executed after the performance revision, exit 0 with no failures: visual LOD2 at 180m rejects unavailable physical support even when visual support is available; when physical support becomes ready it creates colliding trees. Selection across 180m → 260m invalidates/rebuilds the same visual LOD2 cell without collisions, and 260m → 180m invalidates/rebuilds it with collisions. Thus a support-policy change alone triggers rebuilding, without relying on a visual LOD change.
- Inspected generated source and approved image 05/12. Other image-based full scenery acceptance remains with the parent visual verification.

The mock runtime verifies ecology decisions and resource creation, **not** real streamed terrain readiness, navigation, reference-level visual quality or performance.

## Corrections confirmed on retest

1. Open-bottom floating outcrops were replaced with closed irregular floating-rock geometry; all three LODs verified numerically.
2. Crystal component generation no longer changes heights between LODs; all three reach the same height.
3. Single-anchor support validation was replaced by center and four footprint samples for every accepted asset. Independently verified that losing a non-anchor support invalidates a cell.
4. Footprint probes now explicitly reject positive legacy weight and inappropriate water depth in addition to checking rendered support and height variation; confirmed in implementation inspection.

## Latest owner-cache regression

The implementation now checks immutable terrain node ownership every frame, removing the previous selection-scheduling delay. Lightweight independent tests pass for unchanged, removed and replaced owner nodes. The audit exposed a missing-near-owner case: physics support can use a neighboring tile through offset ray retries, while a cached `{key: 0}` would incorrectly certify support after that neighbor unloaded. This was fixed by returning an empty ownership cache whenever a near/middle asset has a missing near owner, forcing full geometry validation. Independently reran the Godot test after the fix: exit 0, `failures: []`, including the new missing-owner regression and all band tests. No owner-cache defect remains open from this audit.

## Remaining limits

- Grass blade-tip duplicate-vertex triangles were fixed and the zero count independently confirmed.
- Four footprint cardinal probes do not mathematically prove support for every vertex or exclude every tiny feature between probes. This report verifies the implemented sampling contract, not full mesh-to-terrain contact.
- Actual reference-image correspondence, ground-level density, playability, frame time, and real `rendered_visual_surface_at` integration remain under the parent visual/runtime verification.
- Before the performance revision, the parent reported a separate actual-NativePlanet run with 787 instances, 2883256 triangles, all 400 populated cells passing independent geometry resampling, and valid support again after 120m movement. Those are historical parent-run figures, not final performance-budget results. Final same-camera hardware performance and world integration are reported by the parent separately.

## Reproduction

Run the two commands above from the worktree root. For real-world follow-up, cross a streamed terrain boundary, stand still while terrain rebuilds, and verify all roots remain supported; approach legacy/water boundaries with the largest asset footprint. Compare crystal silhouettes at the 95m and 290m LOD thresholds. View floating rocks from underneath in the Godot asset preview.
