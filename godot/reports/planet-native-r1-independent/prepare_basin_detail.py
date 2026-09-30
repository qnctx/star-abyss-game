from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'basin_dynamic.gd').read_text(encoding='utf-8').replace('basin1600-final01','basin1600-detail02').replace('im.resize(640,360)','im.resize(960,540)')
s=s.replace('game.player.velocity=Vector3.ZERO','game.player.velocity=Vector3.ZERO\n\tgame.player._vertical_speed=0.0\n\tgame.player._ground_vertical_speed=0.0')
a=s.index('\tmatch tick:');b=s.index('\tif stage.ends_with',a)
s=s[:a]+'''\tmatch tick:
\t\t30:stage="center0";place(0,190,1600)
\t\t150:stage="centerPI";place(0,190,1600,PI)
\t\t270:stage="arena0";place(1370,-1022,1600)
\t\t390:stage="arenaPI";place(1370,-1022,1600,PI)
\t\t510:stage="arena-pan"
\t\t630:stage="near-ground";game.player.teleport_to_ground(0,190);game.player._look_pitch=-0.25;game.player.get_node("CameraPivot").rotation.x=-0.25
\t\t690:finish.call_deferred()
'''+s[b:]
(p/'basin_detail.gd').write_text(s,encoding='utf-8')
r=(p/'run_basin.py').read_text(encoding='utf-8').replace('basin_dynamic.gd','basin_detail.gd').replace('basin1600-final01','basin1600-detail02')
r=r.replace('import ctypes,pathlib,subprocess,sys,time','import ctypes,pathlib,subprocess,sys,time,hashlib,json')
r=r.replace('u=ctypes.windll.user32', '''def manifest():
    files=list((root/'godot/scripts').glob('*.gd'))+list((root/'godot/assets/terrain').glob('*'))+list((root/'godot/scenes').glob('*.tscn'))+[root/'godot/assets/motion-r2/c2-motion-r2.glb']
    return {str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files if f.is_file()}
before=manifest()
(out/'resource-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
u=ctypes.windll.user32''')
r=r.replace('sys.exit(proc.returncode)', '''after=manifest()
    (out/'resource-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8')
    print('RESOURCE_CHANGED', [k for k in before if before[k]!=after.get(k)])
    sys.exit(proc.returncode)''')
(p/'run_basin_detail.py').write_text(r,encoding='utf-8')
