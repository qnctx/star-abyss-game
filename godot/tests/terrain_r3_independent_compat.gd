extends "res://tests/native_planet_main_verify.gd"

## Reuse existing real reload/migration/vehicle/duel integration assertions.
## Override before add_child/_ready so even legacy fixture writes stay in report.
func _make_main() -> NativeMain:
	var directory := OS.get_environment("TERRAIN_R3_OUTPUT")
	assert(not directory.is_empty(), "Run with terrain_r3_independent_capture.py --compat")
	slot = directory.path_join("compat-isolated-save.json")
	return super._make_main()
