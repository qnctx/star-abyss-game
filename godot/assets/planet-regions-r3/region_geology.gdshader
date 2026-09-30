shader_type spatial;
render_mode cull_disabled;
uniform vec4 stone_color : source_color = vec4(0.12,0.105,0.13,1.0);
uniform int geology_kind = 0; // 0 ice, 1 cooled lava, 2 fumarole crust
varying vec3 local_point;
void vertex(){ local_point = VERTEX; }
void fragment(){
    float strata = sin(local_point.y*4.7 + sin(local_point.x*2.3)*2.7 + sin(local_point.z*1.9)*2.0)*sin(local_point.z*3.7+local_point.x*2.1);
    float vein = abs(sin(local_point.x*2.1 + sin(local_point.z*1.6)*1.8 + local_point.y*0.8));
    if(geology_kind==0){
        ALBEDO = mix(vec3(0.20,0.42,0.52),vec3(0.70,0.85,0.89),clamp(COLOR.r*0.95+strata*0.20,0.0,1.0));
        ROUGHNESS = 0.24 + COLOR.g*0.25;
        METALLIC = 0.03;
    }else{
        float fissure = (1.0-smoothstep(0.035,0.09,vein))*COLOR.r;
        ALBEDO = stone_color.rgb*(0.7+COLOR.g*0.7+strata*0.06);
        ROUGHNESS = 0.87;
        EMISSION = vec3(0.72,0.055,0.009)*fissure*(0.16+COLOR.b*0.35);
        if(geology_kind==2){ ALBEDO = mix(ALBEDO,vec3(0.36,0.32,0.23),COLOR.b*0.5); }
    }
}
