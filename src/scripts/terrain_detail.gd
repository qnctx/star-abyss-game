extends MeshInstance3D

## Terrain detail shader — adds procedural rock/dust/soil variation to alien ground.
## Attach this script to the terrain MeshInstance3D node.

@export var base_color: Color = Color(0.34, 0.32, 0.28, 1.0)
@export var rock_color: Color = Color(0.18, 0.17, 0.16, 1.0)
@export var dust_color: Color = Color(0.48, 0.43, 0.36, 1.0)
@export var uv_scale: float = 22.0
@export var detail_strength: float = 0.55
@export var roughness: float = 0.92


func _ready() -> void:
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec4 base_color : source_color = vec4(0.34, 0.32, 0.28, 1.0);
uniform vec4 rock_color : source_color = vec4(0.18, 0.17, 0.16, 1.0);
uniform vec4 dust_color : source_color = vec4(0.48, 0.43, 0.36, 1.0);
uniform float uv_scale = 22.0;
uniform float detail_strength = 0.55;
uniform float roughness = 0.92;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += noise(p) * a;
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

void fragment() {
	vec2 uv = UV * uv_scale;

	float large = fbm(uv * 0.18);
	float mid = fbm(uv * 0.9);
	float fine = fbm(uv * 4.5);

	float cracks = smoothstep(0.46, 0.52, abs(fbm(uv * 1.7) - 0.5));
	float pebbles = smoothstep(0.72, 0.95, fine);

	vec3 col = base_color.rgb;
	col = mix(col, rock_color.rgb, large * 0.65);
	col = mix(col, dust_color.rgb, mid * 0.35);
	col *= 0.82 + fine * 0.34;
	col = mix(col, rock_color.rgb * 0.65, cracks * 0.42);
	col = mix(col, dust_color.rgb * 1.15, pebbles * 0.22);

	ALBEDO = col;
	ROUGHNESS = roughness;
	METALLIC = 0.0;

	float height = large * 0.42 + mid * 0.28 + fine * 0.12;
	NORMAL_MAP = vec3(
		(fbm((uv + vec2(0.035, 0.0)) * 1.2) - height) * detail_strength,
		(fbm((uv + vec2(0.0, 0.035)) * 1.2) - height) * detail_strength,
		1.0
	);
	NORMAL_MAP_DEPTH = 0.65;
}
"""

	var mat := ShaderMaterial.new()
	mat.shader = shader
	mat.set_shader_parameter("base_color", base_color)
	mat.set_shader_parameter("rock_color", rock_color)
	mat.set_shader_parameter("dust_color", dust_color)
	mat.set_shader_parameter("uv_scale", uv_scale)
	mat.set_shader_parameter("detail_strength", detail_strength)
	mat.set_shader_parameter("roughness", roughness)
	material_override = mat