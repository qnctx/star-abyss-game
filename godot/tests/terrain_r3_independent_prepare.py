"""Create isolated copies of existing integration tests, no production edits."""
from pathlib import Path
import hashlib
import json

TESTS = Path(__file__).resolve().parent
mapping = {
    'flight': 'native_planet_product_flight_verify.gd',
    'edge': 'native_planet_edge_cross_verify.gd',
    'vehicle': 'native_planet_vehicle_verify.gd',
}
records = {}
for key, source in mapping.items():
    path = TESTS / source
    content = path.read_text(encoding='utf-8')
    original = content
    if key == 'flight':
        content = content.replace('const SLOT := "user://star_abyss_native_planet_product_flight_verify.json"', 'var SLOT := OS.get_environment("TERRAIN_R3_OUTPUT").path_join("flight-save.json")')
        content = content.replace('const REPORT := "res://reports/planet-native-player/product-flight-final.json"', 'var REPORT := OS.get_environment("TERRAIN_R3_OUTPUT").path_join("product-flight.json")')
        content = content.replace('const ORBIT_SCREENSHOT := "res://reports/planet-native-player/product-orbit-final.png"', 'var ORBIT_SCREENSHOT := OS.get_environment("TERRAIN_R3_OUTPUT").path_join("product-orbit.png")')
        content = content.replace('"res://tests/native_planet_product_flight_verify.gd"', '"res://tests/terrain_r3_independent_flight.gd"')
        content = content.replace('var radial_speed := 0.0', '''var radial_speed := 0.0
	var render_ms: Array[float] = []
	var last_render_usec := 0

	func _process(_delta: float) -> void:
		var now := Time.get_ticks_usec()
		if last_render_usec > 0:
			render_ms.append(float(now-last_render_usec)/1000.0)
		last_render_usec = now''')
        content = content.replace('if observer.agl >= 2000.0 and not milestones.has("2km"):', '''if observer.agl >= 1600.0 and not milestones.has("1600m"):
			_mark("1600m", player)
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(OS.get_environment("TERRAIN_R3_OUTPUT").path_join("product-1600m.png"))
		if observer.agl >= 2000.0 and not milestones.has("2km"):''')
        content = content.replace('"source_sha256_start": source_started,', '"render_intervals_ms": observer.render_ms, "source_sha256_start": source_started,')
        # Read observer samples before freeing it; original result assembled after frame await.
        content = content.replace('observer.queue_free()', 'var render_samples: Array[float] = observer.render_ms.duplicate()\n\tobserver.queue_free()')
        content = content.replace('"render_intervals_ms": observer.render_ms', '"render_intervals_ms": render_samples')
        content = content.replace('var orbit_capture: Dictionary = {}', 'var orbit_capture: Dictionary = {}\nvar hold_repairs := {"G": 0, "C": 0}')
        content = content.replace('for i in range(6000):\n\t\tawait _frames(1)', 'for i in range(6000):\n\t\tif not player._held_g:\n\t\t\thold_repairs["G"] += 1\n\t\t\t_key(KEY_G, true)\n\t\tawait _frames(1)')
        content = content.replace('for i in range(9000):\n\t\tawait _frames(1)', 'for i in range(9000):\n\t\tif not player._held_c:\n\t\t\thold_repairs["C"] += 1\n\t\t\t_key(KEY_C, true)\n\t\tawait _frames(1)')
        content = content.replace('"render_intervals_ms": render_samples,', '"synthetic_hold_reassertions": hold_repairs, "render_intervals_ms": render_samples,')
        # Avoid dumping tens of thousands of timing numbers into the terminal.
        content = content.replace('print("NATIVE_PLANET_PRODUCT_FLIGHT_JSON=" + JSON.stringify(result))', 'print("NATIVE_PLANET_PRODUCT_FLIGHT_RESULT=" + JSON.stringify({"passed": checks.size()-failures.size(), "total": checks.size(), "failures": failures, "hold_reassertions": hold_repairs}))')
    elif key == 'edge':
        content = content.replace('const SLOT := "user://star_abyss_native_planet_edge_cross_verify.json"', 'var SLOT := OS.get_environment("TERRAIN_R3_OUTPUT").path_join("edge-save.json")')
    else:
        content = content.replace('"user://star_abyss_planet_vehicle_verify_%d.json" % Time.get_ticks_usec()', 'OS.get_environment("TERRAIN_R3_OUTPUT").path_join("vehicle-save.json")')
    assert content != original
    destination = TESTS / ('terrain_r3_independent_' + key + '.gd')
    destination.write_text(content, encoding='utf-8')
    records[key] = {'source': source, 'source_sha': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'adapted_sha': hashlib.sha256(destination.read_bytes()).hexdigest()}
(TESTS / 'terrain_r3_independent_adapters.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print('Prepared isolated flight/edge/vehicle adapters')
