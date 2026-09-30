from pathlib import Path
from PIL import Image,ImageDraw
p=Path('godot/assets/motion-r2/evidence/directional')
names=['jog-W','sprint-W','jog-S','jog-A','jog-D','moving-jab','strafe-guard','boost-jab']
for name in names:
 sheet=Image.new('RGB',(6*320,3*260),(18,22,29));d=ImageDraw.Draw(sheet)
 for idx,f in enumerate(range(0,90,5)):
  im=Image.open(p/f'{name}-{f:03d}.png');im.thumbnail((320,240));sheet.paste(im,((idx%6)*320,(idx//6)*260+20));d.text(((idx%6)*320+4,(idx//6)*260+3),f'{name} t={f/30:.2f}s',fill='white')
 sheet.save(p/f'{name}-sheet.jpg')
frames=[]
for name in names:
 for f in range(0,90,2):
  im=Image.open(p/f'{name}-{f:03d}.png');im.thumbnail((640,480));frames.append(im.convert('P',palette=Image.Palette.ADAPTIVE))
frames[0].save(p/'directional-motion.gif',save_all=True,append_images=frames[1:],duration=67,loop=0,optimize=True)
p=Path('godot/assets/vfx-r2/evidence/high')
for tier in [6,8,9]:
 sheet=Image.new('RGB',(8*240,3*200),(18,22,29));d=ImageDraw.Draw(sheet)
 for v in range(3):
  for f in range(8):
   im=Image.open(p/f'r{tier}-v{v}-f{f}.png');im.thumbnail((240,180));sheet.paste(im,(f*240,v*200+20));d.text((f*240+4,v*200+3),f'R{tier} v{v} {f/10:.1f}s',fill='white')
 sheet.save(p/f'r{tier}-sheet.jpg')
