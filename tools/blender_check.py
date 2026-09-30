"""Verify local Blender can execute the character asset pipeline."""
import bpy
import json

print(json.dumps({'status': 'ok', 'version': bpy.app.version_string,
                  'gltf_import': hasattr(bpy.ops.import_scene, 'gltf'),
                  'gltf_export': hasattr(bpy.ops.export_scene, 'gltf')}))
