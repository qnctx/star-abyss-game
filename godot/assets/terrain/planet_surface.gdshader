shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, diffuse_burley;
#include "res://assets/terrain/terrain_r3.gdshaderinc"
uniform sampler2D regional_coverage : filter_nearest;
uniform sampler2D close_coverage : filter_nearest;
uniform int lod_tier=2;
varying vec3 surface_world;
varying vec3 surface_normal;
void vertex(){
 surface_world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
 surface_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);
}
void fragment(){
 if(lod_tier==0 && texture(regional_coverage,UV).r>0.5){discard;}
 if(lod_tier<2 && texture(close_coverage,UV).r>0.5){discard;}
 // The far opaque sea covers the deep floor completely. Drawing both at
 // orbital distance exceeds GL depth precision when equipment needs near=0.05.
 // Shores, regional/near underwater surfaces and all colliders are retained.
 if(lod_tier==0 && UV2.x < -30.0){discard;}
 // This rectangular discard is ownership only. It must never drive colour.
 if(surface_world.y>-1000.0 && surface_world.y<1000.0 &&
    max(abs(surface_world.x),abs(surface_world.z))<2999.0){discard;}
 float view_distance=distance(CAMERA_POSITION_WORLD,surface_world);
 float basin=clamp(UV2.x,0.0,1.0);
 ALBEDO=r3_ground(COLOR.rgb,surface_world,normalize(surface_normal),view_distance,basin);
 // No tier-dependent material/ambient change when a finer tile replaces its parent.
 EMISSION=ALBEDO*0.018;
 // Actual conformed regional lava seams own the glow; a noise isoline over
 // the entire volcanic weight would draw metre-wide neon loops on every slope.
 if(!FRONT_FACING){NORMAL=-NORMAL;}
 ROUGHNESS=mix(0.94,0.42,UV2.y);
 METALLIC=0.0;
}
