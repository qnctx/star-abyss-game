shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;

uniform vec3 tint = vec3(0.25, 0.8, 1.0);
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float phase_age = 0.0;
uniform float core_strength = 0.3;

void fragment() {
    float width = abs(UV.y * 2.0 - 1.0);
    float edge = pow(max(0.0, 1.0 - width), 1.2);
    float tips = smoothstep(0.0, 0.12, UV.x) * smoothstep(0.0, 0.09, 1.0 - UV.x);
    float striation = 0.78 + 0.22 * sin(UV.x * 38.0 - phase_age * 17.0 + UV.y * 9.0);
    float white_core = pow(max(0.0, 1.0 - width * 4.0), 3.0) * core_strength;
    // Keep depth testing enabled; view-space near fade protects first-person view.
    float near_fade = smoothstep(0.3, 0.95, length(VERTEX));
    ALBEDO = mix(tint * 2.25, vec3(2.8), white_core);
    ALPHA = min(0.85, edge * tips * striation * intensity) * near_fade;
}
