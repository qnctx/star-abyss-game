# Owner evidence classification — 2026-09-30

Independent CPU audit of existing owner reports and selected test source only. No Godot process, GPU work, product modification, independent gameplay rerun or visual acceptance in this audit. Flight retains its allocated runtime window; ecology assets remain staging pending the owner's repair and real combined test.

## Follow-up: owner scope corrections checked

CPU reread confirms the corrected library report uses `loaded_key_values_sha256` for all 16 entries and an explicit `fingerprint_scope` excluding key times/interpolation. `docs/martial-r4.md` now correctly states same-SceneTree re-instantiation, disabled physics and an imported environment marker, with OS-process restart and actual destruction recovery still pending. These are evidence-description corrections, not new test passes.

The newly supplied `surface-contract-verification.json` records a summary archived from original tool stdout: `checks: 53`, `failed: []`, `exit_code: 0`, plus script/module SHA256 and explicit fakes-only scope. It is a summary, not 53 individually inspectable assertions; this audit confirms the artifact content, not the original execution. This supersedes the earlier “artifact not located” status below while retaining that initial audit history.

Corrected metadata is captured separately in `OWNER-CPU-AUDIT-CORRECTED.json`; initial `OWNER-CPU-AUDIT.json` and the original report hashes below remain historical. The CPU script now writes the corrected file. Ecology r4.2 topology compatibility is explicitly pending under new E6 in `ACCEPTANCE-PLAN.md`: migrate valid r4.1 records correctly or reject without overwriting primary/backup/sidecar, including attempted saves and teardown. No assumption that old user records do not exist is permitted.

## Initial audit record

| Evidence | Audited scope | Exclusions / remaining work |
|---|---|---|
| `martial-r4/loaded-library-verification.json` | Owner report records 16 loaded martial clips, 51 bones, 49 tracks per clip, positive durations, loaded-key signatures and seven matching GLB source/cache MD5 entries. Test loads NativeMotionR2 and actual Animation resources. | Loading evidence, not anatomy, normal-speed motion or combat correctness. Key signature concatenates track paths and values, not key times/interpolation; do not call it a complete animation-content hash. No independent Godot load repeated. |
| Surface mock 53/53 | Controller-reported contract test only. Exact 53-check artifact not located/independently audited in this pass. | No real terrain, LOS, collision, streaming, destruction or combined gameplay pass follows. Keep this count attributed until exact report is supplied. |
| `martial-r4/save-recovery-verification.json` | 107 check entries all report true; failed list empty. Source instantiates real Main in private slots, writes actual disk files, destroys Main/environment nodes, and reinstantiates them. Covers selected skill/cooldowns and same-commit environment marker, stale sidecar, backup recovery, backup preservation on first subsequent save, dual corruption, invalid inline data and F5 failure. | **Same-process scene reload, not OS-process restart.** `_boot`/`_dispose` operate in one SceneTree, and `_run` awaits successive cases. Test disables combatants/martial/NPC physics and then Main/Player physics to isolate save behavior. Environment marker is imported directly, not produced by destroying a tree/rock. No independent persistence rerun. |
| `martial-r4/save-recovery-dependency-hashes.json` | 14 before/after raw SHA256 values match. Initial CPU recomputation matched all 14; the final CPU check found `native_player.gd` changed during this audit, so current checkout matches only 13/14. | Owner evidence stays attached to its recorded revision, not the latest Player. Not a complete dependency manifest: test scripts, NPC scripts, scene and assets are outside this 14-script list. Does not establish unchanged future runs or a process-restart test. |
| `martial-r4/basic-verification.json` | 16 entries report true; owner labels stationary real enemy to isolate geometry. | Metadata audit only here; no new image review or AI/environment acceptance. |

The controller handoff's phrase “process reopen” is narrowed to “complete Main scene destruction/re-instantiation with real disk I/O” for this particular save-recovery artifact. Fresh-process reload remains open in E5/N4 of `ACCEPTANCE-PLAN.md`; another separately identified test could cover it, but this report does not.

Report snapshots: library raw SHA256 `dc5b41e86b32626cb3d5327fa715a54ac5ca6e18329cf1dfc9a7226c76ac516f`; save recovery `5495c910c0fca8816a3615c17741b4da47d17a1fb6df58056110ded4f33cb9c1`. Full metadata/classification inputs and current hash comparison are preserved in `OWNER-CPU-AUDIT.json`.

Reproduce CPU checks: run `py -3 godot/reports/systems-independent/audit_owner_reports.py` from this worktree. This reads owner JSON/scripts/GLB bytes and writes only the independent audit JSON. The next runtime verification must use a newly frozen source manifest, actual input/automatic physics for gameplay claims, a fresh process for persistence claims, and controller GPU scheduling. jev remains untested pending user documentation.
