shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, diffuse_burley;
uniform sampler2D regional_coverage : filter_nearest;
uniform sampler2D close_coverage : filter_nearest;
uniform int lod_tier=2;
varying vec3 surface_world;
void vertex(){surface_world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 if(lod_tier==0 && texture(regional_coverage,UV).r>0.5){discard;}
 if(lod_tier<2 && texture(close_coverage,UV).r>0.5){discard;}
 float distance_to_eye=distance(CAMERA_POSITION_WORLD,surface_world);
 float ripple=(sin(surface_world.x*0.17+surface_world.z*0.12+TIME*0.55)
              +sin(surface_world.x*0.081-surface_world.z*0.14-TIME*0.36))*0.5;
 float detail=1.0-smoothstep(90.0,900.0,distance_to_eye);
 float shore=exp(-UV2.x/1.8);
 float wave=sin(surface_world.x*0.09+surface_world.z*0.13-TIME*0.6)*0.5+0.5;
 float foam=shore*smoothstep(0.66,0.96,wave)*0.3*detail;
 ALBEDO=mix(COLOR.rgb*(1.0+ripple*0.045*detail),vec3(0.59,0.65,0.61),foam);
 EMISSION=ALBEDO*0.025;
 if(!FRONT_FACING){NORMAL=-NORMAL;}
 METALLIC=0.08;
 ROUGHNESS=mix(0.31,0.47,shore)+ripple*0.025*detail;
}
