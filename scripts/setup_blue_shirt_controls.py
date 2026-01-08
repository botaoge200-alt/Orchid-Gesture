import socket
import json
import textwrap
import os

HOST = '127.0.0.1'
PORT = 9876
EXPORT_PATH = os.path.abspath("models/Blue_Outdoor_Shirt.glb").replace("\\", "/")

def setup_controls():
    print("Setting up controls for Blue Shirt...")
    
    blender_script = textwrap.dedent(f"""
    import bpy
    import math
    import mathutils

    obj_name = "Generated_Blue_Shirt.001"
    obj = bpy.data.objects.get(obj_name)
    
    if not obj:
        print(f"Error: {{obj_name}} not found")
    else:
        print(f"Processing {{obj.name}}...")
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        
        # 1. Apply Modifiers to bake base shape
        # We need to iterate and apply. 
        # Note: Apply modifier usually requires the object to be active and in object mode.
        try:
            for mod in obj.modifiers:
                print(f"Applying modifier: {{mod.name}}")
                bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            print(f"Error applying modifiers: {{e}}")

        # 2. Setup Vertex Groups
        obj.vertex_groups.clear()
        
        vg_sleeve_l = obj.vertex_groups.new(name="Sleeve_L")
        vg_sleeve_r = obj.vertex_groups.new(name="Sleeve_R")
        vg_collar = obj.vertex_groups.new(name="Collar")
        vg_torso = obj.vertex_groups.new(name="Torso")
        
        # Calculate bounding box
        bbox_min = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
        bbox_max = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
        
        width = bbox_max[0] - bbox_min[0]
        height = bbox_max[2] - bbox_min[2]
        
        # Thresholds (tuned for a shirt)
        # Center is roughly 0. Sleeves are at +/- X.
        # Collar is at +Z.
        
        x_limit = width * 0.25 
        z_collar_limit = bbox_max[2] - (height * 0.15)
        
        for v in obj.data.vertices:
            co = v.co
            if co.z > z_collar_limit and abs(co.x) < width * 0.2:
                vg_collar.add([v.index], 1.0, 'REPLACE')
            elif co.x > x_limit:
                vg_sleeve_l.add([v.index], 1.0, 'REPLACE')
            elif co.x < -x_limit:
                vg_sleeve_r.add([v.index], 1.0, 'REPLACE')
            else:
                vg_torso.add([v.index], 1.0, 'REPLACE')
                
        # 3. Add Shape Keys
        if not obj.data.shape_keys:
            obj.shape_key_add(name="Basis")
            
        # Helper to translate vertices
        def add_translation_key(name, vg_name, vec):
             if name in obj.data.shape_keys.key_blocks:
                obj.shape_key_remove(obj.data.shape_keys.key_blocks[name])
             
             key = obj.shape_key_add(name=name)
             vg_idx = obj.vertex_groups[vg_name].index
             
             for v in obj.data.vertices:
                 w = 0
                 for g in v.groups:
                     if g.group == vg_idx:
                         w = g.weight
                         break
                 if w > 0:
                     key.data[v.index].co += mathutils.Vector(vec) * w

        # Sleeve Length
        add_translation_key("Sleeve_L_Longer", "Sleeve_L", (0.5, 0, 0))
        add_translation_key("Sleeve_R_Longer", "Sleeve_R", (-0.5, 0, 0))
        
        # Collar Height/Scale
        # For collar, we might want to scale it up.
        if "Collar_Bigger" in obj.data.shape_keys.key_blocks:
            obj.shape_key_remove(obj.data.shape_keys.key_blocks["Collar_Bigger"])
        
        key_collar = obj.shape_key_add(name="Collar_Bigger")
        vg_collar_idx = vg_collar.index
        
        # Find center of collar
        collar_verts = [v for v in obj.data.vertices if vg_collar_idx in [g.group for g in v.groups]]
        if collar_verts:
            avg_x = sum(v.co.x for v in collar_verts) / len(collar_verts)
            avg_y = sum(v.co.y for v in collar_verts) / len(collar_verts)
            avg_z = sum(v.co.z for v in collar_verts) / len(collar_verts)
            center = mathutils.Vector((avg_x, avg_y, avg_z))
            
            for v in collar_verts:
                # Scale out from center
                dir = (v.co - center) * 0.5 # 50% bigger
                key_collar.data[v.index].co += dir

        print("Shape Keys created.")

        # 4. Export
        print(f"Exporting to '{EXPORT_PATH}'...")
        bpy.ops.export_scene.gltf(
            filepath='{EXPORT_PATH}',
            check_existing=False,
            use_selection=True,
            export_format='GLB',
            export_apply=False  # Do NOT apply modifiers (we already did manually, or want to keep shape keys)
        )
        print("Export successful!")
    """)
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(60)
        s.connect((HOST, PORT))
        
        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_script
            }
        }
        s.sendall(json.dumps(payload).encode('utf-8'))
        
        resp = s.recv(4096)
        print(f"Response: {resp.decode('utf-8')}")
        s.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    setup_controls()
