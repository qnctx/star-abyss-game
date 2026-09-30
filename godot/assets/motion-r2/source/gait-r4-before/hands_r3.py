"""C2 glove reconstruction from the existing generated reference.png.
Only vertices below the cuffs are replaced; the original 19 body rests survive.
Gloves use tailored ring topology and 30 phalanges plus 2 palm bones, not rigid props.
"""
import bpy,bmesh,math,json
from mathutils import Vector,Matrix,Quaternion

class Hands:
    def __init__(self,arm,meshes,C,out):
        self.arm=arm;self.C=C;self.out=out;self.defs={};self.meshes=[]
        original={b.name:[list(row) for row in b.matrix_local] for b in arm.data.bones}
        removed={}
        for obj in meshes:
            ids={obj.vertex_groups.get('wrist'+s).index for s in 'LR' if obj.vertex_groups.get('wrist'+s)}
            cut={v.index for v in obj.data.vertices if v.co.z<.976 and abs(v.co.x)>.27 and any(g.group in ids and g.weight>.2 for g in v.groups)}
            if cut:
                bm=bmesh.new();bm.from_mesh(obj.data);bm.verts.ensure_lookup_table()
                bmesh.ops.delete(bm,geom=[bm.verts[i] for i in cut],context='VERTS')
                bm.to_mesh(obj.data);bm.free();removed[obj.name]=len(cut)
        bpy.context.view_layer.objects.active=arm;arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for side,sign in [('L',-1),('R',1)]:
            x=sign*.365
            self.add_bone('palm'+side,(x,.957,0),(x,.895,0),'wrist'+side)
            for digit,z,lens,radius in [('index',-.036,(.034,.025,.021),.012),('middle',-.010,(.037,.026,.022),.0125),('ring',.016,(.034,.025,.021),.0115),('little',.040,(.028,.021,.018),.010)]:
                h=Vector((x,.893,z));chain=[]
                for j,length in enumerate(lens):
                    name=f'{digit}{j+1}{side}';end=h+Vector((0,-length,0))
                    self.add_bone(name,h,end,'palm'+side if j==0 else chain[-1]);chain.append(name);h=end
                self.defs[chain[0]]['digit']=(chain,radius)
            # Thumb runs forward and down along a separate articulated opposition chain.
            h=Vector((x-sign*.011,.946,-.039));chain=[]
            for j,d in enumerate([(sign*-.014,-.022,-.020),(sign*-.006,-.021,-.010),(0,-.019,-.003)]):
                name=f'thumb{j+1}{side}';end=h+Vector(d)
                self.add_bone(name,h,end,'palm'+side if j==0 else chain[-1]);chain.append(name);h=end
            self.defs[chain[0]]['digit']=(chain,.014)
        bpy.ops.object.mode_set(mode='OBJECT')
        self.rest={n:arm.data.bones[n].matrix_local.to_quaternion() for n in self.defs}
        self.materials=self.make_materials()
        for side,sign in [('L',-1),('R',1)]:self.make_hand(side,sign)
        for n,m in original.items():
            assert all(abs(arm.data.bones[n].matrix_local[i][j]-m[i][j])<1e-6 for i in range(4) for j in range(4)),n
        (out/'hand-r3-build.json').write_text(json.dumps({'reference':'reference.png: existing fist/guard panels','source_body_bones_preserved':len(original),'added_bones':list(self.defs),'removed_old_glove_vertices':removed,'glove_meshes':[{ 'name':o.name,'vertices':len(o.data.vertices),'faces':len(o.data.polygons)} for o in self.meshes]},indent=2))
    def add_bone(self,name,h,t,parent):
        h=Vector(h);t=Vector(t);b=self.arm.data.edit_bones.new(name)
        b.head=self.C@h;b.tail=self.C@t;b.parent=self.arm.data.edit_bones[parent]
        self.defs[name]={'head':h,'tail':t,'parent':parent}
    def make_materials(self):
        import numpy as np
        rng=np.random.default_rng(3202)
        size=256
        grain=rng.random((size,size))
        # A small authored leather grain, embedded by glTF; not a generated image
        # or a replacement identity texture. UVs remain available in the .blend.
        field=.85+.18*grain
        yy,xx=np.indices((size,size))
        field*=1-.045*(np.sin(xx*.38+np.sin(yy*.12))**8)
        pixels=np.ones((size,size,4),dtype=np.float32)
        pixels[:,:,:3]=field[:,:,None]*np.array([.105,.086,.067])
        texture=bpy.data.images.new('C2_GloveLeather_R3',size,size)
        texture.pixels.foreach_set(pixels.ravel())
        texture.filepath_raw=str(self.out/'source/glove-leather-r3.png');texture.file_format='PNG';texture.save();texture.pack()
        result=[]
        for name,color,rough in [('C2_Glove_Taupe',(.105,.086,.067,1),.8),('C2_Glove_Seam',(.072,.058,.046,1),.9),('C2_Glove_Knuckle',(.14,.113,.084,1),.7)]:
            m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
            p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=rough
            if name=='C2_Glove_Taupe':
                tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=texture
                m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
            result.append(m)
        return result
    def make_hand(self,side,sign):
        verts=[];faces=[];weights=[];mats=[];x=sign*.365
        def rings(samples,sides=12):
            start=len(verts)
            for center,a,b,w in samples:
                for k in range(sides):
                    angle=2*math.pi*k/sides
                    verts.append(self.C@(Vector(center)+Vector(a)*math.cos(angle)+Vector(b)*math.sin(angle)));weights.append(w)
            for j in range(len(samples)-1):
                for k in range(sides):
                    faces.append((start+j*sides+k,start+j*sides+(k+1)%sides,start+(j+1)*sides+(k+1)%sides,start+(j+1)*sides+k))
                    mats.append(1 if j%7==3 else 0)
            faces.append(tuple(start+k for k in reversed(range(sides))));mats.append(0)
            faces.append(tuple(start+(len(samples)-1)*sides+k for k in range(sides)));mats.append(0)
        # Elliptical palm with flattened palmar side, wrist cuff and softly shaped knuckle bed.
        samples=[]
        for y,rx,rz in [(1.003,.030,.037),(.993,.031,.039),(.982,.028,.038),(.963,.025,.042),(.945,.028,.049),(.919,.029,.052),(.900,.027,.053),(.887,.023,.050)]:
            w={'wrist'+side:1.0} if y>.98 else {'palm'+side:1.0}
            samples.append(((x,y,0),(rx,0,0),(0,0,rz),w))
        rings(samples,16)
        for first,d in self.defs.items():
            if not first.endswith(side) or 'digit' not in d:continue
            chain,r=d['digit'];samples=[]
            for j,bone in enumerate(chain):
                info=self.defs[bone];h=info['head'];t=info['tail'];axis=(t-h).normalized()
                a=Vector((1,0,0));a=(a-axis*axis.dot(a)).normalized();b=axis.cross(a).normalized()
                for u,taper in [(0,1),(.13,.94),(.38,.99),(.73,.91),(.94,.82)]:
                    radius=r*(1-.13*j)*taper
                    weight={bone:1.0}
                    if u<.2:
                        parent=info['parent'];ratio=.65+u*1.5;weight={bone:ratio,parent:1-ratio}
                    samples.append((h.lerp(t,u),a*radius,b*radius*.91,weight))
            info=self.defs[chain[-1]]
            samples.append((info['tail'],a*r*.32,b*r*.30,{chain[-1]:1.0}))
            samples.append((info['tail']+(info['tail']-info['head']).normalized()*.003,a*r*.10,b*r*.10,{chain[-1]:1.0}))
            rings(samples)
        # Curved dorsal knuckle panels follow the articulated proximal finger.
        for digit in ['index','middle','ring','little']:
            bone=digit+'1'+side;h=self.defs[bone]['head'];r=self.defs[bone]['digit'][1]
            start=len(verts)
            for row in range(4):
                for col in range(5):
                    u=(col-2)/2;v=row/3
                    p=h+Vector((sign*(r*.93+.002-.002*u*u),.005-v*.025,u*r*.76))
                    verts.append(self.C@p);weights.append({bone:.85,'palm'+side:.15})
            for row in range(3):
                for col in range(4):
                    faces.append(tuple(start+i for i in [row*5+col,row*5+col+1,(row+1)*5+col+1,(row+1)*5+col]));mats.append(2)
        me=bpy.data.meshes.new('C2_ArticulatedGlove'+side);me.from_pydata(verts,[],faces);me.update()
        obj=bpy.data.objects.new(me.name,me);bpy.context.collection.objects.link(obj);obj.parent=self.arm
        for material in self.materials:me.materials.append(material)
        for p,mat in zip(me.polygons,mats):p.material_index=mat;p.use_smooth=True
        groups={n:obj.vertex_groups.new(name=n) for n in set(k for w in weights for k in w)}
        for i,w in enumerate(weights):
            for name,value in w.items():groups[name].add([i],value,'REPLACE')
        mod=obj.modifiers.new('C2 glove skin','ARMATURE');mod.object=self.arm
        # Recalculate authored ring normals before export; no changes to body meshes.
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
        uv=me.uv_layers.new(name='GloveLeatherUV')
        for poly in me.polygons:
            for loop in poly.loop_indices:
                co=me.vertices[me.loops[loop].vertex_index].co
                uv.data[loop].uv=((co.x+co.y)*18,co.z*18)
        self.meshes.append(obj)
    def pose(self,name,t,positions,rotations):
        from combat import curve
        base=name.removeprefix('air_')
        for side,sign in [('L',-1),('R',1)]:
            curl=.20 if base in ['idle','walk','cruise'] else .50 if base in ['jog','sprint','boost'] else .96
            if base in ['cast_palm','cast_sweep','cast_cleave','cast_skyfall']:
                active=side=='L' if base=='cast_palm' else side=='R'
                if active or base=='cast_skyfall':curl=curve(t,[(0,.7),(.20,.13),(.38,.03),(.62,.03),(.90,.65),(1,.85)])
            if base=='hit':curl=.28
            for n,d in self.defs.items():
                if not n.endswith(side):continue
                parent=d['parent'];parent_head=positions[parent]
                parent_rest=self.defs[parent]['head'] if parent in self.defs else Vector((sign*.365,.98,0))
                positions[n]=parent_head+rotations[parent]@(d['head']-parent_rest)
                if n.startswith('palm'):local=Quaternion()
                elif n.startswith('thumb'):
                    j=int(n[-2]);local=Quaternion((0,1,0),sign*math.radians((36 if j==1 else 24)*curl))@Quaternion((0,0,1),-sign*math.radians((18 if j==1 else 30)*curl))
                else:
                    j=int(n[-2]);local=Quaternion((0,0,1),-sign*math.radians([76,92,68][j-1]*curl))
                rotations[n]=rotations[parent]@local
