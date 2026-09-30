const fs=require('fs');
let s=fs.readFileSync('godot/tests/native_r2_main_visual.gd','utf8');
s=s.replaceAll('user://star_abyss_native_r2_visual_verify.json','user://star_abyss_vfx_r2_probe.json').replace('res://reports/r2-main','res://assets/vfx-r2/evidence/full-world');
s=s.replace('await _capture("11-r%d-cast-main" % tier)','print("HIGH_STATE ",tier," pos ",effect.global_position," beast ",game.beast.global_position," camera ",camera.global_position," scale ",effect.mesh_root.scale," alpha ",effect.material.get_shader_parameter("intensity"))\n\tawait _capture("11-r%d-cast-main" % tier)');
fs.writeFileSync('godot/assets/vfx-r2/integration_probe.gd',s);
