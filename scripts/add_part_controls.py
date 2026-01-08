import socket
import json
import textwrap

HOST = '127.0.0.1'
PORT = 9876

def create_controls():
    print("Connecting to Blender to add part controls...")
    
    # Python script to run INSIDE Blender
    blender_script = textwrap.dedent("""
    import bpy
    import math

    # 1. Find the object
    obj_name = "Generated_Shirt_Collar.001"
    if obj_name not in bpy.data.objects:
        # Fallback to finding any object with "Shirt" in name
        candidates = [o for o in bpy.data.objects if "Shirt" in o.name]
        if candidates:
            obj_name = candidates[0].name
        else:
            # Fallback to active object
            if bpy.context.active_object:
                obj_name = bpy.context.active_object.name
    
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        print("Error: Shirt object not found")
    else:
        print(f"Processing object: {obj.name}")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        
        # 2. Orient Upright if needed (Heuristic: Y dim > Z dim significantly)
        dim = obj.dimensions
        if dim.y > dim.z * 1.5:
            print("Object appears to be lying down (Y-up). Rotating to Z-up...")
            obj.rotation_euler[0] += math.radians(90)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            
        # 3. Create Vertex Groups
        # Clear existing groups
        obj.vertex_groups.clear()
        
        vg_sleeve_l = obj.vertex_groups.new(name="Sleeve_L")
        vg_sleeve_r = obj.vertex_groups.new(name="Sleeve_R")
        vg_collar = obj.vertex_groups.new(name="Collar")
        vg_torso = obj.vertex_groups.new(name="Torso")
        
        # Get bounding box for relative thresholds
        # Note: dimensions are updated after rotation
        bbox_min = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
        bbox_max = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
        
        width = bbox_max[0] - bbox_min[0]
        height = bbox_max[2] - bbox_min[2]
        depth = bbox_max[1] - bbox_min[1]
        
        # Thresholds
        x_limit = width * 0.25 # Sleeves are outer 25% on each side
        z_collar_limit = bbox_max[2] - (height * 0.15) # Top 15%
        
        # Assign vertices
        for v in obj.data.vertices:
            co = v.co
            
            # Collar: High Z
            if co.z > z_collar_limit:
                vg_collar.add([v.index], 1.0, 'REPLACE')
                continue
                
            # Sleeves: Outer X
            if co.x > x_limit:
                vg_sleeve_l.add([v.index], 1.0, 'REPLACE')
            elif co.x < -x_limit:
                vg_sleeve_r.add([v.index], 1.0, 'REPLACE')
            else:
                vg_torso.add([v.index], 1.0, 'REPLACE')
                
        # 4. Add Shape Keys (Basis + Deformations)
        if not obj.data.shape_keys:
            obj.shape_key_add(name="Basis")
            
        # Helper to create scaling shape key
        def add_scale_key(name, vg_name, scale_factor):
            if name in obj.data.shape_keys.key_blocks:
                obj.shape_key_remove(obj.data.shape_keys.key_blocks[name])
            
            key = obj.shape_key_add(name=name)
            
            # We need to manually set positions for the shape key
            # Ideally we use 'from_mix' or manipulate data directly
            # Simple approach: Scale vertices in the group
            
            # Calculate center of group for scaling
            vs = [v for v in obj.data.vertices if obj.vertex_groups[vg_name].index in [g.group for g in v.groups]]
            if not vs: return
            
            center = sum((v.co for v in vs), mathutils.Vector()) / len(vs)
            
            for v in vs:
                # Get weight
                w = 0
                for g in v.groups:
                    if g.group == obj.vertex_groups[vg_name].index:
                        w = g.weight
                        break
                
                # Apply scale relative to group center
                delta = v.co - center
                new_pos = center + delta * scale_factor
                
                # Blend based on weight
                key.data[v.index].co = v.co.lerp(new_pos, w)
                
        # Need mathutils
        import mathutils
        
        # Add Keys
        # Sleeve Length: Scale X by 1.5
        # Note: This simple scaling might distort. A better way involves moving them outward.
        # Let's try simple Translation for length
        
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

        add_translation_key("Sleeve_L_Longer", "Sleeve_L", (0.2, 0, 0))
        add_translation_key("Sleeve_R_Longer", "Sleeve_R", (-0.2, 0, 0))
        
        # Collar Bigger (Scale from center of collar)
        # We'll use the scale logic for collar
        add_scale_key("Collar_Bigger", "Collar", 1.3)
        
        # Torso Wider
        add_scale_key("Torso_Wider", "Torso", 1.3)

        print("Shape Keys created.")
        
        # 5. Add Drivers / Control Empties (Gizmos)
        # Create Empty at top for Collar
        bpy.ops.object.empty_add(type='SPHERE', location=(0, 0, bbox_max[2] + 0.2))
        ctrl_collar = bpy.context.active_object
        ctrl_collar.name = "CTRL_Collar_Size"
        ctrl_collar.scale = (0.2, 0.2, 0.2)
        
        # Drive "Collar_Bigger" by Empty Z location
        # Driver for Shape Key
        sk = obj.data.shape_keys.key_blocks["Collar_Bigger"]
        d = sk.driver_add("value")
        var = d.driver.variables.new()
        var.name = "var"
        var.type = 'TRANSFORMS'
        t = var.targets[0]
        t.id = ctrl_collar
        t.transform_type = 'LOC_Z'
        t.transform_space = 'LOCAL_SPACE'
        d.driver.expression = "max(0, var * 5)" # Scale factor
        
        print("Controls setup complete. Drag 'CTRL_Collar_Size' up to enlarge collar.")
        
    """)
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect((HOST, PORT))
        
        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_script
            }
        }
        s.sendall(json.dumps(payload).encode('utf-8'))
        
        # Wait for ack
        resp = s.recv(4096)
        print(f"Response: {resp.decode('utf-8')}")
        s.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_controls()
