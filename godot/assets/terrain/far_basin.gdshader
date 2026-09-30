shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, diffuse_burley;
#include "res://assets/terrain/terrain_r3.gdshaderinc"
uniform sampler2D near_mask : filter_nearest, repeat_disable;
varying vec3 surface_world;
varying vec3 surface_normal;
void vertex(){
 surface_world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
 surface_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);
}
void fragment(){
 vec2 tile=clamp(floor((surface_world.xz+vec2(3000.0))/160.0),vec2(0.0),vec2(37.0));
 if(texture(near_mask,(tile+vec2(0.5))/38.0).r>0.5){discard;}
 float view_distance=distance(CAMERA_POSITION_WORLD,surface_world);
 ALBEDO=r3_basalt(surface_world,normalize(surface_normal),view_distance);
 ROUGHNESS=0.94;
 METALLIC=0.0;
}
