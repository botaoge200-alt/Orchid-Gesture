import socket
import json
import textwrap

HOST = '127.0.0.1'
PORT = 9876

def setup_lattice():
    print("Connecting to Blender to setup Lattice Deformation...")
    
    blender_script = textwrap.dedent("""
    import bpy
    import math

    # 1. Find the object
    obj_name = "Generated_Blue_Shirt.001"
    if obj_name not in bpy.data.objects:
        candidates = [o for o in bpy.data.objects if "Blue" in o.name]
        if candidates:
            obj_name = candidates[0].name
        else:
            if bpy.context.active_object:
                obj_name = bpy.context.active_object.name
    
    obj = bpy.data.objects.get(obj_name)
    if not obj:
        print("Error: Shirt object not found")
    else:
        print(f"Processing object: {obj.name}")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        
        # 2. Orient Upright if needed
        dim = obj.dimensions
        if dim.y > dim.z * 1.5:
            print("Object appears to be lying down. Rotating...")
            obj.rotation_euler[0] += math.radians(90)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            
        # 3. Add Subdivision Surface (High density for "pixel" control)
        mod_subsurf = obj.modifiers.new(name="HighRes_Subsurf", type='SUBSURF')
        mod_subsurf.levels = 2
        mod_subsurf.render_levels = 2
        print("Added Subdivision Surface modifier (Level 2).")
        
        # 4. Add Lattice
        # Calculate bounds
        bbox_min = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
        bbox_max = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
        
        center = [(bbox_min[i] + bbox_max[i])/2 for i in range(3)]
        size = [(bbox_max[i] - bbox_min[i]) * 1.2 for i in range(3)] # 20% padding
        
        bpy.ops.object.add(type='LATTICE', location=center)
        lat = bpy.context.active_object
        lat.name = "Lattice_Deformer"
        lat.scale = size
        
        # Set Lattice resolution (5x5x5 for good control)
        lat.data.points_u = 5
        lat.data.points_v = 5
        lat.data.points_w = 5
        
        # 5. Apply Lattice Modifier to Shirt
        bpy.context.view_layer.objects.active = obj
        mod_lat = obj.modifiers.new(name="Lattice_Deform", type='LATTICE')
        mod_lat.object = lat
        
        print("Lattice setup complete.")
        print("INSTRUCTIONS:")
        print("1. Select 'Lattice_Deformer' object.")
        print("2. Go to Edit Mode (Tab).")
        print("3. Select points and move them to deform the shirt broadly.")
        print("4. Select the Shirt and go to Sculpt Mode to adjust 'every pixel' details.")
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
        
        resp = s.recv(4096)
        print(f"Response: {resp.decode('utf-8')}")
        s.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    setup_lattice()
