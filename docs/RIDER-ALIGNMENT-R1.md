# RIDER-ALIGNMENT-R1

Based on SUPPORT-TERRITORY-R1 copied read-only from E:/myProject/star-abyss-game into the isolated 668d worktree. No formal saves or port 4173 were touched.

The original vehicle and original C2 GLB now share one hull-local rider layout. The seated pose leans the torso within the original arm reach, solves both wrists against the steered grips and places both feet at the existing supports. Native GLB retargeting compensates for the authored glove palm length. The independent cockpit arms are removed. First person renders the same character with the existing head mask and takes its eye from the native head bone.

Integration: copy only the files listed in reports/rider-alignment/SHA256.json. Apply reports/rider-alignment/scene-integration.patch manually or with git apply; do not copy scene.mjs or game.js. It imports applyMountedVehicleView and calls it immediately after planetController.updateScene, after the final local or spherical support transform. No main.mjs or planet-runtime.mjs edits are required. Rebuild in the controller tree.

Validation commands:

- npm run build
- node --test playable/tests/rider-alignment.test.mjs playable/tests/vehicle-camera.test.js playable/tests/vehicle-slope-audit.test.mjs playable/tests/planet-contact-runtime.test.mjs
- node tools/rider-browser.cjs
- node tools/rider-browser.cjs planetFixture=backside-vehicle

The browser script starts and stops its own isolated 4186 server, uses test-only fixtures and a new browser context, and captures both views plus steering. Screenshots and JSON evidence live under reports/rider-alignment. The native-palm and support-transform tests cover straight/left/right steering and flat/sloping/arbitrary remote rotations. Vehicle GLB is re-exported and SHA-checked against current vehicle-model, vehicle-cockpit and vehicle-rig sources. The older .blend is retained as historical source and is not re-exported by this change.

The canonical camera resolver provides a shared fallback eye; the final rendered mounted view uses the loaded character's actual eye. Looking around changes direction without moving the seat or steering the vehicle. For a close dashboard inspection look down, as the true rider view preserves the physical field of view.

Final regression evidence: tests.tap records 19/19 passing driving/contact/GLB tests; pose-regression.tap records 5/5 original native-retarget/prone tests. Because the prone animation manifest hashes shared source files, the original four-clip prone GLB and manifest were also re-exported with the original exporter. No new character artwork was generated. The corresponding historical Blender project was not changed.

Head-mask evidence: characterAsset.firstPersonHeadHidden exposes the actual uniform input. Browser regression checks mounted first → third → dismount and, on the local fixture, prone first → stand → scanner equipment. The remote fixture's night-side environment is dark; the vehicle instrument remains legible and its same original hands are visible. This lighting is outside this change.
