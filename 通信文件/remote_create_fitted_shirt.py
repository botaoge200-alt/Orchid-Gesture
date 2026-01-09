import socket
import json
import os
import time

HOST = '127.0.0.1'
PORT = 9876

# The Blender script to be executed remotely
BLENDER_SCRIPT = r"""
import bpy
import os
import math
import mathutils
import json

def log(msg):
    print(f"[Blender] {msg}")

def get_bounds(obj):
    '''Returns world space bounds: min_x, max_x, min_y, max_y, min_z, max_z'''
    # Force update
    bpy.context.view_layer.update()
    
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')
    
    mw = obj.matrix_world
    if not obj.bound_box:
        return None
        
    for corner in obj.bound_box:
        v = mw @ mathutils.Vector(corner)
        if v.x < min_x: min_x = v.x
        if v.x > max_x: max_x = v.x
        if v.y < min_y: min_y = v.y
        if v.y > max_y: max_y = v.y
        if v.z < min_z: min_z = v.z
        if v.z > max_z: max_z = v.z
        
    return (min_x, max_x, min_y, max_y, min_z, max_z)

def run():
    EXPORT_PATH = os.path.abspath(r"E:\Orchid Gesture\client\public\models\fitted_shirt.glb")
    
    # 1. Find Body (More robust search)
    body = None
    # Prefer original mesh
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            n = obj.name.lower()
            if 'woman' in n or 'body' in n or 'female' in n:
                if 'shirt' not in n and 'fitted' not in n: # Avoid selecting previous generations
                    body = obj
                    break
    
    if not body:
        # Fallback to largest mesh that isn't a shirt
        candidates = [o for o in bpy.data.objects if o.type == 'MESH' and o.dimensions.length > 0.5]
        candidates = [o for o in candidates if 'shirt' not in o.name.lower()]
        if candidates:
            candidates.sort(key=lambda o: o.dimensions.x * o.dimensions.y * o.dimensions.z, reverse=True)
            body = candidates[0]
    
    if not body:
        return {"status": "error", "message": "No body mesh found"}

    # Cleanup previous generations
    for o in bpy.data.objects:
        if "Fitted_Shirt" in o.name:
            bpy.data.objects.remove(o, do_unlink=True)
            
    log(f"Target Body: {body.name}")
    
    # 2. CONSTRUCT SHIRT (Don't copy body)
    # Strategy: Create a Cylinder around torso, then shrinkwrap
    
    # Analyze Dimensions (World Space)
    bounds = get_bounds(body)
    width = bounds[1] - bounds[0]
    height = bounds[3] - bounds[2]
    depth = bounds[5] - bounds[4]
    
    is_y_up = height > depth and height > width
    
    if is_y_up:
        log("Detected Y-UP Orientation")
        h_min, h_max = bounds[2], bounds[3]
        w_min, w_max = bounds[0], bounds[1]
        d_min, d_max = bounds[4], bounds[5]
        center_x = (w_min + w_max) / 2
        center_z = (d_min + d_max) / 2
        axis = 'Y'
    else:
        log("Detected Z-UP Orientation")
        h_min, h_max = bounds[4], bounds[5]
        w_min, w_max = bounds[0], bounds[1]
        d_min, d_max = bounds[2], bounds[3]
        center_x = (w_min + w_max) / 2
        center_y = (d_min + d_max) / 2
        axis = 'Z'

    full_height = h_max - h_min
    
    # Define Shirt Zone (Torso)
    # Waist is around 50% up (Hip to Neck)
    waist_z = h_min + full_height * 0.48
    neck_z = h_min + full_height * 0.82
    shirt_height = neck_z - waist_z
    shirt_center_h = waist_z + shirt_height / 2
    
    # Create Cylinder
    # Radius should be enough to cover the widest part (Chest/Shoulders)
    # Chest width is roughly body width
    radius = (w_max - w_min) * 0.4 # Slightly smaller than bounding box to fit snug? No, Shrinkwrap will pull it in.
    # Start slightly larger to avoid intersections
    radius = radius * 1.2
    
    log(f"Creating Cylinder: Radius={radius:.2f}, Height={shirt_height:.2f}")
    
    if is_y_up:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius, 
            depth=shirt_height, 
            location=(center_x, shirt_center_h, center_z),
            vertices=64,
            end_fill_type='NOTHING'
        )
    else:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius, 
            depth=shirt_height, 
            location=(center_x, center_y, shirt_center_h),
            vertices=64,
            end_fill_type='NOTHING'
        )
        
    shirt = bpy.context.active_object
    shirt.name = "Fitted_Shirt_Constructed"
    
    # Add horizontal loops for flexibility
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # Subdivide (Cut number 10)
    bpy.ops.mesh.subdivide(number_cuts=8) # Further reduced to < 5MB
    bpy.ops.object.mode_set(mode='OBJECT')

    # 3. Shrinkwrap (The "Vacuum Seal")
    mod_wrap = shirt.modifiers.new(name="FitToBody", type='SHRINKWRAP')
    mod_wrap.target = body
    mod_wrap.wrap_method = 'NEAREST_SURFACEPOINT' # Good for cylinders wrapping around
    mod_wrap.offset = 0.03 # 3cm offset (Better fit)
    mod_wrap.wrap_mode = 'ON_SURFACE'
    
    # 4. Smooth (To remove jaggedness from projection)
    mod_smooth = shirt.modifiers.new(name="Smooth", type='CORRECTIVE_SMOOTH')
    mod_smooth.iterations = 20
    mod_smooth.factor = 1.0
    mod_smooth.smooth_type = 'LENGTH_WEIGHTED'
    
    # 5. Solidify
    mod_solid = shirt.modifiers.new(name="Thickness", type='SOLIDIFY')
    mod_solid.thickness = 0.005 # 5mm (T-shirt thickness)
    mod_solid.offset = 1.0 # Outward
    
    # 6. Subsurf (Final Polish)
    mod_sub = shirt.modifiers.new(name="Subsurf", type='SUBSURF')
    mod_sub.levels = 1 # Reduced from 2 to optimize size
    mod_sub.render_levels = 1

    # 8. Material
    mat_name = "Shirt_Mat_Clean"
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.95, 0.93, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.8
    if len(shirt.data.materials) == 0:
        shirt.data.materials.append(mat)
    else:
        shirt.data.materials[0] = mat

    # 9. Export
    os.makedirs(os.path.dirname(EXPORT_PATH), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    shirt.select_set(True)
    bpy.context.view_layer.objects.active = shirt
    
    # Ensure modifiers are applied in export
    bpy.ops.export_scene.gltf(
        filepath=EXPORT_PATH,
        use_selection=True,
        export_format='GLB',
        export_apply=True
    )
    
    return {"status": "success", "message": f"Generated Sculpted Shirt at {EXPORT_PATH}"}

try:
    result = run()
except Exception as e:
    import traceback
    result = {"status": "error", "message": str(e), "trace": traceback.format_exc()}
"""

def main():
    print(f"Connecting to Blender on {HOST}:{PORT}...")
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((HOST, PORT))
            
            # Send script
            payload = {
                "type": "execute_code",
                "params": {
                    "code": BLENDER_SCRIPT
                }
            }
            msg = json.dumps(payload)
            s.sendall(msg.encode('utf-8'))
            
            # Receive response
            data = s.recv(4096).decode('utf-8')
            print(f"Blender Response: {data}")
            
    except ConnectionRefusedError:
        print("ERROR: Could not connect to Blender. Is the socket server running?")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
