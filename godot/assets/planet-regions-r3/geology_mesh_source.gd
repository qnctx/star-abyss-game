extends RefCounted
## Editable reference-12 geometry source; no primitive mesh resources.

static func material(kind: int) -> ShaderMaterial:
	var result := ShaderMaterial.new()
	result.shader = load("res://assets/planet-regions-r3/region_geology.gdshader")
	result.set_shader_parameter("geology_kind",kind)
	return result

static func triangle(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, color: Color) -> void:
	st.set_color(color)
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)

static func ice_cluster(variant: int, lod: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var count: int = 7 if lod==0 else 4
	var sides: int = 9 if lod==0 else 6
	var rings: int = 8 if lod==0 else 5
	for tooth in range(count):
		var phase: float = float(variant)*1.71 + tooth*2.37
		var length: float = 3.2 + 5.7*(0.5+0.5*sin(phase))
		var radius: float = 0.23 + 0.53*(0.5+0.5*cos(phase*1.7))
		var anchor := Vector3((tooth-float(count-1)*0.5)*1.05,0.1*sin(phase),0.32*cos(phase))
		var grid: Array[Vector3] = []
		for ring in range(rings+1):
			var t: float = float(ring)/rings
			for side in range(sides):
				var angle: float = TAU*side/sides
				var taper: float = pow(1.0-t,0.67)*(1.0+0.16*sin(t*18.0+phase))
				var facet: float = 0.83+0.17*sin(side*2.7+phase)
				grid.append(anchor+Vector3(cos(angle)*radius*taper*facet + sin(t*2.0+phase)*t*0.25,-length*t,sin(angle)*radius*taper*facet + t*t*0.25))
		for ring in range(rings):
			for side in range(sides):
				var a: int = ring*sides+side
				var b: int = ring*sides+(side+1)%sides
				var color := Color(0.45+0.5*float(ring)/rings,0.4+0.3*sin(phase),0.0)
				triangle(st,grid[a],grid[b],grid[a+sides],color)
				triangle(st,grid[b],grid[b+sides],grid[a+sides],color)
	st.generate_normals()
	st.set_material(material(0))
	return st.commit()

static func vent(variant: int, lod: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var sides: int = 28 if lod==0 else 14
	# Weathered rim, shattered exterior strata, throat and recessed mineral floor.
	const RADII: Array[float] = [4.8,4.15,3.3,2.65,2.0,1.4,1.05,0.3]
	const HEIGHTS: Array[float] = [-0.35,0.25,0.68,1.25,1.95,1.45,0.3,0.05]
	var grid: Array[Vector3] = []
	for ring in range(RADII.size()):
		for side in range(sides):
			var angle: float = TAU*side/sides
			var phase: float = variant*1.53
			var fracture: float = 0.87+0.11*sin(angle*5.0+phase)+0.06*cos(angle*9.0-phase)
			var radius: float = RADII[ring]*fracture
			var height: float = HEIGHTS[ring]+(0.12+0.05*ring)*sin(angle*7.0+phase)
			grid.append(Vector3(cos(angle)*radius,height,sin(angle)*radius*0.78))
	for ring in range(RADII.size()-1):
		for side in range(sides):
			var a: int = ring*sides+side
			var b: int = ring*sides+(side+1)%sides
			var color := Color(0.13 if ring<4 else 0.65,0.35+0.15*sin(side*2.7),0.25 if ring<4 else 0.75)
			triangle(st,grid[a],grid[a+sides],grid[b],color)
			triangle(st,grid[b],grid[a+sides],grid[b+sides],color)
	st.generate_normals()
	st.set_material(material(2))
	return st.commit()
