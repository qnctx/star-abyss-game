from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'skirt_extra.gd').read_text(encoding='utf-8').replace('basin-skirt04','ground-edge05')
s=s.replace('if tick%6==0:','if tick%1==0:')
a=s.index('\tmatch tick:');b=s.index('\tif stage.ends_with',a)
s=s[:a]+'''\tmatch tick:
\t\t30:stage="ground-edge200";game.player.teleport_to_ground(0,205);game.player._look_pitch=-0.25;game.player.get_node("CameraPivot").rotation.x=-0.25
\t\t60:key(KEY_W,true)
\t\t270:key(KEY_W,false);stage="settle"
\t\t300:finish.call_deferred()
'''+s[b:]
(p/'ground_edge.gd').write_text(s,encoding='utf-8')
r=(p/'run_skirt_extra.py').read_text(encoding='utf-8').replace('skirt_extra.gd','ground_edge.gd').replace('basin-skirt04','ground-edge05')
(p/'run_ground_edge.py').write_text(r,encoding='utf-8')
