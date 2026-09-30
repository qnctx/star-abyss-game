"""Offline editable R3 mesh source. No network, AI generation or primitive exports.
Run py -3 godot/assets/planet-ecology-r3/build_assets_r3.py from repository root.
"""
import math, random, json, pathlib, shutil, hashlib, itertools
P=pathlib.Path(__file__).parent
ROOT=P.parents[2]
baseline=P/'baseline'; baseline.mkdir(exist_ok=True)
old=ROOT/'godot/scripts/native_planet_ecology.gd'
if not (baseline/'native_planet_ecology.gd.txt').exists(): shutil.copyfile(old,baseline/'native_planet_ecology.gd.txt')
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def mul(a,s): return tuple(x*s for x in a)
def sub(a,b): return add(a,mul(b,-1))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm(a): return mul(a,1/max(1e-8,math.sqrt(sum(x*x for x in a))))
class Mesh:
 def __init__(self): self.p=[]; self.n=[]; self.c=[]
 def tri(self,a,b,c,col,ns=None):
  n=norm(cross(sub(b,a),sub(c,a)))
  for idx,v in enumerate((a,c,b)): self.p.extend(round(x,5) for x in v); self.n.extend(round(x,5) for x in (ns[idx] if ns else n)); self.c.extend(col)
 def tube(self,points,radii,sides,col):
  # Catmull-Rom centreline gives editable curved branches and continuous buttresses.
  original=points; rr=radii; points=[]; radii=[]; steps=5 if sides>=12 else (2 if sides>=8 else 1)
  for j in range(len(original)-1):
   a=original[max(0,j-1)]; b=original[j]; c=original[j+1]; d=original[min(j+2,len(original)-1)]
   for q in range(steps):
    t=q/steps
    points.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(3)))
    radii.append(rr[j]*(1-t)+rr[j+1]*t)
  points.append(original[-1]); radii.append(rr[-1])
  rings=[]
  for j,(p,r) in enumerate(zip(points,radii)):
   tangent=norm(sub(points[min(j+1,len(points)-1)],points[max(0,j-1)])); u=norm(cross(tangent,(0,0,1))); v=cross(tangent,u)
   rings.append([add(p,add(mul(u,math.cos(i*math.tau/sides)*r*(1+.045*math.sin(i*5+j*.4))),mul(v,math.sin(i*math.tau/sides)*r))) for i in range(sides)])
  for j in range(len(rings)-1):
   for i in range(sides):
    k=(i+1)%sides; shade=mul(col,.84+.16*math.sin(i*2+j)**2)
    ni=norm(sub(rings[j][i],points[j])); nk=norm(sub(rings[j][k],points[j])); nj=norm(sub(rings[j+1][i],points[j+1])); nl=norm(sub(rings[j+1][k],points[j+1]))
    self.tri(rings[j][i],rings[j+1][i],rings[j+1][k],shade,[ni,nl,nj]); self.tri(rings[j][i],rings[j+1][k],rings[j][k],shade,[ni,nk,nl])
 def leaf(self,p,angle,length,width,col,simple=False):
  incline=math.sin(angle*7.37+p[0]*1.7)*.75
  d=(math.cos(angle)*length,incline*length,math.sin(angle)*length); w=(-math.sin(angle)*width,math.cos(angle*4.1)*width*.5,math.cos(angle)*width)
  tip=add(p,d); mid=add(p,mul(d,.48)); ridge=add(mid,(0,.08*length,0))
  if simple:
   self.tri(p,add(mid,w),tip,col); self.tri(p,tip,sub(mid,w),mul(col,.85)); return
  self.tri(p,add(mid,w),ridge,col); self.tri(p,ridge,sub(mid,w),mul(col,.85)); self.tri(ridge,add(mid,w),tip,col); self.tri(ridge,tip,sub(mid,w),mul(col,.85))
 def save(self,name,ref,collision):
  data=dict(positions=self.p,normals=self.n,colors=self.c,triangles=len(self.p)//9,reference=ref,collision=collision)
  (P/(name+'.json')).write_text(json.dumps(data,separators=(',',':')))
  # OBJ is editable in Blender without a custom importer. Vertex RGB retained.
  with (P/(name+'.obj')).open('w') as f:
   f.write('# R3 authored topology; reference '+ref+'\n')
   for i in range(0,len(self.p),3): f.write('v '+' '.join(map(str,self.p[i:i+3]+self.c[i:i+3]))+'\n')
   for i in range(0,len(self.p)//3,3): f.write(f'f {i+1} {i+2} {i+3}\n')
  return dict(asset=name,triangles=data['triangles'],reference=ref,collision=collision)
def tree(lod):
 m=Mesh(); r=random.Random(730); bark=(.22,.205,.19); sides=[28,10,6][lod]
 m.tube([(0,-.55,0),(.13,1,0),(-.2,4,.12),(.4,8,.2),(.1,12,0),(.7,16,.1)],[1.5,1,.79,.64,.4,.08],sides,bark)
 for i in range(9):
  a=i*math.tau/9; d=(math.cos(a),0,math.sin(a)); m.tube([mul(d,.6),add(mul(d,1.5),(0,.6,0)),add(mul(d,3.5),(0,-.2,0)),add(mul(d,4.5),(0,-.65,0))],[.72,.52,.22,.025],sides,bark)
 for j in range(15):
  a=j*2.399; y=7+j*.49; reach=5.8-(y-8)*.31; d=(math.cos(a),0,math.sin(a)); end=add(mul(d,reach),(0,y+2,0))
  m.tube([(.2,y,0),add(mul(d,reach*.42),(0,y+.4,0)),end],[.35,.22,.045],max(4,sides-2),bark)
  for k in range([7,4,3][lod]):
   b=a+(k-3)*.48; branchend=add(end,(math.cos(b)*2,r.uniform(-.2,1),math.sin(b)*2))
   if lod<2: m.tube([end,branchend],[.065,.01],4,bark)
   # Component-local seeds keep twig centers stable between all three LODs.
   leaf_rng=random.Random(730+j*101+k*17)
   for q in range([140,18,7][lod]):
    p=add(branchend,(leaf_rng.uniform(-1.7,1.7),leaf_rng.uniform(-1.1,1.2),leaf_rng.uniform(-1.7,1.7)))
    m.leaf(p,leaf_rng.random()*math.tau,[.47,1.28,2.10][lod],[.17,.50,.85][lod],mul((.18,.25,.12),leaf_rng.uniform(.72,1.25)),lod==2)
 return m
def rock(lod,kind):
 m=Mesh(); r=random.Random(42); n=[19,12,8][lod]; rings=[]
 if kind=='floatrock': n=[52,24,12][lod]
 heights=[-.6,0,.6,1.05,1.15,1.7,2.1,2.2,2.75,3.1]
 if kind=='pebble': heights=[-.3,0,.25,.6,.83]
 if kind=='floatrock': heights=[-3.4,-2.8,-1.4,-.5,.4,1.3,2.1,2.5]
 for j,y in enumerate(heights):
  radius=(1.0 if kind=='pebble' else 3.8)*(math.sin((j+.7)/(len(heights)+.4)*math.pi)**.15)
  if kind in ['outcrop','crystal']: radius *= [1,.98,.95,1.03,.85,.85,.91,.78,.8,.7][j]
  if kind=='floatrock': radius *= [.22,.65,.87,1.1,1,.89,.7,.38][j]
  rings.append([(math.cos(i*math.tau/n)*radius*(.82+.2*math.sin(i*2.8)+.09*r.random())+(y*.22 if kind=='floatrock' else 0),y+(math.sin(i*2.1+j)*.24 if kind=='floatrock' else 0),math.sin(i*math.tau/n)*radius*(.72+.13*math.cos(i*2.1))) for i in range(n)])
 for j in range(len(rings)-1):
  for i in range(n):
   k=(i+1)%n; col=mul((.30,.28,.33),r.uniform(.92,1.04)*(0.76 if j in [3,6] else 1))
   m.tri(rings[j][i],rings[j+1][i],rings[j+1][k],col); m.tri(rings[j][i],rings[j+1][k],rings[j][k],col)
 for i in range(n): m.tri((0,heights[-1]+.12,0),rings[-1][i],rings[-1][(i+1)%n],(.32,.30,.35))
 for i in range(n): m.tri((0,heights[0]-.15,0),rings[0][(i+1)%n],rings[0][i],(.22,.20,.26))
 if kind=='crystal':
  r=random.Random(522)
  for k in range(7):
   a=k*2.4; p=(math.cos(a)*2,1.2,math.sin(a)*1.4); h=r.uniform(1.8,5); ring=[add(p,(math.cos(i*math.tau/6)*.45,0,math.sin(i*math.tau/6)*.45)) for i in range(6)]
   top=[add(v,(.25,h*.7,.12)) for v in ring]; tip=add(p,(.35,h,.17))
   for i in range(6):
    q=(i+1)%6; col=mul((.56,.64,.70),.6+i*.08); m.tri(ring[i],top[i],top[q],col); m.tri(ring[i],top[q],ring[q],col); m.tri(top[i],tip,top[q],mul(col,1.2))
 return m
def grass(lod):
 m=Mesh(); r=random.Random(192)
 for i in range([100,40,12][lod]):
  a=r.random()*math.tau; p=(r.uniform(-1.8,1.8),-.07,r.uniform(-1.8,1.8)); h=r.uniform(.25,.72); w=r.uniform(.017,.035)
  centers=[add(p,(math.cos(a)*h*t*t*.7,h*t,math.sin(a)*h*t*t*.7)) for t in [0,.35,.7,1]]
  widths=[w*.5,w,w*.65,0]
  for j in range(3):
   v=(-math.sin(a)*widths[j],0,math.cos(a)*widths[j]); vv=(-math.sin(a)*widths[j+1],0,math.cos(a)*widths[j+1]); col=mul((.28,.32,.18),r.uniform(.75,1.15))
   m.tri(sub(centers[j],v),add(centers[j],v),add(centers[j+1],vv),col)
   if j<2: m.tri(sub(centers[j],v),add(centers[j+1],vv),sub(centers[j+1],vv),col)
 return m
def floating_rock(lod):
 # Deterministic convex fracture planes, then shared-edge displaced refinement.
 # No latitude rings, sphere primitive, open bottom or square terrain tile.
 m=Mesh(); r=random.Random(8291); pts=[]
 for i in range(32):
  a=r.random()*math.tau; y=r.uniform(-1,1); q=math.sqrt(1-y*y); radius=r.uniform(.72,1.15)
  pts.append((math.cos(a)*q*radius*3.7+y*.8,y*radius*3.4,math.sin(a)*q*radius*2.9))
 def refine(a,b,c,depth):
  if depth:
   def mid(p,q):
    v=mul(add(p,q),.5); displacement=.10*math.sin(v[0]*9.7+v[1]*13.1+v[2]*7.3)
    return add(v,mul(norm(v),displacement))
   ab=mid(a,b); bc=mid(b,c); ca=mid(c,a)
   for t in [(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)]: refine(*t,depth-1)
  else:
   n=norm(cross(sub(b,a),sub(c,a))); shade=.9+.09*abs(n[0]);m.tri(a,b,c,mul((.235,.22,.26),shade))
 for ia,ib,ic in itertools.combinations(range(len(pts)),3):
  a,b,c=pts[ia],pts[ib],pts[ic]; n=cross(sub(b,a),sub(c,a)); dots=[sum(x*y for x,y in zip(n,sub(p,a))) for p in pts]
  if min(dots)<-1e-7 and max(dots)>1e-7: continue
  if sum(x*y for x,y in zip(n,a))<0: b,c=c,b
  refine(a,b,c,[2,1,0][lod])
 return m
def reed(lod):
 m=Mesh(); r=random.Random(64)
 for i in range([28,16,8][lod]):
  p=(r.uniform(-1,1),-.1,r.uniform(-1,1)); h=r.uniform(1.2,2.4); tip=add(p,(.18,h,.14))
  m.tube([p,add(p,(0,h*.6,0)),tip],[.025,.021,.008],4,(.32,.34,.16))
  m.tube([tip,add(tip,(0,.3,0))],[.065,.03],5,(.32,.25,.16))
  for k in range(3): m.leaf(add(p,(0,h*(.2+k*.17),0)),i*2.3+k,.8,.065,(.28,.35,.15))
 return m
def strata(lod,kind):
 """Three fractured stratigraphic pillars, with ledges, chipped joints and scree."""
 m=Mesh(); n=[64,32,16][lod]
 def slab(cx,cz,sx,sz,y,height,seed):
  rings=[]
  for j,(dy,bevel) in enumerate([(0,.93),(.06,1),(.74,1),(1,.93)]):
   ring=[]
   for i in range(n):
    a=i*math.tau/n; ca=math.cos(a); sa=math.sin(a)
    edge=1+.05*math.sin(a*7+seed)+.035*math.sin(a*19+seed*.7)
    x=math.copysign(abs(ca)**.45,ca)*sx*bevel*edge
    z=math.copysign(abs(sa)**.45,sa)*sz*bevel*edge
    yy=y+dy*height+.09*math.sin(x*1.1+z*.7+seed)+x*.035
    ring.append((cx+x,yy,cz+z))
   rings.append(ring)
  for j in range(3):
   for i in range(n):
    k=(i+1)%n; c=mul((.22,.215,.245),.84+.12*math.sin(i*.4+seed)**2+(0.09 if j==2 else 0))
    m.tri(rings[j][i],rings[j+1][i],rings[j+1][k],c);m.tri(rings[j][i],rings[j+1][k],rings[j][k],c)
  for i in range(n):
   m.tri((cx,y+height,cz),rings[-1][i],rings[-1][(i+1)%n],(.28,.27,.295))
   m.tri((cx,y,cz),rings[0][(i+1)%n],rings[0][i],(.16,.15,.18))
 for column,(cx,cz,sx,sz) in enumerate([(-3.05,0,2.5,2.6),(2.05,.9,2.4,2.0),(.1,-2.65,1.9,1.35)]):
  for layer in range(6-column):
   slab(cx+.09*layer,cz, sx*(1-layer*.035),sz*(1-layer*.045),-.35+layer*.48,.42,37+column*9+layer)
 # Fragmented talus, irregular flat fragments anchored below the ground datum.
 for i in range(10 if lod==0 else 5):
  a=i*2.399; slab(math.cos(a)*5.5,math.sin(a)*3.7,.3+(i%3)*.17,.3+(i%2)*.1,-.25,.4+(i%3)*.12,90+i)
 if kind=='crystal':
  r=random.Random(522)
  for k in range(5):
   p=(-1.1+k*.68,.75,-.8+(k%2)*1.8); h=[5.8,3.6,7.2,4.1,2.7][k]; ring=[add(p,(math.cos(i*math.tau/6)*.58,0,math.sin(i*math.tau/6)*.58)) for i in range(6)]
   top=[add(v,(.5,h*.76,.14)) for v in ring]; tip=add(p,(.8,h,.24))
   for i in range(6):
    q=(i+1)%6; col=mul((.61,.67,.72),.62+i*.07); m.tri(ring[i],top[i],top[q],col);m.tri(ring[i],top[q],ring[q],col);m.tri(top[i],tip,top[q],mul(col,1.18))
 return m
manifest=[]
for kind in ['tree','reed','pebble','outcrop','crystal','floatrock','grass']:
 for lod in range(3):
  mesh=tree(lod) if kind=='tree' else grass(lod) if kind=='grass' else reed(lod) if kind=='reed' else strata(lod,kind) if kind in ['outcrop','crystal'] else floating_rock(lod) if kind=='floatrock' else rock(lod,kind)
  ref={'tree':'05-forest.png;09-natural-ecotones.png','grass':'03-basin-to-plains.png;09-natural-ecotones.png','reed':'06-river-wetland.png','pebble':'05-forest.png;06-river-wetland.png','outcrop':'02-basalt-basin.png;04-mountains-canyon-cliffs.png;08-ocean-islands.png','crystal':'12-special-regions.png lower-left','floatrock':'12-special-regions.png lower-right'}[kind]
  collision={'type':'capsule','radius':1.15,'height':12} if kind=='tree' else {'type':'none'} if kind in ['reed','grass'] else {'type':'convex_mesh'}
  manifest.append(mesh.save(f'{kind}-{lod}',ref,collision))
(P/'manifest-r3.json').write_text(json.dumps(manifest,indent=2))
references={}
for asset in manifest:
 for ref in asset['reference'].split(';'):
  name=ref.split('.png')[0]+'.png'; image=ROOT/'docs/art/planet-review-r3'/name
  references[name]={'path':str(image.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
(P/'source-map-r3.json').write_text(json.dumps({'images':references,'baseline_sha256':hashlib.sha256((baseline/'native_planet_ecology.gd.txt').read_bytes()).hexdigest(),'mesh_source':'build_assets_r3.py','godot_exporter':'godot/tests/native_ecology_r3_preview.gd'},indent=2))
print(json.dumps([{k:v for k,v in x.items() if k in ['asset','triangles']} for x in manifest]))
