shader_type spatial;
render_mode cull_disabled;
uniform int asset_kind = 0;
varying vec3 local_position;
float hash3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void vertex(){local_position=VERTEX;}
void fragment(){
 vec3 p=local_position;
 float grain=noise3(p*22.0)*0.5+noise3(p*64.0)*0.3+noise3(p*5.0)*0.2;
 vec3 base=COLOR.rgb;
 if(asset_kind==0 && base.g<base.r*1.18){
  float groove=pow(abs(sin(atan(p.z,p.x)*39.0+noise3(p*vec3(5.0,0.35,5.0))*4.0)),0.35);
  base*=0.55+grain*0.65+groove*0.3;
 }else if(asset_kind>=2 && asset_kind<6 && asset_kind!=4){
  float seam=smoothstep(0.04,0.14,abs(sin(p.y*10.0+noise3(p*1.6)*1.1)));
  base*=0.60+grain*0.6+seam*0.20;
 }
 ALBEDO=pow(max(base,vec3(0.0)),vec3(1.2));
 SPECULAR=asset_kind==4?0.8:0.12;
 BACKLIGHT=(asset_kind==0 && base.g>base.r*1.18)?ALBEDO*0.25:vec3(0.0);
 ROUGHNESS=asset_kind==4?0.22:0.94;
 METALLIC=asset_kind==4?0.5:0.0;
}
