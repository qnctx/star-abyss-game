extends SceneTree
func _initialize() -> void:
	call_deferred("_run")
func _run() -> void:
	var motion := NativeMotionR2.new()
	root.add_child(motion)
	await process_frame
	var count := 0
	var clips: Array[Dictionary] = []
	var tracks_ok := true
	for name in motion.names:
		if "cast_martial_" in name:
			count += 1
			var animation: Animation = motion.player.get_animation(motion.names[name])
			var signature := ""
			for track in range(animation.get_track_count()):
				signature += str(animation.track_get_path(track))
				for key in range(animation.track_get_key_count(track)):
					signature += str(animation.track_get_key_value(track, key))
			# Godot may remove immutable scale tracks during scene import. The
			# source GLB has 153; record actual tracks and keys rather than forcing
			# the imported representation to mirror the exporter byte for byte.
			tracks_ok = tracks_ok and animation.get_track_count() > 0 and animation.length > 0.0
			clips.append({"name": name, "resource_name": motion.names[name], "duration": animation.length, "tracks": animation.get_track_count(), "loaded_key_values_sha256": signature.sha256_text()})
	var imports: Array[Dictionary] = []
	var imports_current := true
	for name in ["c2-martial-r4", "charge", "fist", "slash", "pressure", "impact", "aperture"]:
		var path: String = "res://assets/martial-r4/" + name + ".glb"
		var config := ConfigFile.new()
		var parsed := config.load(path + ".import") == OK
		var cache_path := String(config.get_value("remap", "path", "")) if parsed else ""
		var checksum_path := cache_path.get_basename() + ".md5"
		var checksum := FileAccess.get_file_as_string(checksum_path) if FileAccess.file_exists(checksum_path) else ""
		var cached_md5 := checksum.get_slice("source_md5=\"", 1).get_slice("\"", 0)
		var current_md5 := FileAccess.get_md5(path)
		var matches := not cached_md5.is_empty() and cached_md5 == current_md5
		imports_current = imports_current and matches
		imports.append({"path": path, "source_sha256": FileAccess.get_sha256(path), "source_md5": current_md5, "cached_source_md5": cached_md5, "matches": matches})
	var ok := count == 16 and motion._rig.get_bone_count() == 51 and tracks_ok and imports_current
	var report := {"clips": clips, "bones": motion._rig.get_bone_count(), "imports": imports, "ok": ok, "fingerprint_scope": "Ordered track paths and key values only; excludes times and interpolation modes. Source MD5 separately verifies the GLB import cache."}
	DirAccess.make_dir_recursive_absolute("res://reports/martial-r4")
	var output := FileAccess.open("res://reports/martial-r4/loaded-library-verification.json", FileAccess.WRITE)
	output.store_string(JSON.stringify(report, "\t"))
	print("MARTIAL_LIBRARY ", JSON.stringify({"clips": count, "bones": motion._rig.get_bone_count(), "tracks_ok": tracks_ok, "imports_current": imports_current, "ok": ok}))
	motion.free()
	quit(0 if ok else 1)
