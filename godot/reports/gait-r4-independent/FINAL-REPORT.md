# Gait R4 independent result — candidate 02

## Post-review developer disclosure

Motion subsequently reported a stricter full evaluated-mesh scan of 118 authored gait frames (`gait-r4-deformation.json`): minimum local mesh height walk **-4.02 cm**, jog **-1.09 cm**, sprint **-1.43 cm**. This supersedes the earlier representative sole-point estimate as the disclosed contact limitation. These are developer-reported authored-mesh measurements, not independently reproduced runtime penetration depths. **Strict complete-sole nonpenetration remains NOT PASSED.** The scoped visual posture acceptance below does not clear this known issue. Motion states the final GLB and driver remain frozen; no additional sole/slope system work is included in this slice.

**Accept candidate 02 for the scoped flat-ground high-knee/rigid-forward-leg correction.** Final skinned sequences show a clear improvement over the old baseline and candidate 01. This is a limited visual acceptance of the tested walk/jog/sprint loops and transitions, not a claim of perfect animation, complete sole contact, slope coverage, or human control feel.

## Visual evidence and judgment

Old jog/sprint had a pronounced raised forward-knee silhouette. Candidate 01 reduced it but introduced/retained an almost straight forward leg and upturned shoe held over several consecutive samples, so it was not accepted. Candidate 02 retains visible knee bend during forward swing; the extended-front-leg silhouette is materially softened. The rear heel recovers behind the body, and the crossing/support sequence proceeds without an obvious frozen straight-leg pose in the inspected consecutive frames. The torso has modest forward inclination and substantially less vertical bob than the old source. Arm alternation remains readable.

Directly inspected candidate 02 lightweight side sheets for walk, jog and sprint, plus all six start/stop sheets. Jog start transitions from idle into the lower-knee run; walk/jog stops settle to idle without an obvious pose pop. Sprint stop shows several decelerating steps before settling; this is consistent with deceleration rather than an instantaneous idle switch. No obvious knee backfold or abrupt silhouette discontinuity was seen in these sampled sequences. Front walk/jog and back sprint sheets were also inspected for alignment and silhouette. Complete raw three-view frames remain available.

The runtime capture is near normal time and sufficiently dense to inspect consecutive poses, but this agent reviewed frame sequences; a saved GIF is not evidence that a human watched or played it. The body motion remains restrained/stylized, and exact shoe-ground contact and slope behavior are not passed by this report. Developer estimates of millimetre sole errors were not independently reproduced here. No further art or tool expansion is required for the scoped correction.

Useful evidence:

- `candidate02-light/side-wall-time.gif`: full recorded side sequence with recorded wall intervals, quantized to GIF 10 ms units.
- `candidate02-light/side-jog-sequence.jpg`, `side-sprint-sequence.jpg`, `side-walk-sequence.jpg`: consecutive skin poses.
- `candidate02-light/side-{walk,jog,sprint}_{start,stop}-sequence.jpg`: six transition sheets.
- `candidate02/`: matched three-camera raw PNGs and sheets.
- `baseline/`, `baseline-light/`, `candidate01/`, `candidate01-light/`: preserved comparisons, not overwritten.

## Source and timing

| Source | SHA256 |
|---|---|
| GLB | `942f372de11641e9c8189f2aef39ed68956e4eed1d54bd14243cb86f022e2430` |
| Motion driver | `95d3a7df91e2dfe5128fd0a649c0e8696457f4d8dd07f178374a4018dabb78c6` |
| Player | `917a50bdcdcc418e4b1ac7c84fb900989714ecae5de8414c1bdde3ab2b4530d2` |
| Main scene | `eb2b90748959f38704d9c06320b39b8a6a87bb1bb75183ff63825ec89d976db5` |

Light side capture UTC **2026-09-27T14:28:14**: 810 normal automatic physics samples, time_scale 1, **376 side frames**, wall **13.447844 s** versus sampled physics **13.5 s** (ratio **0.99614**; includes startup alignment). Median frame interval **33.387 ms**, maximum **60.424 ms**. Requested/observed press mismatches: **0**. Source changes during run: **none**.

Three-view capture UTC **2026-09-27T14:28:53**: 810 automatic physics samples, **101 triplets**, wall **17.879477 s** versus physics 13.5 s; median interval 172.279 ms, maximum 230.014 ms. Twelve initial press samples precede buffered input observation. Use these images for matched-view poses, not real-time rhythm. Source changes during run: **none**. The light capture supplies the near-normal-time evidence.

Supplemental final runtime values (supporting, not pass criteria): maximum forward thigh angle walk/jog/sprint **27.91° / 39.53° / 40.24°**, compared with old **36.95° / 63.36° / 72.17°**. Pelvis vertical ranges **0.0139 / 0.0252 / 0.0251 m**; product horizontal velocities remain **1.6 / 6.8 / 10 m/s**. Foot-anchor immobility was not used as a naturalness criterion; the new driver uses moving ankle targets during heel/toe roll.

## Concrete verification steps

From `C:\Users\HUAWEI\.codex\worktrees\3ff0\star-abyss-game`, use cmd and a fresh label:

1. `py -3 godot\reports\gait-r4-independent\run_capture.py review-light --lightweight`
2. `py -3 godot\reports\gait-r4-independent\process_capture.py review-light`
3. `py -3 godot\reports\gait-r4-independent\trajectory.py review-light`
4. Compare final skin frames and the wall-time GIF against the saved old baseline; verify source hashes and timing in `capture.json` / `summary.json`.
5. For manual confirmation in the game, on level ground use Ctrl+W, W, Shift+W, releasing each between trials. Inspect side/front/back for high knee lift, rigid front extension, support-leg backfold, excessive bounce and abrupt stopping. This manual step is provided for the user and is not claimed as completed by automated input.

Verification wrote only scripts and evidence beneath this report directory. R3 history and unrelated dirty files are preserved. The developer reports 26 non-gait clips and mesh/inverse-bind data unchanged; that export audit remains developer evidence, not an independently rerun check in this slice.
