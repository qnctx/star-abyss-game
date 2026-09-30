# Actual ground tile boundary: targeted pass

UTC **2026-09-29T12:31:04**. This short run closes the mistaken z160 test coverage in the skirt review. Legacy chunks begin at -3000 m with 160 m spacing, so **z200 is an actual boundary**.

Unique test scene/save fixture placed the player at x0,z205 on ground. Normal Main/Player physics stayed enabled; synthetic W then moved continuously to z181.7824, with braking settling at z180.9986. No movement function was manually stepped. This is a fixture followed by real product-input movement, not a trip from the original spawn.

Every physics frame was recorded. At ticks **110→111**, z crossed **200.0901→199.9762**; forward velocity was **-6.799991 m/s** on both sides, AGL about **0.000938 m**, support ready on both sides. No reversed movement step; no sampled unready state, fall-through or edge stall. Across the movement segment AGL ranged **0–0.00094218 m**. The observed boundary is flat, so this result does not cover every sloped/seam configuration.

300 physics frames / **5.0 simulated seconds / 5.120903 wall seconds**. Movement-stage draw intervals p95 **17.167 ms**, maximum **31.756 ms**; startup maximum **97.168 ms**. Timing includes readback. All nine core source hashes and the broader script/terrain/scene/character resource manifests remained unchanged; same world `eb2d135c5ca71f674994ef71c67b5bf467956422dc6020f08d53cbaff3e5cace` as skirt03/04.

Evidence: `ground-edge05/results.json`, `crossing.json`, `summary.json`, `resource-before.json`, `resource-after.json`, and `0018-ground-edge200.png`. Actual Player-camera image retains rocky ground and camp details. The run saved 41 full frames plus 267 rendered-frame crops. No product files or user saves changed.

**Scoped conclusion:** the requested grounded z205→185 crossing succeeds without a support gap, step or collision wall in this case. It closes this specific missing check; existing grain, orbit-framing/residual-art limits and other reports remain as documented. GPU released immediately after the process exited and Main/controller notified. No unrelated suites were rerun.
