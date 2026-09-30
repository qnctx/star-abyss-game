"""Reconstruct the asymmetric back plate and project the supplied rear reference."""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

def add_back_detail(body,out):
    image=bpy.data.images.load(str((out/'references/back.png').resolve()),check_existing=True);image.pack()
    material=bpy.data.materials.new('C2_OriginalRearReference');material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.75;bsdf.inputs['Metallic'].default_value=.08
    tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    material.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    uvnode=material.node_tree.nodes.new('ShaderNodeUVMap');uvnode.uv_map='C2RearProjection';material.node_tree.links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
    material.diffuse_color=(.28,.23,.18,1)
    def uv(p):return ((p.x/.00265+148)/293,(735-(720-p.z/1.85*710))/735)
    # Replace the generated symmetric back ornament's color using the actual
    # reference. Keep cloth and silhouette; limit changes to rear-facing faces.
    body.data.materials.append(material);slot=len(body.data.materials)-1
    layer=body.data.uv_layers.new(name='C2RearProjection')
    for face in body.data.polygons:
        center=face.center
        if .94<center.z<1.60 and abs(center.x)<.245 and center.y<-.025 and face.normal.y<-.3:
            face.material_index=slot
        for li in face.loop_indices:layer.data[li].uv=uv(body.data.vertices[body.data.loops[li].vertex_index].co)
    def back_y(x,z):
        hit,p,n,index=body.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
        return p.y if hit else -.14
    def plate(name,outline,offset=.018):
        flat=[Vector(((u-148)*.00265,0,(720-v)/710*1.85)) for u,v in outline]
        triangles=tessellate_polygon([flat]);faces=[]
        for triangle in triangles:
            faces.append(tuple(v if isinstance(v,int) else flat.index(v) for v in triangle))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(flat,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=4,use_grid_fill=True);bm.to_mesh(mesh);bm.free()
        for v in mesh.vertices:v.co.y=back_y(v.co.x,v.co.z)-offset
        mesh.update();layer=mesh.uv_layers.new(name='C2RearProjection')
        for face in mesh.polygons:
            face.use_smooth=True
            for li in face.loop_indices:layer.data[li].uv=uv(mesh.vertices[mesh.loops[li].vertex_index].co)
        mesh.materials.append(material)
        bpy.context.view_layer.objects.active=obj
        solid=obj.modifiers.new('PlateThickness','SOLIDIFY');solid.thickness=.007
        bpy.ops.object.modifier_apply(modifier=solid.name)
        bevel=obj.modifiers.new('RoundedMineralEdges','BEVEL');bevel.width=.002;bevel.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        return obj
    shell=plate('C2_AsymmetricRearShell',[(210,167),(211,191),(199,218),(178,239),(150,262),(140,278),(154,292),(176,310),(203,328),(213,340),(187,332),(159,322),(133,310),(116,293),(115,277),(123,259),(145,240),(167,220),(184,196)])
    spine=plate('C2_AmberSpineChannel',[(145,67),(159,65),(163,95),(158,128),(166,163),(173,194),(170,221),(161,241),(147,253),(144,243),(154,221),(157,201),(151,176),(145,147),(144,119)],.024)
    return [shell,spine]
