from PIL import Image,ImageDraw
from pathlib import Path
p=Path('godot/assets/motion-r2/evidence')
(p/'.gdignore').write_text('')
for clip in ['idle','walk','jog','sprint','cruise','boost','jab','cross','kick','guard','hit','cast']:
 sheet=Image.new('RGB',(8*240,3*200),(18,22,29));d=ImageDraw.Draw(sheet)
 for v in range(3):
  for f in range(8):
   im=Image.open(p/f'{clip}-v{v}-f{f}.png');im.thumbnail((240,180));sheet.paste(im,(f*240,v*200+20));d.text((f*240+4,v*200+3),f'{clip} view {v} t={f/8:.3f}',fill='white')
 sheet.save(p/f'{clip}-sheet.jpg')
p=Path('godot/assets/vfx-r2/evidence');(p/'.gdignore').write_text('')
sheet=Image.new('RGB',(8*240,3*200),(18,22,29));d=ImageDraw.Draw(sheet)
for v in range(3):
 for f in range(8):
  im=Image.open(p/f'qi-v{v}-f{f}.png');im.thumbnail((240,180));sheet.paste(im,(f*240,v*200+20));d.text((f*240+4,v*200+3),f'qi view {v} t={f/10:.1f}s',fill='white')
sheet.save(p/'qi-sheet.jpg')
p=Path('godot/assets/motion-r2/evidence')
frames=[]
sheet=Image.new('RGB',(6*320,4*260),(18,22,29));d=ImageDraw.Draw(sheet)
for idx,f in enumerate(range(0,360,15)):
 im=Image.open(p/f'sequence-{f:03d}.png');im.thumbnail((320,240));sheet.paste(im,((idx%6)*320,(idx//6)*260+20));d.text(((idx%6)*320+4,(idx//6)*260+3),f'Orbit transition t={f/30:.1f}s',fill='white')
sheet.save(p/'transition-sheet.jpg')
for f in range(0,360,2):
 im=Image.open(p/f'sequence-{f:03d}.png');im.thumbnail((640,480));frames.append(im.convert('P',palette=Image.Palette.ADAPTIVE))
frames[0].save(p/'native-motion-orbit.gif',save_all=True,append_images=frames[1:],duration=67,loop=0,optimize=True)
