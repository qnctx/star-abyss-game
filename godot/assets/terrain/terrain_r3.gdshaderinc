// Shared image-derived surface language: R3 02/03/04/09/10.
// All three terrain owners sample in world space; ownership is never a colour mask.
uniform sampler2D basalt_albedo : source_color, repeat_enable, filter_linear_mipmap;
float r3_hash(vec3 p) {
 p = fract(p * 0.1031);
 p += dot(p, p.yzx + 33.33);
 return fract((p.x + p.y) * p.z);
}
float r3_noise(vec3 p) {
 vec3 i = floor(p), f = fract(p);
 f = f * f * (3.0 - 2.0 * f);
 return mix(mix(mix(r3_hash(i),r3_hash(i+vec3(1,0,0)),f.x),
                mix(r3_hash(i+vec3(0,1,0)),r3_hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(r3_hash(i+vec3(0,0,1)),r3_hash(i+vec3(1,0,1)),f.x),
                mix(r3_hash(i+vec3(0,1,1)),r3_hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float r3_height(vec3 p) {
 return length(p - vec3(0.0,-120000.0,0.0)) - 120000.0;
}
vec3 r3_basalt(vec3 p, vec3 outward_normal, float distance_to_eye) {
 vec3 up = normalize(p - vec3(0.0,-120000.0,0.0));
 float slope = 1.0 - clamp(dot(outward_normal,up),0.0,1.0);
 float macro = r3_noise(p * 0.0025);
 float medium = r3_noise(p * 0.045);
 float close_weight = 1.0 - smoothstep(100.0,750.0,distance_to_eye);
 float layers = sin((r3_height(p) + medium * 1.6) * 1.8);
 float exposed = smoothstep(0.06,0.38,slope);
 vec3 dust = mix(vec3(0.285,0.252,0.272),vec3(0.38,0.335,0.335),macro);
 vec3 rock = mix(vec3(0.205,0.184,0.235),vec3(0.30,0.274,0.31),macro);
 rock *= 0.94 + layers * 0.10 * close_weight;
 vec3 axis = pow(abs(outward_normal),vec3(4.0));
 axis /= max(axis.x+axis.y+axis.z,0.001);
 vec3 texture_detail = texture(basalt_albedo,p.yz*0.08).rgb*axis.x
                     +texture(basalt_albedo,p.xz*0.08).rgb*axis.y
                     +texture(basalt_albedo,p.xy*0.08).rgb*axis.z;
 float gravel = smoothstep(0.43,0.73,medium);
 vec3 material = mix(dust,rock,exposed);
 material *= mix(vec3(1.0),vec3(0.62)+texture_detail*2.5,close_weight*mix(0.38,0.85,max(exposed,gravel)));
 return material;
}
vec3 r3_ground(vec3 base, vec3 p, vec3 outward_normal, float distance_to_eye, float basin) {
 float macro = r3_noise(p * 0.0018);
 float meso = r3_noise(p*0.023);
 float detail = (r3_noise(p * 0.12)-0.5) * (1.0-smoothstep(80.0,450.0,distance_to_eye));
 vec3 up = normalize(p - vec3(0.0,-120000.0,0.0));
 float exposed = smoothstep(0.13,0.55,1.0-clamp(dot(outward_normal,up),0.0,1.0));
 vec3 soil = base * (0.77 + macro * 0.18 + meso * 0.24 + detail * 0.22);
 vec3 stone = r3_basalt(p,outward_normal,distance_to_eye);
 soil = mix(soil,stone,exposed*0.78);
 return mix(soil,stone,clamp(basin,0.0,1.0));
}
