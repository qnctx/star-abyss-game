# R3 cold-rift and volcanic geology assets

Reference: approved `docs/art/planet-review-r3/12-special-regions.png`, viewed before construction. No new image/Lux generation calls. Geometry is custom authored in `geology_mesh_source.gd`: six different ice pendants and six weathered fumarole rims, each in two LODs. `.tres` files are editable saved ArrayMesh resources; this source regenerates them. No SphereMesh, BoxMesh, ConeMesh or imported primitive placeholders are used.

Ice source uses uneven multi-ring growth profiles, different taper/length/facet patterns and clustered roots. Fumaroles use broken exterior strata, irregular mineral rims and recessed throats. The terrain skins are generated adaptively by `native_planet_regions_r3.gd` using the actual loaded renderer surface at every vertex. They cannot be pre-baked independently of loaded terrain LOD.

`region_geology.gdshader` is private to this module and has ice/cooled-lava/mineral-crust modes. It does not change the shared planetary shader. There are no animated particles, combat actions, damage logic or task buildings. “Steam vent” refers to the mineralized static vent landform; visible steam simulation is not included.

Regenerate the meshes and the two verification screenshots with:

```bat
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game/godot --script res://tests/native_planet_regions_r3_visual.gd --rendering-method gl_compatibility
```

Budgets, integration and known visual gaps: `docs/development/PLANET-REGIONS-R3.md`.
