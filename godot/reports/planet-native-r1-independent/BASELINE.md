# Old native square reproduced

Source snapshot UTC 2026-09-27T14:44:25.653929Z. Actual main scene capture completed with `changed=[]`; see `old-square-baseline/capture.json` for capture UTC, camera positions and source hashes. Source files are backed up under its `source/` directory.

Independently viewed all three PNGs:

- `overview-default.png`: default atmosphere retains a visible square/diamond silhouette.
- `overview-no-fog-diagnostic.png`: same camera with fog disabled in this test instance clearly shows a finite square terrain tile.
- `east-edge-no-fog-diagnostic.png`: camera (3180,220,500) looking toward (2980,0,0) shows the straight eastern cutoff and empty space beyond it.

This reproduces the geometry issue, not merely a source-code prediction. These are free diagnostic camera views of the actual main scene; no claim that the player flew to these positions or traversed the boundary. Product files were not edited. Test instance used a unique save path. Fog-disabled shots are explicitly labelled and will not be presented as default product appearance.

Old native_world SHA256 `2d88df9646bb3e4ec61f4d8acd6929a8aafcdf7f13f6fd3de624d4475167c40a`; its original code has HALF_SIZE=3000, clamped height queries/stream indices and solid out-of-bounds checks. Source snapshot includes Player/Main/scene for later compatibility comparisons; no user save is mutated.

Reproduction: `py -3 godot\reports\planet-native-r1-independent\run_baseline.py` from the verification worktree. Do not rerun into the historical directory after world changes; use a new output directory/script target for delivery captures. Current `run_baseline.py` is a historical baseline runner only. Planet acceptance remains pending all PLAN.md gates.
