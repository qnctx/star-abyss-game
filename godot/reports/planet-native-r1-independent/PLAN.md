# Native planet R1 independent verification plan

Status: planning and old-boundary evidence; no native planet acceptance yet. Work only in this report directory and a separate future gait reference-review directory. Preserve all R3/gait-r4 evidence. No product edits or image generation by verification.

## Required evidence and gates

| Slice | Actual verification | Failure condition |
|---|---|---|
| Old square baseline | Save old world/player/main/scene hashes; capture the actual bounded 6 km terrain from above and near ±3 km. Keep default atmosphere plus explicitly labelled fog-disabled diagnostic view. | A source-only claim is not a reproduced screenshot; fog cannot establish geometry continuity. |
| Old basin preservation | Compare old height samples and key camp/investigation/vehicle locations; preserve lunar sky and original assets. | Height changes, displaced entities, lost access or altered save state. |
| Boundary crossing | On all four ±3 km sides, begin inside, use actual movement input through boundary and return; include corners and 3–4 km transition. Record canonical and local positions, radial up, contacts, actual delta and support readiness. | Invisible wall, clamp, seam hole, teleport, false support, or camera/up discontinuity. |
| Playable route | Field sweep plus actual native runtime at 8 km plains, 17 km forest, 27 km wetland, 34 km coast, 42 km ocean; use declared route API, not guessed coordinates. Walk/land at dry sites; record water depth and intended ocean behavior separately. | Labels alone without visible terrain; straight rectangular biome borders; walking on water accepted as land; field sample substituted for collider. |
| Ground scale and organic borders | Low eye-level and elevated oblique images spanning biome transitions and adjacent off-route directions; inspect slopes and actual visible mesh. | Tiny staged islands, hard square cut, corridor-only terrain concealed by fog, materially unplayable near-ground relief. |
| Curvature and orbit | Continuous altitude segments from basin and outer terrain to high altitude/orbit; same field and location metadata at each. Inspect horizon curvature, full globe, near/far clipping and LOD seams. | Separate decorative sphere, missing ground-to-orbit connection, planar square still visible, fog-only concealment. |
| Global coverage | Both poles, near-poles, far side, longitude seam and representative cube-face boundaries/high mountain. Establish mesh readiness, raycast real triangle and test normal automatic-physics fall/landing and tangent movement. | Back side misclassified as old basin, local-Y gravity, coarse/pending support treated ready, camera singularity, fall-through. |
| Collision lifecycle | Fresh distant arrival and fast traversal before/after streaming; free fall from several metres, observe impact and sustained grounded state. Log collider identity, radial clearance, mesh spacing and pending duration. | Analytical height alone prevents fall while collider absent; ready flag lies; support disappears at LOD swap; indefinite pending. |
| Saves | Unique test save path only. Seed old story/inventory/investigation/vehicle/enemy-drop state, save/reload in basin and far terrain, then poles/back side. Compare explicit protected fields and canonical position. | Legacy root overwritten, local render coords saved as authority, reload clamped to ±3 km, duplicated reward or lost progress. |

## Source contract and method

Read `docs/development/PLANET-ARCHITECTURE.md`, `PLANET-INTEGRATION.md`, and `docs/PLANETARY_EXPEDITION_DESIGN_DRAFT.md`. The web reference uses an engineering radius of 120000 m, legacy ±3000 m basin with transition complete by 4000 m, and landmarks at 8/17/27/34/42 km. Prior web passes do not establish native Godot passes. Native world/player/main contracts are being coordinated; tests will use their declared canonical/up/ready APIs when delivered rather than inventing conversions.

Capture UTC and source SHA before/after every stable run. Record automatic physics `delta`, wall/simulation time and image intervals. Test fixtures may place the initial player/camera or initialize a unique save; actual fall, traversal and transition claims require product physics/input after placement. Never manually tick product physics or animation to claim integrated success. Field/unit sweeps, segmented native checks and any full uninterrupted traverse will be labelled separately. A 42 km direct fixture does not prove the whole route was traversed.

Use existing lightweight capture practice where applicable; avoid building a broad recorder framework. Prioritize critical failures before expensive complete runs. Report pending/uncovered cases explicitly. Deliver report plus concrete commands, raw metrics, images, source manifest and remaining limitations.

## New gait image-first gate (separate from planet)

The updated root AGENTS.md and `docs/3D_VFX_ENGINEERING_SPEC.md` require specific reviewed action breakdowns before new 3D work. This batch permits Motion at most two new references (walk; jog/sprint); verification generates none. Require reference files/prompts and review record before production, full left/right phases and support/weight transfer, and mapping to Blender actions/final GLB. Generic standing art or images added after parameter tuning do not pass.

Compare final skinned full cycles and starts/stops to those references in normal-time actual Godot. Inspect heel/toe clearance using the final deformed shoe mesh against the actual runtime support surface, not only ankle targets or a rigid representative point. Previous authored-mesh walk minimum -4.02 cm remains an explicit unresolved baseline. Naturalness depends on continuous visible motion, not thresholds alone; negative verdicts remain possible even with improved angle metrics.
