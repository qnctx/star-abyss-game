shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec3 tint = vec3(0.10, 0.62, 0.86);
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float phase_age = 0.0;
uniform float flow_direction = 1.0;

void fragment() {
	float width = abs(UV.y * 2.0 - 1.0);
	float edge = pow(max(0.0, 1.0 - width), 0.8);
	float tips = smoothstep(0.0, 0.10, UV.x) * smoothstep(0.0, 0.08, 1.0 - UV.x);
	float flow = 0.80 + 0.20 * sin(UV.x * 38.0 - phase_age * 17.0 * flow_direction + UV.y * 9.0);
	float core = pow(max(0.0, 1.0 - width * 4.0), 3.0) * 0.16;
	float near_fade = smoothstep(0.3, 0.95, length(VERTEX));
	ALBEDO = mix(tint, vec3(0.70, 0.95, 1.0), core);
	EMISSION = tint * 0.35;
	ALPHA = min(0.9, edge * tips * flow * intensity) * near_fade;
}
