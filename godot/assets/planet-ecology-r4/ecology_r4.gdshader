shader_type spatial;
render_mode cull_disabled;
varying vec3 local_position;
uniform bool rock = false;
float rock_hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float rock_noise(vec3 p) {
	vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
	return mix(mix(mix(rock_hash(i),rock_hash(i+vec3(1,0,0)),f.x),mix(rock_hash(i+vec3(0,1,0)),rock_hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(rock_hash(i+vec3(0,0,1)),rock_hash(i+vec3(1,0,1)),f.x),mix(rock_hash(i+vec3(0,1,1)),rock_hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void vertex() { local_position = VERTEX; }
void fragment() {
	vec3 base = COLOR.rgb;
	bool leaf = base.g > base.r * 1.16;
	float grain = rock ? rock_noise(local_position*3.1)*2.0-1.0 : sin(local_position.x*21.0 + sin(local_position.z*19.0)*2.4 + local_position.y*1.8);
	float fine = rock ? (rock_noise(local_position*21.0)-.5)*.07 : sin(dot(local_position,vec3(271.3,139.7,179.2)))*0.035;
	ALBEDO = base * (leaf ? 1.0+fine : 0.91+grain*0.085+fine);
	ROUGHNESS = leaf ? 0.83 : 0.98;
}
