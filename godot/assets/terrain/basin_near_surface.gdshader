shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, diffuse_burley;
#include "res://assets/terrain/terrain_r3.gdshaderinc"
varying vec3 surface_world;
varying vec3 surface_normal;
void vertex() {
 surface_world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
 surface_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);
}
void fragment() {
 if(COLOR.a<0.5 && CAMERA_POSITION_WORLD.y>350.0){ discard; }
 float view_distance=distance(CAMERA_POSITION_WORLD,surface_world);
 vec3 albedo=r3_basalt(surface_world,normalize(surface_normal),view_distance);
 ALBEDO=albedo;
 ROUGHNESS=0.94;
 METALLIC=0.0;
}
