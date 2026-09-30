# Gait R4 independent baseline

Status: old baseline captured and visually reviewed; replacement acceptance is PENDING. This is not a gait R4 pass. R3 historical evidence is unchanged.

Captured UTC 2026-09-27T14:07:57 in the actual main scene, automatic product physics, Engine.time_scale=1. The harness sends physical-key events and reads the final skinned model from three cameras in the same world. It does not advance animation or player physics manually. All 810 samples were in the physics callback. Four product hashes remained unchanged throughout capture; full hashes and raw source backups are in `baseline/manifest.json` and `baseline/source/`.

- GLB: `e0f5cb5d91a87b99907f9f0678de6079d984898c9a886080c0ec1ab6aa84f8e9`
- Motion driver: `02f549b4cc919b6bde4338ed04306e22c62873da09a9304e2990e9901df92398`
- Player: `917a50bdcdcc418e4b1ac7c84fb900989714ecae5de8414c1bdde3ab2b4530d2`
- Scene: `eb2b90748959f38704d9c06320b39b8a6a87bb1bb75183ff63825ec89d976db5`

## Visual finding

The old side-view skinned sequences show pronounced forward knee lift in jog and sprint; walking is materially milder. Jog/sprint alternate a raised forward knee and extended forward lower leg, supporting the user's high-knee complaint. Front jog and back sprint sequences were also inspected: both show the alternating elevated leg silhouette. These sampled images do not establish natural timing, sole contact quality, or the absence of brief knee flips. Replacement must improve the actual visible silhouette and transitions, not just lower a numeric angle or preserve a foot anchor.

Supplemental bone observations, relative to the player root (not anatomical normative limits):

| Metric | Walk | Jog | Sprint |
|---|---:|---:|---:|
| Maximum forward thigh angle from downward vertical | 36.95° | 63.36° | 72.17° |
| Maximum ankle height | 0.215 m | 0.375 m | 0.434 m |
| Pelvis vertical range | 0.050 m | 0.076 m | 0.092 m |
| Product horizontal velocity | 1.6 m/s | 6.8 m/s | 10 m/s |

See `baseline/trajectory-summary.json`. Angles use sagittal hip-to-knee projection; heights are bone origins, not shoe soles. These measurements are supporting evidence only.

## Timing and evidence limits

The three-view capture produced 101 triplets (303 raw PNGs). The 13.5 seconds of physics took 16.354 seconds wall time on this machine. Median image interval was 156.77 ms, maximum 232.02 ms. `*-wall-time.gif` preserves recorded wall intervals rounded to GIF centiseconds; it is a sparse playback of this slowed capture, NOT a smooth real-time video or human playtest. Sequential JPG sheets use the first 12 captures of each steady phase and are useful for pose comparison.

Twelve samples immediately after the three press transitions recorded requested keys before the engine reported them held (four samples per transition). Steady walk/jog/sprint samples reached the intended velocities. Input release observability is limited because the original harness records only currently requested keys; this baseline cannot prove release latency. Do not reinterpret synthetic input as human feel.

### Near-real-time supplemental side capture

`baseline-light/` was captured UTC 2026-09-27T14:17:05 with the identical four old source hashes and no changes during capture. Only the 320×320 side viewport rendered; the main viewport's 3D rendering was disabled without disabling product physics. Images were buffered in memory and encoded after the run. This produced **378 side images**, median interval **33.39 ms**, maximum **57.41 ms**. Total wall time was **13.392259 s** versus **13.5 s** sampled physics (ratio **0.99202**, including startup timing alignment). All 810 samples were automatic physics, time_scale 1, with zero requested/observed press mismatches. The existing summary field named `captured_triplets` contains the frame count in lightweight mode, not three views.

`baseline-light/side-wall-time.gif` is a near-normal-speed, roughly 30 fps supplementary playback, with durations quantized to 10 ms by GIF. It provides substantially more continuous evidence than the tri-view capture. Human input feel remains untested. For matching delivery capture, append `--lightweight` to `run_capture.py` and use a separate new label such as `delivery-01-light`. No further capture-tool expansion is required for this slice.

## Reproduce and compare

Use cmd from the verification worktree `C:\Users\HUAWEI\.codex\worktrees\3ff0\star-abyss-game`:

1. Coordinate a stable replacement source window with Motion; use a NEW label, never overwrite `baseline`.
2. `py -3 godot\reports\gait-r4-independent\run_capture.py delivery-01`
3. `py -3 godot\reports\gait-r4-independent\process_capture.py delivery-01`
4. `py -3 godot\reports\gait-r4-independent\trajectory.py delivery-01`
5. Confirm unchanged in-run source hashes and inspect corresponding front/side/back sheets and raw frames. Compare matched gait phases, including acceleration and stop frames in the full captures. Check knee lift, forward kick, torso bounce, arm swing, foot contact and any backfold introduced by locking.
6. Supplement with a lighter capture if needed to judge continuous timing. A final naturalness verdict requires visually convincing skin motion; speed and anchor statistics alone cannot pass it.

The capture uses identical orthographic 2.3 m cameras at foot height +0.98 m, 5 m from front/side/back, 480×480 each. Inputs: idle; Ctrl+W walk; release; W jog; release; Shift+W sprint; release. Product starts at (0, ground, 260), yaw 0. No unrelated combat regression or art generation is part of this verification slice.
