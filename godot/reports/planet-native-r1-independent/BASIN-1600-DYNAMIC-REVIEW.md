# Basin 1.6 km independent dynamic review

**Large dark square: not reproduced in the repaired candidate. Complete seam/flicker/geometry acceptance: still open.** Do not turn the first conclusion into an overall visual pass. The final candidate is brighter and more continuous across the old square boundary, but strong fine texture grain and short dark line segments remain visible. This review does not prove those lines are harmless texture rather than geometric seams.

## Actual runs

`basin1600-final01`: UTC **2026-09-29T11:31:46**, 1650 ordinary Main/Player physics frames, **27.5 simulated seconds / 27.585239 s wall** through the last observation. 202 buffered images resized to 640×360. Synthetic G carried an initial 270 m fixture through **943.18 m**, covering the 300 m regional and 350–900 m fog transition. Synthetic D carried an airborne fixture from **x2900 to x4468.43**, z approximately -1022, crossing the old boundary. A near-ground W segment moved 12.9 m. All sampled support states were ready; near-ground sampled AGL stayed within 0–0.000942 m. These are separate fixtures followed by real input/automatic physics, not one continuous journey from camp.

The first center fixture retained climb inertia: measured AGL **1607.69–1617.25 m**. It must not be called an exact 1600 m match. This was corrected in the separate detail run by resetting fixture vertical velocities; the first run is preserved.

`basin1600-detail02`: 690 normal physics frames, **11.5 simulated seconds / 11.540773 s wall**, 83 **960×540** images. Center at x0,z190 has exactly 1600 m measured AGL; arena x1370,z-1022 has 1600.023 m AGL. Both yaw 0 and PI, pitch -0.65, plus mouse-event pan and near-ground views were captured using the **actual Player camera and unchanged default fog**. User's exact yaw/position was unavailable; these are Main's reproduction fixtures, not claimed recovered screenshot metadata.

Both runs retained normal Main/Player physics; no movement/visual tick was manually called. Eight core source hashes were stable in both runs. Detail run additionally recorded all top-level scripts, terrain files, scene files and character GLB before/after: `RESOURCE_CHANGED []`. Complete manifests are `basin1600-detail02/resource-before.json` and `resource-after.json`. This is not a hash claim for every asset in the entire project. Unique test save slots were used; the user's game/save was not accessed.

## Visible findings

1. **Large dark rectangular patch improved:** original developer repro has a conspicuous dark straight-sided boundary. Independent exact-height `0052-arenaPI.png`, `0008-center0.png` and the first run's height/crossing sheets no longer show that large black patch. Old screenshot location coverage was inadequate; this targeted check is the relevant evidence.
2. **Fine grain remains:** the exact-height frames are dominated by purple/white high-frequency basalt texture. The original repro already had this grain inside the basin, so it is not wholly introduced by the normal-flip patch. The now-visible surrounding terrain extends the grain across more of the image. These observations do not isolate the contribution of mip sampling, mesh spacing or texture scale. No claim of alias-free movement is made from ~8 Hz saved frames.
3. **Fine dark segments unresolved:** `basin1600-detail02/0052-arenaPI.png` contains short dark horizontal segments below the character, around image y470–480 (not the old 720px screenshot's y630 coordinate). Their presence prevents an unqualified seam-free pass. Their cause was not isolated; no unsupported classification as texture or holes. The original developer repro also contains short dark segments near its bottom edge, suggesting the phenomenon predates this final fix, but identical cause is not proven.
4. **Near ground:** `0079-near-ground.png` retains visible rocky basalt detail. The tested ground W segment stays supported. No new gross hole or large black patch was seen in inspected rise/crossing sequences. This does not substitute for a geometric triangle/winding audit or all-boundary ground traversal.
5. **Height handoff:** sampled rise images cover the new transition without a large black-square return. Rendering changes as more regional tiles load (0→81). Saved image rate is too sparse to exclude one-frame LOD flashes. Shader backface normal flipping fixes shading; actual winding/manifold consistency was source-inspected only, not independently exhaustively tested.

## Frame intervals

Measured `frame_post_draw` intervals; they **include** screenshot readback/resizing overhead. PNG compression occurred after sampling. These are short-run measurements on the integrated Intel GPU, not a general performance guarantee.

| Segment | p95 / maximum draw interval |
|---|---:|
| Initial warmup, run 1 | 78.79 / 103.31 ms |
| 270→943 m climb | 17.26 / 35.37 ms |
| First arena fixture | 17.47 / 50.70 ms |
| Actual airborne boundary crossing | 17.41 / 38.64 ms |
| Near-ground W | 17.13 / 17.41 ms |
| Exact 1600 m center yaw 0, detail run | 17.08 / 25.38 ms |
| Exact arena yaw PI, detail run | 16.94 / 17.18 ms |
| Detail arena pan | 17.03 / 17.27 ms |

Steady p50 is around 16.65–16.69 ms. No sustained rendering stall was found in these short segments; startup/fixture spikes remain explicitly reported. Wall timing excludes final PNG write-out and includes initial sampling alignment. `time_scale=1`; supplied physics delta samples were 1/60 s.

## Frozen identifiers and follow-up

Raw SHA256: planet `92d8e5aac5ed9f1fe0d225cf823bb99bb5eb88639af8f4db82ed8de93cb8d7bb`; world `3f8ebef70c3cc1c449e05fed29c2b617f8143540fb15d59e1a11e9d79b6567e4`; surface shader `bdfb2ce0504c83c3a0a4c0aeaaaf7c7a5167d8d01850ae44dacc9609bee62321`. Git blob IDs supplied by Main are a different hash format; the recorded raw hashes are authoritative for these captures.

GPU released to Player after both processes exited. No product changes were made. Next targeted work, if requested by controller: isolate the exact dark segments with geometry/material diagnostic views, then short full-render-rate capture around the relevant boundary for temporal flicker. Preserve this record rather than silently replacing it. Current scripts have fixed output directories; use new labels/files for any repeat.
