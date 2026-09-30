from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'skirt_probe.gd').read_text(encoding='utf-8').replace('basin-skirt03','basin-skirt04')
a=s.index('\tmatch tick:');b=s.index('\tif stage.ends_with',a)
s=s[:a]+'''\tmatch tick:
\t\t30:stage="ground-tile160";game.player.teleport_to_ground(0,165);game.player._look_pitch=-0.25;game.player.get_node("CameraPivot").rotation.x=-0.25;key(KEY_W,true)
\t\t180:key(KEY_W,false);stage="descend350";place(0,190,380);key(KEY_C,true)
\t\t360:key(KEY_C,false);stage="orbit-fixture";place(0,190,125000);game.player._look_pitch=-1.35;game.player.get_node("CameraPivot").rotation.x=-1.35
\t\t480:finish.call_deferred()
'''+s[b:]
(p/'skirt_extra.gd').write_text(s,encoding='utf-8')
r=(p/'run_skirt.py').read_text(encoding='utf-8').replace('skirt_probe.gd','skirt_extra.gd').replace('basin-skirt03','basin-skirt04')
(p/'run_skirt_extra.py').write_text(r,encoding='utf-8')
