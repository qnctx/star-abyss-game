# R6 independent verification

This directory contains independent checks, not production animation assets. Run commands from the actual C: worktree. Do not launch concurrent Godot/Blender processes or operate the user's game window.

`inspect_glb_gait.mjs` samples exported GLB tracks at 120 intervals per cycle without importing the gait generator. It records hip/knee/ankle geometry and evaluates all skin weights on vertices below the boot cuff, including mixed knee/ankle weights. Left/right identity follows original joint influences rather than animated x. Fixed front/rear shoe material groups provide a diagnostic foot heading, which must be corroborated against final front/back views.

```cmd
node godot/assets/motion-r2/gait-r6/independent/inspect_glb_gait.mjs INPUT.glb godot/assets/motion-r2/gait-r6/independent/REPORT.json
node godot/assets/motion-r2/gait-r6/independent/inspect_glb_gait.mjs INPUT.glb godot/assets/motion-r2/gait-r6/independent/REPORT-240.json 240
node godot/assets/motion-r2/gait-r6/independent/compare_preservation.mjs BEFORE.glb AFTER.glb godot/assets/motion-r2/gait-r6/independent/PRESERVATION.json
node godot/assets/motion-r2/gait-r6/independent/inspect_runtime_trace.mjs TRACE.json godot/assets/motion-r2/gait-r6/independent/RUNTIME.json
node godot/assets/motion-r2/gait-r6/independent/inspect_skin_evidence.mjs SKIN.json godot/assets/motion-r2/gait-r6/independent/SKIN.json
```

The scripts write only their requested reports. They do not modify GLB, animation tracks, game logic, saves, or project configuration. Cubic and morph animation are deliberately rejected rather than sampled incorrectly. Offline results do not include runtime IK and cannot establish final Godot acceptance. The preservation check compares raw accessor elements semantically, permitting container reorder/padding but requiring unchanged non-gait tracks, mesh attributes/indices, skin binds, node rest transforms/hierarchy, textures and materials.

`inspect_runtime_trace.mjs` summarizes supplied actual Godot trace records, including post-IK limb angles, reciprocal arm correlation, torso lean and differences from the sampled source clip. It reports physical/wall time and ignores the trace's rigid sole proxy when judging complete mesh contact.

## Fixed shoe probes for runtime cross-validation

`export_sole_probes.mjs` produces `sole-probes.json` without changing production code. It preserves every nonzero source weight and stores each point as a sum of joint-local terms: `inverseBindMatrix[joint] * original mesh POSITION`. In Godot evaluate `sum(weight * (bone_global_pose * local))` in skeleton space, then apply `skeleton.global_transform` once. Do not apply inverse rest or ankle deformation again. The payload carries original mesh/primitive/vertex identifiers for GPU correspondence. The GLB mesh bind transforms are identity; the imported Godot mapping still requires actual GPU cross-validation before relying on correction.

```cmd
node godot/assets/motion-r2/gait-r6/independent/export_sole_probes.mjs godot/assets/motion-r2/source/gait-r6-before/c2-motion-r2.glb godot/assets/motion-r2/c2-motion-r2.glb godot/assets/motion-r2/gait-r6/independent/sole-probes.json
```

Current payload compares baseline SHA `942f372de11641e9c8189f2aef39ed68956e4eed1d54bd14243cb86f022e2430` and new source SHA `9e65aa43ef2a925de92771cdba9680039ce24e842e1327cd34718a95f6d1da05`. Each foot has 96 fixed points. Lowest vertices are retained from all 120 phases of three gaits in both files and from 30 gait phases × four idle phases × nine local-TRS mixture weights per gait/file (7200 poses total). Reversing interpolation covers both transition directions within that sampled family. Other points cover heel, toe and outer edges. Maximum sampled minimum-height overestimate against all unique below-cuff vertices is zero for each foot. This finite sampling result does not prove all continuous transitions or the final runtime IK, and must be checked against the rendered full mesh.

Final review requires stable normal-speed side/front/back cycles, start/stop and gait transitions, genuine rendered skin depth, and material-point contact drift. Check that thighs pass from in front of the hip to behind it, knees flex then open during recovery, running heel recovery occurs behind the hip, walking has continuous support, running has flight, and reciprocal arms actually change sides. Preserve source hashes and state which checks are measured versus visually reviewed.
