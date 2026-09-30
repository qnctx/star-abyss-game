extends RefCounted
## R4 image-derived meshes. JSON is source; offline-baked resources are runtime.
const ROOT := "res://assets/planet-ecology-r4/"
var assets: Dictionary = {}
var parts: Dictionary = {}
var material: ShaderMaterial
var prefer_baked := true

func load_library() -> void:
	material = ShaderMaterial.new()
	material.shader = load(ROOT+"ecology_r4.gdshader")
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ROOT+"manifest.json"))
	for item: Dictionary in manifest.assets:
		var data := item.duplicate(true)
		data["mesh"] = mesh_named(item.id)
		for segment: Dictionary in data.segments:
			segment.a = vec(segment.a)
			segment.b = vec(segment.b)
		assets[item.id] = data

func mesh_named(key: String) -> ArrayMesh:
	if parts.has(key): return parts[key]
	var mesh: ArrayMesh
	if prefer_baked and ResourceLoader.exists(ROOT+key+".res"):
		mesh = load(ROOT+key+".res") as ArrayMesh
	else:
		var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ROOT+key+".json"))
		var vertices := PackedVector3Array()
		var colors := PackedColorArray()
		var normals := PackedVector3Array()
		for point: Array in data.vertices: vertices.append(vec(point))
		for color: Array in data.colors: colors.append(Color(color[0],color[1],color[2]))
		for i in range(0,vertices.size(),3):
			# Godot front faces are clockwise; source triangles are counterclockwise.
			var swap := vertices[i+1]
			vertices[i+1] = vertices[i+2]
			vertices[i+2] = swap
			var normal := (vertices[i+2]-vertices[i]).cross(vertices[i+1]-vertices[i]).normalized()
			for j in range(3): normals.append(normal)
		if not key.begins_with("outcrop"):
			var sums := {}
			for i in range(vertices.size()):
				if colors[i].g>colors[i].r*1.16: continue
				var point := vertices[i].snapped(Vector3.ONE*.0001)
				sums[point] = (sums.get(point,Vector3.ZERO) as Vector3)+normals[i]
			for i in range(vertices.size()):
				if colors[i].g>colors[i].r*1.16: continue
				normals[i] = (sums[vertices[i].snapped(Vector3.ONE*.0001)] as Vector3).normalized()
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = vertices
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_COLOR] = colors
		mesh = ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
		var surface_material := material.duplicate() as ShaderMaterial
		surface_material.set_shader_parameter("rock",key.begins_with("outcrop"))
		mesh.surface_set_material(0,surface_material)
	parts[key] = mesh
	return mesh

static func vec(a: Array) -> Vector3:
	return Vector3(float(a[0]),float(a[1]),float(a[2]))

static func add_segment(body: CollisionObject3D, segment: Dictionary, offset := Vector3.ZERO) -> CollisionShape3D:
	if not segment.get("physical",true): return null
	var a: Vector3 = segment.a
	var b: Vector3 = segment.b
	var radius := float(segment.radius)
	var shape := CapsuleShape3D.new()
	shape.radius = radius
	shape.height = a.distance_to(b)+radius*2.0
	var node := CollisionShape3D.new()
	node.shape = shape
	node.position = (a+b)*0.5-offset
	node.basis = Basis(Quaternion(Vector3.UP,(b-a).normalized()))
	node.set_meta("part",segment.part)
	body.add_child(node)
	return node
