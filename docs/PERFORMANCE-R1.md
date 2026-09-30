# PERFORMANCE-R1 — clarity and main-thread stalls

Baseline: SUPPORT-TERRITORY-R1, read from `E:/myProject/star-abyss-game` on 2026-09-16. Implementation and tests only in `C:/Users/HUAWEI/.codex/worktrees/b1be/star-abyss-game`. No writes to the main project/controller checkout; no 4173 server and no production browser profile/save used.

## Findings and changes

* Dynamic resolution previously fell to 0.65 in 0.15 steps using 24-frame averages, so CPU spikes could progressively blur the image. Minimum is now **0.90 CSS pixel ratio**, ceiling remains 1.25. Three robust 60-frame windows must agree before a 0.05 change; changes have a 4-second cooldown and 2-second startup grace. CPU-bound samples are excluded using measured simulation + scene-update CPU time, excluding WebGL submission. The target is 16.67 ms; slow evidence requires median >23 ms and P75 >25 ms. Recovery requires median <18.5 ms/P75 <20 ms. This is a quality policy, not a promised 60 FPS floor or a GPU timer.
* Terrain previously built every missing tile synchronously. `buildChunkSteps` now yields per vertex row, and the colour/water pass also yields per row. Normal scene streaming gets a **3 ms cooperative budget and at most one completed tile per displayed frame**. This is a soft deadline: selection, one row, geometry finalization and publication may exceed it. Existing complete geometry/collision stays active until the new set is ready, then swaps atomically. No segment, texture, water, biome, shadow or mesh-count reduction. Explicit `prepare(force)`/restore/teleport remain synchronous and supersede a pending destination. Normal moving requests finish the bounded current batch before selecting the latest destination, preventing restart starvation. Maximum temporary ownership is old cache plus one bounded staging set; cancellation/failure/destruction releases staging.
* The real creature has 43,002 render vertices. Exact deduplication by position and all skin indices/weights leaves **16,397 distinct collision vertices**. Per-bone matrices and immutable bind positions are reused, rather than multiplying the same matrices for every vertex. Geometry metadata is shared by immutable geometry through a WeakMap. Every visible render vertex, authored bone, gait, foot correction and corpse ground constraint remains. Morph targets fall back to Three's exact path. Full deformed-vertex clearance tests match to 1e-8 on a slope.
* Main-game localStorage already ran every 12 seconds; the external expedition runtime still performs a root checkpoint every 2 simulated seconds. Each checkpoint revalidates/clones the full root and its growing receipt history. The checkpoint now runs **the same createSession/IndexedDB/revision-CAS/replay path in a dedicated classic `.js` Worker**. The 2-second frequency is unchanged; combat/drop/inventory remain on their original transaction path. No receipt pruning, storage schema migration or weaker validation.
* Runtime `busy` still protects transactions. New `blocking` allows the main player movement loop to continue during a checkpoint only; AI simulation remains frozen while that transaction owns its scene, so a response cannot rewind concurrently advanced AI. The real player lives in the existing external context and is never overwritten by a checkpoint response. Explicit pause/menu checkpoint calls wait for an in-flight transaction, then snapshot the latest context pose. Failures remain visible and reload authoritative storage. A failed worker is retired; later requests use the original session. A startup failure falls back before any checkpoint write.

## Comparable measurements

| Test | Before | After | Interpretation |
|---|---:|---:|---|
| Real terrain, 80 route positions at 40 m increments: update P50 | 121.69 ms | 3.19 ms | Same route/192 active chunks; after distributes work over 2,952 pumps |
| Same terrain P95 / maximum | 233.67 / 309.96 ms | 3.48 / 5.46 ms | CPU task duration, not rendered-frame FPS |
| Same terrain total CPU / initial sync load | 8,904.97 / 2,903.42 ms | 8,861.49 / 2,758.01 ms | No work hidden or detail removed; initial/force preparation still stalls |
| Checkpoints with 900 historical receipts, 20 real IndexedDB commits: RAF P99 | 49.9 ms | 16.8 ms | Isolated Chromium browser, main-session vs real Worker |
| Same checkpoint RAF >33 ms / >50 ms | 5/91 / 0/91 | 0/109 / 0/109 | Main-thread responsiveness improved |
| Checkpoint transaction P50 / P95 | 42.1 / 85.5 ms | 52.4 / 86.1 ms | Transactions themselves are not faster; CPU moved off main thread |
| Real creature corpse collision scan vertices | 43,002 | 16,397 | Deterministic exact reduction, strongest reliable creature metric |

Creature timing files include an initial run and a back-to-back repeat under substantial shared-machine load. Repeat corpse P50 was 38.21 → 5.55 ms; chase P50 1.04 → 0.68 ms. These noisy timings are diagnostic, not a frame-time guarantee; full numeric equivalence and vertex counts are the acceptance criteria.

The attempted full-game 1280×720 headless run encountered concurrent system load: baseline only produced 25 RAF samples, P50 1,450 ms. **That run is invalid for before/after performance claims**, was cancelled at the controller's request, and must not be used to assert gameplay speed or clarity. Its baseline JSON/screenshot are retained for transparency. Controller will run the final merged scene in isolation. No single-frame FPS or component benchmark guarantees the whole planet.

## Validation and reproduction

* 19 targeted tests passed: resolution floor/hysteresis/CPU exclusion; staged cache rollback, disposal and force supersession; exact authored creature clearance; checkpoint pause queue, failed writes, worker fallback; patrol/chase/return/death/drop regressions.
* 18 integration tests passed: storage CAS, replay, lost-response recovery, atomic combat/drop/inventory; radial contact and save/restore.
* 15 planet architecture/integration tests passed: six-face coverage, spacing, legacy height preservation, seams, pole/backside support and disposal.
* Browser checkpoint harness proves Worker startup (throws if it falls back), real durable reload, 920 receipts after 20 writes, replay and stale-revision rejection. Disposable UUID databases are deleted. Worker bundle successfully built.

Run from the integrated project:

```text
node tools/build-performance-worker.cjs
node --test playable/tests/render-budget.test.js playable/tests/performance-regression.test.mjs playable/tests/checkpoint-scheduling.test.mjs playable/tests/runtime-territory-independent.test.mjs
node --test playable/tests/d3-session.test.js playable/tests/planet-contact-runtime.test.mjs playable/tests/planet-integrated-runtime.test.mjs
node tools/benchmark-performance.mjs after
node tools/benchmark-creature.mjs after
node node_modules/esbuild/bin/esbuild playable/tests/checkpoint-performance.mjs --bundle --format=iife --outfile=playable/tests/checkpoint-performance.js
node tools/browser-performance.cjs
```

For final manual verification: walk across terrain LOD transitions; rapidly teleport forest → pole → high orbit → basin; verify no holes and continuous support after force preparation. Play long enough to trigger several 2-second checkpoints; move while a checkpoint is in flight, pause, resume/reload and verify position/loot. Confirm `checkpointWorker === true` on the runtime, collect P95/P99/>33/>50 ms over a sustained route, and inspect pixel ratio stays ≥0.90 without resize oscillation. Final whole-game performance remains an integration acceptance task, explicitly not claimed by this delivery.

## Integration contract

1. Copy only paths listed in `delivery/manifest.json`, not this entire old Git worktree. The four owned source modules and new performance modules are complete files.
2. Apply `delivery/expedition-runtime.patch` with `git apply --check` first. It is narrowly scoped and retains `openStorage`, the `behavior==='chase'` attack gate and phase mapping.
3. Run `node tools/integrate-performance.cjs` to validate exact anchors, then `--apply`. It stages all edits before writing and fails if the controller has changed an anchor. This supplies the scene CPU sampler, main movement gate, one-per-render terrain pump and package build wiring. It never replaces whole main/scene/runtime files.
4. `npm run build` must produce both `playable/game.js` and `playable/checkpoint-worker.js`. The Worker `.js` is included; no server MIME/restart changes are required.
5. For test-build custom storage injection, also pass **`checkpointStorageName: actualIsolatedDatabaseName`** to createExpeditionRuntime to exercise the Worker against that same test DB. Custom `openStorage` without this option safely disables the Worker; never pass the production DB name from an isolated test build.
6. `createPlanetTerrain.update(position)` remains synchronous for existing callers/tests; opt in with `{budgetMs:3,maxLoads:1}` for cooperative work. `pending` indicates staging; `revision` changes only on publication. Invalidate terrain-height caches only on revision changes.

The baseline root/receipt persistence schema is untouched. Like the original IndexedDB path, browser termination can interrupt an unacknowledged transaction; a completed commit is authoritative on reload. No claim is made that an asynchronous pagehide handler can force the browser to wait.
