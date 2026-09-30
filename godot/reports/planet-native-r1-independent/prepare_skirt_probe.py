from pathlib import Path
p=Path(__file__).resolve().parent
s=(p/'basin_detail.gd').read_text(encoding='utf-8').replace('basin1600-detail02','basin-skirt03')
s=s.replace('var images=[]','var images=[]\nvar rois=[]')
s=s.replace('"assets/terrain/far_basin.gdshader"','"assets/terrain/far_basin.gdshader","assets/terrain/basin_near_surface.gdshader"')
a=s.index('\tmatch tick:');b=s.index('\tif stage.ends_with',a)
s=s[:a]+'''\tmatch tick:
\t\t30:stage="arenaPI";place(1370,-1022,1600,PI)
\t\t150:stage="arena-pan"
\t\t270:stage="skirt350";place(0,190,320)
\t\t300:key(KEY_G,true)
\t\t420:key(KEY_G,false)
\t\t450:stage="near-tile-cross";place(1595,-1022,100);key(KEY_D,true)
\t\t660:key(KEY_D,false);stage="near-ground";game.player.teleport_to_ground(0,190);game.player._look_pitch=-0.25;game.player.get_node("CameraPivot").rotation.x=-0.25;key(KEY_W,true)
\t\t780:key(KEY_W,false);finish.call_deferred()
'''+s[b:]
a=s.index('\tif tick<30 or now-last_image');b=s.index('func finish():',a)
s=s[:a]+'''\tif tick<30:return
\tvar im=root.get_texture().get_image()
\trois.append({"image":im.get_region(Rect2i(0,420,960,100)),"tick":tick,"stage":stage,"wall":(now-start)/1e6})
\tif now-last_image<100000:return
\tlast_image=now
\timages.append({"image":im,"tick":tick,"stage":stage,"wall":(now-start)/1e6})
'''+s[b:]
s=s.replace('\tvar changed=[]','''\tvar roi_meta=[]
\tfor i in range(rois.size()):
\t\tvar r=rois[i]
\t\tvar filename="roi-%04d.png"%i
\t\tr.image.save_png(OUT+"/"+filename)
\t\troi_meta.append({"file":filename,"tick":r.tick,"stage":r.stage,"wall":r.wall})
\tvar changed=[]''')
s=s.replace('"frames":frames,','"frames":frames,"roi_frames":roi_meta,')
(p/'skirt_probe.gd').write_text(s,encoding='utf-8')
r=(p/'run_basin_detail.py').read_text(encoding='utf-8').replace('basin_detail.gd','skirt_probe.gd').replace('basin1600-detail02','basin-skirt03')
(p/'run_skirt.py').write_text(r,encoding='utf-8')
