from pathlib import Path
from PIL import Image,ImageDraw
root=Path('godot/assets/motion-r2/evidence')
def durations(n):
    # GIF timing uses whole centiseconds. Uniform 33ms is truncated to 30ms
    # by Pillow, which would incorrectly play 11% fast. Distribute 30/40ms.
    return [(round((i+1)*100/30)-round(i*100/30))*10 for i in range(n)]
for view,label in enumerate(['front','side','three-quarter']):
    files=sorted((root/'combat-sequence').glob(f'v{view}-*.png'))
    frames=[]
    for f in files:
        im=Image.open(f).convert('RGB');im.thumbnail((640,360));frames.append(im)
    frames[0].save(root/'combat-sequence'/f'{label}-normal-speed.gif',save_all=True,append_images=frames[1:],duration=durations(len(frames)),loop=0)
    selected=list(range(0,len(files),5));sheet=Image.new('RGB',(1280,200*((len(selected)+3)//4)),(20,25,30));draw=ImageDraw.Draw(sheet)
    for i,index in enumerate(selected):
        im=Image.open(files[index]);im.thumbnail((320,180));x=(i%4)*320;y=(i//4)*200;sheet.paste(im,(x,y));draw.text((x+8,y+181),f'{label} {index/30:.2f}s',fill='white')
    sheet.save(root/'combat-sequence'/f'{label}-sheet.jpg')
for clip in ['jab','cross','kick','guard','hit','air_jab','air_kick']:
    sheet=Image.new('RGB',(1280,600),(20,25,30))
    for v in range(3):
        for f in range(0,8,2):
            im=Image.open(root/'combat'/f'{clip}-v{v}-f{f}.png');im.thumbnail((320,180));sheet.paste(im,((f//2)*320,v*200))
    sheet.save(root/'combat'/f'{clip}-sheet.jpg')
print('Combat GIFs preserve 30fps normal-speed timing; sheets sample every 5 frames.')
for view,label in enumerate(['main-side','main-three-quarter','main-contact-2p3m','main-contact-2p0m']):
    files=sorted((root/'main-combat').glob(f'v{view}-*.png'))
    if not files:continue
    frames=[Image.open(f).convert('RGB') for f in files]
    frames[0].save(root/'main-combat'/f'{label}-normal-speed.gif',save_all=True,append_images=frames[1:],duration=durations(len(frames)),loop=0)
    selected=list(range(0,len(files),5));sheet=Image.new('RGB',(1280,200*((len(selected)+3)//4)),(20,25,30));draw=ImageDraw.Draw(sheet)
    for i,index in enumerate(selected):
        im=Image.open(files[index]);im.thumbnail((320,180));x=(i%4)*320;y=(i//4)*200;sheet.paste(im,(x,y));draw.text((x+8,y+181),f'{label} {index/30:.2f}s',fill='white')
    sheet.save(root/'main-combat'/f'{label}-sheet.jpg')
