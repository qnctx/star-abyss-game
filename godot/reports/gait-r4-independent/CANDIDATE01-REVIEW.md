# Candidate 01: revision needed

The high-knee silhouette is materially reduced against the old baseline, but this candidate is **not accepted as natural locomotion**. The continuous side sequence still shows a nearly straight forward leg and upturned toe held over multiple samples: jog wall time 5.52–5.65 s and sprint 9.60–9.71 s. The torso also remains fairly upright. These are visible skin-pose concerns, not an inference from a foot-anchor metric. They were sent to Motion and the controller before candidate 02 work began.

Evidence: `candidate01-light/side-jog-sequence.jpg`, `candidate01-light/side-sprint-sequence.jpg`, all raw side PNGs and `side-wall-time.gif`. The GIF is available for continuous playback; this review directly inspected consecutive rendered frames and does not claim a human playtest. Three-view raw evidence is retained in `candidate01/`.

Frozen sources:

- GLB `97dcd83ab4d746b65bb47f7af978c1e8f1f20d16b467d1b3ce88117da38afdd1`
- Motion `95d3a7df91e2dfe5128fd0a649c0e8696457f4d8dd07f178374a4018dabb78c6`
- Player and scene unchanged from baseline.

Light capture UTC 2026-09-27T14:23:27: 810 normal automatic physics samples; 383 side images; wall 13.434691 s, sampled physics 13.5 s; median capture interval 33.375 ms, maximum 56.526 ms; time_scale 1; zero requested/observed press mismatches. Light and three-view captures both reported no source changes. Three-view count 101 triplets. All candidate 01 evidence is retained; no product files were changed by verification.

Supplemental maxima from the final runtime bones: forward thigh walk/jog/sprint 27.87°/32.84°/33.58°, pelvis height ranges 0.0139/0.0252/0.0251 m. These reductions do not substitute for natural-looking forward swing, cushioning and push-off. The higher ankle recovery maximum is not itself a failure, since a bent trailing leg can lift the heel without high forward knee lift.

Next verification: repeat existing lightweight side capture on candidate 02 in a stable source window and inspect the previously identified extended-front-leg intervals plus the crossing and support phases. Reuse tri-view capture for final accepted revision and check start/stop transitions. No unrelated R3 regression is implied by this report.
