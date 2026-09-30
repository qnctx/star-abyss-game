# Focused skirt / orbital texture review

**Correction, 2026-09-29: orbital terrain clearance is retracted.** The large terrain color quadrilateral and small avatar-adjacent silhouette were conflated. Main's isolation recheck removes the large patch with `_far_root` while the small silhouette remains. See `BASIN-FINAL-SCOPED-CONCLUSION.md` for attribution and the audit record. The 1.6 km dash result remains scoped to its matching inspected view. The subsequent genuine z200 ground crossing is recorded in `GROUND-EDGE05-REVIEW.md`; earlier ground-test limitations below are retained as history.

**Targeted 1.6 km dark dashes: cleared in the matching inspected view. Overall all-seam/all-flicker and ground-boundary acceptance remains limited.** Historical failed frames and reports remain unchanged. This report concerns the subsequent skirt-tag and orbital material-fade revision only.

## Sources and execution

Actual Main/Player physics remained enabled with default fog and the actual Player camera. Initial phase placements are fixtures, then G/C/D/W and mouse events drive normal product code. No manual product physics or animation stepping. Unique test save slots; no user save accessed.

- `basin-skirt03`, UTC **2026-09-29T12:18:28**: 780 physics frames, **13.0 sim / 13.039433 wall seconds**, 114 full 960×540 frames plus **733 consecutive rendered-frame crops** covering x0–959,y420–519.
- `basin-skirt04`, UTC **2026-09-29T12:20:32**: 480 physics frames, **8.0 sim / 8.121580 wall seconds**, 69 full frames and **448 consecutive rendered-frame crops**.
- Nine core files unchanged within both runs; resource manifests covering scripts, terrain files, scenes and character GLB also report **no changes**. See each directory's `resource-before.json`, `resource-after.json`, `results.json`, `summary.json`.

Raw SHA256: world `eb2d135c5ca71f674994ef71c67b5bf467956422dc6020f08d53cbaff3e5cace`; planet `92d8e5aac5ed9f1fe0d225cf823bb99bb5eb88639af8f4db82ed8de93cb8d7bb`; planet surface shader `2ec0a7e15c1f1f2b92e6f509f5599ed8df60ee1df18037cf1bcd947cdbf56788`; near surface shader `185804210f1bec37878bd0399239c1f1ab8fc025e79cb1e820d17330809aa8ef`.

## Findings

| Item | Result and evidence |
|---|---|
| Exact arenaPI 1.6 km dark dashes | **Targeted pass.** `basin-skirt03/0009-arenaPI.png`, x1370,z-1022, measured AGL1600.023, no longer has the short horizontal marks below the avatar found in prior `basin1600-detail02/0052-arenaPI.png`. Large dark square also remains absent. |
| 350 m skirt handoff | G ascent sampled AGL320→470 m; C descent sampled 378.69→211.58 m. All sampled support ready. Inspected consecutive-crop sheets show the expected low-altitude skirt marks disappearing above the cutoff without a large open hole. Hard skirt switching still occurs by design; this is not proof of a visually invisible switch at every viewpoint. |
| Moving near terrain | D at approximately100 m AGL moves x1595.96→1944.48, crossing real legacy tile lines x1640/x1800. Support remains ready. No large hole in inspected captures. This is airborne movement, not grounded collision crossing. |
| Near-ground movement | Normal W z164.88→148.80; AGL about0.000935 m, zero sampled unready, rocky detail retained in `basin-skirt04/0011-ground-tile160.png`. **Harness label correction:** tiles are aligned from -3000, so the relevant nearby boundary is z200, not z160. This run did not cross a true tile boundary. Grounded no-step/no-hole seam acceptance remains untested. Next minimal test should start z205 and walk below185. |
| Orbit texture patch | **Unresolved; previous clearance retracted.** `basin-skirt04/0059-orbit-fixture.png` is an actual Player-camera fixture at125000 m AGL, not a new-source connected flight. The previous assertion “no longer shows the prior large fine-texture square” is retained here only as a superseded audit record. The small avatar-adjacent silhouette does not explain or clear the large terrain color quadrilateral. Globe lower edge still extends beyond the viewport; a small pale jagged sliver is also visible at the left limb, not diagnosed here. |
| Grain and temporal quality | Strong purple/white grain remains. It existed before this revision. Every-render-frame crops are now preserved for the target band, but only representative sheets were visually inspected; scalar pixel differences cannot certify no flicker. No blanket aliasing/flicker-free claim. Full-frame screenshots remain about10 Hz; areas outside the crop have lower temporal evidence density. |

Source review confirms skirt-only vertex alpha tags and collision built from `surface_indices` before skirts are appended. That establishes implementation intent, not independent exhaustive collision-mesh or winding correctness. Removal of visual side geometry should not be treated as proof that every surface joint is watertight.

## Short performance measurements

Frame-post-draw intervals include readback/crop overhead; PNG encoding occurs after the run. Stage p95/max milliseconds: arena initial27.88/36.39; pan17.10/17.37; ascending handoff17.32/23.09; low aerial tile movement17.04/24.73; descending handoff17.16/17.47; ground W17.20/22.61; orbit fixture17.17/17.84. Initial warmup max across both runs100.27 ms. Normal steady portions are near60 Hz, without a sustained stall in these short tests. This is not whole-game performance certification.

## Handoff

GPU released after both processes exited; Player may run the new-world final flight chain. No product file changed by verification. Remaining targeted issue is a genuine grounded legacy tile crossing; do not rerun unrelated unchanged suites. Keep orbit limb/near-avatar residuals and existing grain as explicit visual limits rather than merging them into the fixed 1.6 km dash claim. Scripts use fixed new output labels; do not overwrite evidence on repeat.
