# C suit full-body animation source

- Author: Quaternius; Universal Animation Library collaboration with animator Gonzalo Furnier.
- Official pack: https://quaternius.com/packs/universalanimationlibrary.html
- Official download: https://quaternius.itch.io/universal-animation-library
- Edition: **free Standard**, downloaded 2026-09-06 through the author's anonymous free download flow. No paid/Pro clips were obtained.
- License: **CC0 1.0 Universal**. Original `License.txt` and `README.txt` accompany `UAL1_Standard.glb`.
- Downloaded Standard ZIP SHA-256: `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724`.

Runtime selections: `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Jump_Loop`, `Driving_Loop`.

`tools/import-authored-motion.mjs` reads the non-root-motion GLB, samples at 60 Hz, converts +Z source forward to -Z game forward, aligns the source T pose with the C garment's bind pose, and retargets 19 bones. Generated `playable/src/authored-motion-data.mjs` is bundled into `game.js`; playing through `file://` does not fetch a GLB, CDN, or network asset. The source GLB is an import input, not a second runtime model or a character replacement.

Start/stop blending, turn steering, speed-distance synchronization and bounded ground IK are game code. S/A/D turn the body toward actual travel; **the free pack does not provide independent backward or strafe clips**, and this implementation does not claim otherwise. The preview uses the same behavior. These are animator-authored source clips, not asserted to be motion capture or extracted from generated concept images.

Rebuild motion data: `node tools/import-authored-motion.mjs`, then `npm run build`. Re-download, if necessary: `node tools/fetch-animation-library.mjs`; extract `Unreal-Godot/UAL1_Standard.glb` from the Standard ZIP to this directory. The source SHA-256 is also embedded in the generated module.
