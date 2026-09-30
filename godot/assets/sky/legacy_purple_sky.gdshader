shader_type sky;

// Port of the source game's purple sky, cloudy rift band, and ringed body.
// Rendered at infinity, so it adds no world meshes or collision geometry.
float hash3(vec3 p) {
	return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
		mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
		mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

void sky() {
	vec3 d = normalize(EYEDIR);
	float horizon = max(d.y, 0.0);
	vec3 color = mix(vec3(0.25, 0.14, 0.20), vec3(0.018, 0.024, 0.069), pow(horizon, 0.38));
	float band = pow(max(0.0, 1.0 - abs(d.y * 0.85 + d.x * 0.31 - 0.39) * 2.8), 3.0);
	float cloud = noise3(d * 7.0);
	float detail = noise3(d * 23.0);
	color += band * cloud * cloud * vec3(0.42, 0.12, 0.35);
	color += band * pow(detail, 4.0) * vec3(0.32, 0.25, 0.56);
	float star = pow(hash3(floor(d * 1800.0)), 1700.0) * smoothstep(0.03, 0.22, d.y);
	color += star * vec3(0.75, 0.83, 1.0);

	vec3 body_dir = normalize(vec3(0.32, 0.29, -1.0));
	vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), body_dir));
	vec3 up = normalize(cross(body_dir, right));
	float front = dot(d, body_dir);
	if (front > 0.7) {
		vec2 disc = vec2(dot(d, right), dot(d, up)) / front;
		float distance = length(disc);
		vec2 tilted = vec2(disc.x * 0.94 + disc.y * 0.34, -disc.x * 0.34 + disc.y * 0.94);
		float ring_radius = length(vec2(tilted.x, tilted.y / 0.42));
		float ring = (1.0 - smoothstep(0.145, 0.149, ring_radius)) * smoothstep(0.113, 0.118, ring_radius);
		float rings = (1.0 - smoothstep(0.202, 0.207, ring_radius)) * smoothstep(0.153, 0.159, ring_radius);
		color = mix(color, vec3(0.48, 0.32, 0.48), max(ring * 0.48, rings * 0.33));
		float body = 1.0 - smoothstep(0.109, 0.114, distance);
		float stripes = 0.5 + 0.5 * sin(disc.y * 185.0 + sin(disc.x * 43.0) * 0.7);
		vec3 body_color = mix(vec3(0.30, 0.22, 0.38), vec3(0.65, 0.54, 0.68), stripes);
		body_color *= clamp(0.72 + dot(disc, vec2(-2.8, 3.1)), 0.24, 1.0);
		color = mix(color, body_color, body);
	}
	COLOR = color;
}
