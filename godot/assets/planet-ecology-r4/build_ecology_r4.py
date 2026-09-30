"""Image-derived ecology R4. Run with Blender --background --python this_file.

All geometry is authored from swept tapered branch paths, leaf blades and
interlocking fracture wedges. No primitive tree crowns or placeholder rocks.
Game coordinates are Y-up; the Blender source uses Z-up. Deterministic seed.
"""
import bpy, bmesh, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
REF = ROOT / 'docs/art/ecology-damage-r4'
TAU = math.tau
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
LIB = []
TREE_BOUNDS = {}

def V(x): return Vector(x)
def xyz(v): return [round(float(x), 5) for x in v]

class Mesh:
    def __init__(self): self.v=[]; self.f=[]; self.c=[]
    def tri(self,a,b,c,color):
        i=len(self.v); self.v.extend([xyz(a),xyz(b),xyz(c)])
        self.f.append((i,i+1,i+2)); self.c.extend([color]*3)
    def quad(self,a,b,c,d,col): self.tri(a,b,c,col); self.tri(a,c,d,col)
    def tube(self,points,radii,sides,color,seed=0,cap=True,smooth=False,fracture=False):
        if smooth and len(points)>2:
            original=[V(p) for p in points]; old_radii=radii[:]; points=[]; radii=[]
            for i in range(len(original)-1):
                p0=original[max(0,i-1)]; p1=original[i]; p2=original[i+1]; p3=original[min(len(original)-1,i+2)]
                for j in range(3):
                    t=j/3
                    points.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
                    radii.append(old_radii[i]*(1-t)+old_radii[i+1]*t)
            points.append(original[-1]);radii.append(old_radii[-1])
        rng=random.Random(seed); rings=[]
        for i,p in enumerate(points):
            axis=(V(points[min(i+1,len(points)-1)])-V(points[max(0,i-1)])).normalized()
            tangent=axis.cross(V((0,0,1)))
            if tangent.length<.1: tangent=axis.cross(V((1,0,0)))
            tangent.normalize(); bit=axis.cross(tangent).normalized()
            ring=[V(p)+(tangent*math.cos(j*TAU/sides)+bit*math.sin(j*TAU/sides))*radii[i]*(1+.095*math.sin(j*3.7+seed)) for j in range(sides)]
            if fracture and abs(p[1]-.96)<.001:
                for q in ring: q.y+=.085*math.sin(math.atan2(q.z,q.x)*5)+.035*math.sin(math.atan2(q.z,q.x)*11)
            rings.append(ring)
        for i in range(len(rings)-1):
            for j in range(sides):
                col=[max(0,min(1,c*(.87+.20*rng.random()))) for c in color]
                self.quad(rings[i][j],rings[i][(j+1)%sides],rings[i+1][(j+1)%sides],rings[i+1][j],col)
        if cap:
            for j in range(sides):
                self.tri(points[0],rings[0][(j+1)%sides],rings[0][j],[.46,.31,.15])
                self.tri(points[-1],rings[-1][j],rings[-1][(j+1)%sides],[.52,.36,.18])
    def leaf(self,p,d,length,width,col,fold=True):
        d=V(d).normalized(); side=d.cross(V((.1,1,.13))).normalized()*width
        a=V(p); tip=a+d*length; mid=a+d*length*.46; ridge=mid+V((0,length*.11,0))
        if fold:
            self.tri(a,mid+side,ridge,col); self.tri(mid+side,tip,ridge,col)
            self.tri(tip,mid-side,ridge,col); self.tri(mid-side,a,ridge,col)
        else:
            self.tri(a,mid+side,tip,col); self.tri(a,tip,mid-side,col)
    def rock_face(self,a,b,c,d,col,steps=3):
        normal=(V(b)-V(a)).cross(V(d)-V(a)).normalized()
        def point(u,v):
            p=V(a).lerp(V(b),u).lerp(V(d).lerp(V(c),u),v)
            relief=math.sin(math.pi*u)*math.sin(math.pi*v)*(.08*math.sin(p.x*8+p.y*4+p.z*7))
            return p+normal*relief
        for y in range(steps):
            for x in range(steps):
                u=x/steps;v=y/steps;delta=1/steps
                self.quad(point(u,v),point(u+delta,v),point(u+delta,v+delta),point(u,v+delta),col)
                # Continuous spatial mineral tint, never a square patch checker.
                for k in range(len(self.v)-6,len(self.v)):
                    q=self.v[k]; tint=.97+.045*math.sin(q[0]*2.7+q[1]*1.8+q[2]*3.1)
                    self.c[k]=[c*tint for c in col]
    def export(self,name,lod):
        path=OUT/(name+'.json')
        path.write_text(json.dumps({'vertices':self.v,'colors':self.c},separators=(',',':')))
        if lod!=0: return
        data=bpy.data.meshes.new(name)
        data.from_pydata([(x,-z,y) for x,y,z in self.v],[],self.f)
        data.update(); attr=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly in data.polygons:
            for li in poly.loop_indices:
                attr.data[li].color=(*self.c[data.loops[li].vertex_index],1)
        obj=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(obj)
        mat=bpy.data.materials.get('R4 Vertex Surface')
        if not mat:
            mat=bpy.data.materials.new('R4 Vertex Surface'); mat.use_nodes=True
            node=mat.node_tree.nodes.new('ShaderNodeVertexColor'); node.layer_name='Color'
            bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value=.91
            mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
        data.materials.append(mat); LIB.append(obj)

def tree(species,age,lod):
    seed=100+['pine','oak','alder'].index(species)*101+age*37
    rng=random.Random(seed); segments=[]; parts={}; parents={'trunk':'stump'}; sides=[9,5,3][lod]
    height={'pine':[7.2,15.0,18.0],'oak':[5.7,12.0,14.0],'alder':[5.4,11.0,13.0]}[species][age]
    radius={'pine':[.19,.43,.65],'oak':[.22,.58,.88],'alder':[.13,.26,.34]}[species][age]
    bark={'pine':[.23,.17,.12],'oak':[.23,.205,.16],'alder':[.26,.27,.22]}[species]
    leaf={'pine':[.08,.16,.045],'oak':[.12,.21,.055],'alder':[.105,.22,.075]}[species]
    def part(key):
        if key not in parts: parts[key]=Mesh()
        return parts[key]
    def path(key,pts,rs,collide=True):
        if (collide or lod==0) and not(lod==2 and key.startswith('branch_')):
            part(key).tube(pts,rs,sides,bark,seed+len(segments),smooth=lod==0,fracture=key in ('stump','trunk'))
        else: part(key) # Keep stable fracture part identities at every LOD.
        if collide:
            for i in range(len(pts)-1):
                # Queries retain every authored main branch, including saplings.
                # Only very thin branches omit hard blocking, never the trunk.
                segments.append({'part':key,'a':xyz(pts[i]),'b':xyz(pts[i+1]),'radius':round((rs[i]+rs[i+1])*.5,4),'physical':key in ('trunk','stump') or key.startswith('stem_') or rs[i]>=.045})
    def foliage(key,p,d,scale=1):
        # Terminal sprays consist of individual folded blades, never crown blobs.
        count=([72,10,1] if species=='oak' else [48,7,1])[lod] if species!='pine' else [44,8,1][lod]
        local=random.Random(seed+int(sum(p)*700))
        for k in range(count):
            angle=k*2.399+local.random()*.6
            spread=([1.0,1.10,1.25][lod])*scale
            t=(k/count)**.5
            offset=V((math.cos(angle)*spread*t,local.uniform(-.50,.65)*spread,math.sin(angle)*spread*t))
            length=([.48,1.15,2.1][lod] if species!='pine' else [.65,1.15,2.1][lod])*scale
            width=length*((.45 if lod==2 else .36) if species=='oak' else ((.40 if lod==2 else .30) if species=='alder' else (.40 if lod==2 else .16)))
            lightness=local.uniform(.82,1.20)
            color=[min(.7,c*lightness) for c in leaf]
            part(key).leaf(V(p)+offset,V(d)*.24+V((math.cos(angle),local.uniform(-.3,.8),math.sin(angle))),length,width,color,fold=lod==0)
    # Visible roots share the stump and stop below soil surface.
    for r in range(3 if lod==2 else (7 if species!='alder' else 11)):
        a=r*TAU/(7 if species!='alder' else 11)+rng.uniform(-.18,.18)
        length=radius*rng.uniform(3.2,5.6)
        p=[V((math.cos(a)*radius*.5,.6,math.sin(a)*radius*.5)),V((math.cos(a)*length*.48,.11,math.sin(a)*length*.48)),V((math.cos(a)*length,-.14,math.sin(a)*length))]
        part('stump').tube(p,[radius*.37,radius*.21,.016],sides,bark,r)
        if species=='alder' and lod<2:
            for side in [-1,1]:
                turn=a+side*.35
                tip=V((math.cos(turn)*length*1.28,-.07,math.sin(turn)*length*1.28))
                part('stump').tube([p[1],p[1].lerp(tip,.55)+V((0,.035,0)),tip],[radius*.12,radius*.065,.008],max(3,sides-2),bark,r+side)
    path('stump',[V((0,0,0)),V((0,.48,0)),V((0,.96,0))],[radius*1.3,radius,radius*.95])
    stems=([1,2,3][age] if species=='oak' else [2,3,4][age] if species=='alder' else 1)
    fork_height=[1.22,1.5,1.8][age] if stems>1 else .96
    if stems>1: path('trunk',[V((0,.96,0)),V((0,fork_height,0))],[radius*.95,radius*.91])
    for stem in range(stems):
        stem_key='stem_%02d'%stem if stems>1 else 'trunk'
        if stems>1: parents[stem_key]='trunk'
        angle=stem*2.4+.4
        spread=(.06 if species=='pine' else (.22 if species=='oak' else .20))
        lean=V((math.cos(angle)*height*spread,0,math.sin(angle)*height*spread))
        if age==2: lean*=1.35
        stem_height=height*(.70 if species=='oak' else 1.0)
        pts=[V((0,fork_height,0))]+[V((lean.x*t+math.sin(t*8+stem)*radius,fork_height+(stem_height-fork_height)*t,lean.z*t+math.cos(t*7)*radius*.6)) for t in [.20,.42,.66,.84,1.0]]
        rs=[radius*.95,radius*.82,radius*.68,radius*.48,radius*.25,.015]
        if species=='oak': rs=[r*(.86 if age else 1) for r in rs]
        if species=='alder': rs=[r*.72 for r in rs]
        if species=='pine' and age==2: rs[-1]=radius*.13
        path(stem_key,pts,rs)
        branch_count=([8,17,16][age] if species=='pine' else ([5,5,4][age] if species=='oak' else [5,6,7][age]))
        for j in range(branch_count):
            t=.23+(.65 if species=='pine' and age==2 else .71)*(j/(branch_count-1))
            # Branch attachment lies on interpolated actual trunk centreline.
            branch_y=fork_height+(stem_height-fork_height)*t
            at=next(i for i in range(len(pts)-1) if pts[i+1].y>=branch_y)
            start=pts[at].lerp(pts[at+1],(branch_y-pts[at].y)/(pts[at+1].y-pts[at].y))
            a=j*2.399+stem*1.9+rng.uniform(-.3,.3)
            reach=height*((.29*(1-t)+.055) if species=='pine' else (.23+.18*math.sin(t*2.5)) if species=='oak' else .17)*(rng.uniform(.75,1.15))
            if age==2 and j%5==0: reach*=.57
            horiz=V((math.cos(a),0,math.sin(a)))
            rise=reach*(.12 if species=='pine' else (.48 if species=='oak' else 1.0))
            end=start+horiz*reach+V((0,rise,0)); mid=start+horiz*reach*.47+V((0,rise*.24,0))
            key='branch_%02d'%(stem*branch_count+j)
            parents[key]=stem_key
            br=radius*(.28 if species=='pine' else .43)*(1-t*.6)
            path(key,[start,mid,end],[br,br*.61,.025])
            forks=4 if species=='pine' else 5
            for k in range(forks):
                f=.38+k*.13; attach=mid.lerp(end,max(0,(f-.47)/.53)) if f>=.47 else start.lerp(mid,f/.47)
                side=V((math.cos(a+(-1 if k%2 else 1)*.85),.3,math.sin(a+(-1 if k%2 else 1)*.85)))
                tip=attach+side*reach*rng.uniform(.27,.47)
                path(key,[attach,attach.lerp(tip,.54)+V((0,.1,0)),tip],[br*.43,.035,.009],False)
                foliage(key,tip,side,.72 if species=='pine' else 1.0)
                foliage(key,attach.lerp(tip,.63),side,.65)
            if not(age==2 and j%5==0): foliage(key,end,horiz,.9)
        if species=='pine' and age==2:
            for side in [-1,1]:
                start=pts[-2]
                tip=start+V((side*1.25,height*.14,side*.8))
                path(stem_key,[start,start.lerp(tip,.5)+V((.2,0,0)),tip],[radius*.20,radius*.11,.04],False)
        else: foliage(stem_key,pts[-1],V((0,1,0)),.7)
    name=f'{species}-{age}-{lod}'
    for key,m in parts.items(): m.export(name+'_'+key,lod)
    combined=Mesh()
    for m in parts.values():
        for i in range(0,len(m.v),3): combined.tri(*m.v[i:i+3],m.c[i])
    combined.export(name,lod if lod else 1) # Source keeps editable fracture parts only.
    if lod==0:
        TREE_BOUNDS[(species,age)]={'footprint':max(1.15,max(math.hypot(p[0],p[2]) for p in parts['stump'].v)),'crown_radius':max(math.hypot(p[0],p[2]) for p in combined.v)}
    return {'id':name,'species':species,'age':age,'lod':lod,'height':height,'radius':radius,**TREE_BOUNDS[(species,age)],'parts':list(parts),'parents':parents,'segments':segments,'triangles':len(combined.f),'hp':[100,220,300][age]}

def rock_hull():
    # One asymmetric weathered mass, cut by oblique Voronoi planes below.
    # All fragments originate from this same hull; none is an extruded column.
    bm=bmesh.new()
    for level,(y,r) in enumerate([(-.12,2.65),(.62,3.08),(2.15,2.72),(3.50,1.86),(4.45,.76)]):
        for j in range(11):
            a=j*TAU/11+.11*level
            radius=r*(1+.12*math.sin(j*2.7+level*.61))
            bm.verts.new((math.cos(a)*radius+.24*level,y+.20*math.sin(j*3.1+level),math.sin(a)*radius-.10*level))
    bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False)
    faces=[([v.co.copy() for v in f.verts],False) for f in bm.faces]
    bm.free()
    return faces

def clip_rock(faces,normal,offset):
    result=[];cut=[]
    for polygon,fresh in faces:
        clipped=[]
        for i,a in enumerate(polygon):
            b=polygon[(i+1)%len(polygon)]
            da=a.dot(normal)-offset;db=b.dot(normal)-offset
            if da<=.00001: clipped.append(a)
            if (da<0)!=(db<0):
                p=a.lerp(b,da/(da-db));clipped.append(p);cut.append(p)
        if len(clipped)>=3:result.append((clipped,fresh))
    unique=[]
    for p in cut:
        if all((p-q).length>.0001 for q in unique):unique.append(p)
    if len(unique)>=3:
        center=sum(unique,V((0,0,0)))/len(unique)
        u=normal.cross(V((0,1,0)))
        if u.length<.01:u=normal.cross(V((1,0,0)))
        u.normalize();v=normal.cross(u).normalized()
        unique.sort(key=lambda p:math.atan2((p-center).dot(v),(p-center).dot(u)))
        result.append((unique,True))
    return result

def rock(lod):
    parts={};segments=[]
    hull=rock_hull()
    # Offset seeds produce a low slab, two large oblique blocks and smaller cap
    # pieces, matching the reference's size hierarchy and fracture directions.
    seeds=[V(x) for x in [(-1.7,.72,-.85),(1.5,.70,-.5),(-1.1,2.65,.65),(1.30,2.45,1.15),(.45,3.90,-.10),(.10,1.60,-1.75)]]
    base=Mesh()
    base_faces=clip_rock(hull,V((0,1,0)),.24)
    for poly,fresh in base_faces:
        for i in range(1,len(poly)-1):base.tri(poly[0],poly[i],poly[i+1],[.20,.215,.205])
    parts['stump']=base
    for j,seed in enumerate(seeds):
        faces=clip_rock(hull,V((0,-1,0)),-.255)
        for k,other in enumerate(seeds):
            if k==j:continue
            normal=(other-seed).normalized()
            offset=(other.length_squared-seed.length_squared)/(2*(other-seed).length)
            faces=clip_rock(faces,normal,offset-.012)
        m=Mesh();all_points=[]
        for poly,fresh in faces:
            all_points.extend(poly)
            center=sum(poly,V((0,0,0)))/len(poly)
            normal=(poly[1]-poly[0]).cross(poly[2]-poly[0]).normalized()
            tint=.90+.08*math.sin(center.x*1.3+center.y*2.1+center.z*.7)
            col=[c*tint for c in ([.16,.18,.185] if fresh else [.26,.275,.25])]
            # Irregular inset facets make chipped rims at a geological scale,
            # with fewer divisions at distance. Preserve the shared cut outline.
            if lod<2 and fresh:
                inner=[center.lerp(p,.80 if fresh else .85)+normal*(.035*math.sin(i*4.1+j)) for i,p in enumerate(poly)]
                for i,p in enumerate(poly):
                    n=(i+1)%len(poly)
                    m.quad(p,poly[n],inner[n],inner[i],col)
                    m.tri(center+normal*.025,inner[i],inner[n],[c*.94 for c in col])
            else:
                for i in range(1,len(poly)-1):m.tri(poly[0],poly[i],poly[i+1],col)
        parts['chunk_%d'%j]=m
        miny=min(p.y for p in all_points);maxy=max(p.y for p in all_points)
        center=sum(all_points,V((0,0,0)))/len(all_points)
        radius=max(math.hypot(p.x-center.x,p.z-center.z) for p in all_points)*.72
        segments.append({'part':'chunk_%d'%j,'a':xyz(V((center.x,miny+.24,center.z))),'b':xyz(V((center.x,maxy-.24,center.z))),'radius':round(radius,4)})
    combined=Mesh()
    for key,m in parts.items():
        m.export(f'outcrop-0-{lod}_{key}',lod)
        for i in range(0,len(m.v),3):combined.tri(*m.v[i:i+3],m.c[i])
    combined.export(f'outcrop-0-{lod}',1)
    return {'id':f'outcrop-0-{lod}','species':'outcrop','age':0,'lod':lod,'height':4.8,'radius':3.3,'footprint':3.4,'crown_radius':3.4,'parts':list(parts),'segments':segments,'triangles':len(combined.f),'hp':550}

manifest={'revision':'r4.2','assets':[],'references':{},'notes':'Image-derived species/age topology; shared base, main stems and branch parent graph; fracture parts and collider paths in identical Y-up local coordinates.'}
for name in ['01-species-age.png','02-branch-root.png','03-tree-fracture.png','04-rock-fracture.png']:
    manifest['references'][name]=hashlib.sha256((REF/name).read_bytes()).hexdigest()
for species in ['pine','oak','alder']:
    for age in range(3):
        for lod in range(3):manifest['assets'].append(tree(species,age,lod))
for lod in range(3):manifest['assets'].append(rock(lod))
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
# Arrange editable source models in a library grid, preserving shared pivots.
for obj in LIB:
    bits=obj.name.split('-'); species=bits[0]; age=int(bits[1]);
    col=['pine','oak','alder','outcrop'].index(species)
    obj.location=(col*22,-age*24,0)
(OUT/'source').mkdir(exist_ok=True)
(OUT/'source/.gdignore').write_text('')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/ecology-r4.blend'))
print('ECOLOGY_R4_BUILT',len(manifest['assets']),'assets',sum(x['triangles'] for x in manifest['assets']),'triangles across all variants/LODs')
