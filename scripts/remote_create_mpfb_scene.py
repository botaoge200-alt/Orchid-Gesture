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
import mathutils
import traceback

def log(msg):
    print(f"[Blender] {msg}")
    with open(r"E:\Orchid Gesture\scripts\blender_run.log", "a") as f:
        f.write(f"{msg}\n")

def get_bounds(obj):
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
    BODY_EXPORT_PATH = os.path.abspath(r"E:\Orchid Gesture\client\public\models\mpfb_body.glb")
    SHIRT_EXPORT_PATH = os.path.abspath(r"E:\Orchid Gesture\client\public\models\fitted_shirt.glb")
    
    # 1. Clear Scene
    log("Clearing Scene...")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Clean unused data
    for block in bpy.data.meshes: bpy.data.meshes.remove(block)
    for block in bpy.data.materials: bpy.data.materials.remove(block)
    for block in bpy.data.textures: bpy.data.textures.remove(block)
    
    # 2. Create MPFB Human
    log("Creating MPFB Human...")
    if not hasattr(bpy.ops, 'mpfb'):
        return {"status": "error", "message": "MPFB addon not found"}
        
    try:
        bpy.ops.mpfb.create_human()
    except Exception as e:
        return {"status": "error", "message": f"Failed to create MPFB human: {str(e)}"}
        
    body = bpy.context.active_object
    log(f"Active Object after creation: {body.name} (Type: {body.type})")
    
    target_mesh = body
    if body.type == 'ARMATURE':
        log("Active object is Armature. Finding mesh child...")
        for child in body.children:
            if child.type == 'MESH':
                target_mesh = child
                break
        log(f"Target Mesh: {target_mesh.name}")
    
    body.name = "MPFB_Body_Root"
    target_mesh.name = "MPFB_Body"
    
    # Ensure Object Mode
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # 3. Construct Loose Shirt
    bounds = get_bounds(target_mesh)
    if not bounds:
        return {"status": "error", "message": "Could not calculate bounds"}
        
    # Dimensions
    dim_x = bounds[1] - bounds[0] # Width
    dim_y = bounds[3] - bounds[2] # Depth
    dim_z = bounds[5] - bounds[4] # Height
    
    log(f"Bounds: X[{bounds[0]:.2f}, {bounds[1]:.2f}] Y[{bounds[2]:.2f}, {bounds[3]:.2f}] Z[{bounds[4]:.2f}, {bounds[5]:.2f}]")
    log(f"Dimensions: Width={dim_x:.2f}, Depth={dim_y:.2f}, Height={dim_z:.2f}")
    
    center_x = (bounds[0] + bounds[1]) / 2
    center_y = (bounds[2] + bounds[3]) / 2
    
    # Define Shirt Zone (Torso)
    # Z-up: Waist to Neck
    waist_z = bounds[4] + dim_z * 0.50 # Hips
    neck_z = bounds[4] + dim_z * 0.87 # Neck
    shirt_height = neck_z - waist_z
    shirt_center_z = waist_z + shirt_height / 2
    
    # Radius: Loose fit
    # Use Depth (Y) as primary reference for torso thickness
    # Radius = Depth * 0.65 (Diameter = 1.3 * Depth)
    radius = dim_y * 0.65
    
    try:
        log("Adding cylinder...")
        bpy.ops.mesh.primitive_cylinder_add(
            radius=radius, 
            depth=shirt_height, 
            vertices=64, 
            location=(center_x, center_y, shirt_center_z),
            end_fill_type='NGON'
        )
        shirt = bpy.context.active_object
        log(f"Cylinder added: {shirt.name if shirt else 'None'}")
    except Exception as e:
        log(f"Error adding cylinder: {e}")
        raise e

    if not shirt:
        log("Shirt object creation failed")
        return {"status": "error", "message": "Shirt creation failed"}

    shirt.name = "Fitted_Shirt"
    
    # Subdivide for simulation/wrapping
    log("Subdividing...")
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.subdivide(number_cuts=10)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Modifiers
    log("Adding modifiers...")
    
    # A. Shrinkwrap (Loose)
    mod_wrap = shirt.modifiers.new(name="FitToBody", type='SHRINKWRAP')
    mod_wrap.target = target_mesh 
    mod_wrap.wrap_method = 'NEAREST_SURFACEPOINT'
    mod_wrap.offset = 0.04 # 4cm gap (Loose!)
    mod_wrap.wrap_mode = 'ON_SURFACE'
    
    # Apply Shrinkwrap to bake the shape for Booleans
    log("Applying Shrinkwrap...")
    bpy.context.view_layer.objects.active = shirt
    bpy.ops.object.modifier_apply(modifier="FitToBody")
    
    # Solidify moved after Booleans for stability
    # log("Solidifying...")
    # ...
    
    # --- Boolean Cuts (Neck & Arms) ---
    if False: # Temporarily disabled for stability check
        log("Creating Boolean Cutters...")
    
        # 1. Neck Cutter (Sphere)
        neck_radius = dim_y * 0.40
        neck_location = (center_x, center_y - (dim_y * 0.05), neck_z + (neck_radius * 0.2))
        
        bpy.ops.mesh.primitive_uv_sphere_add(radius=neck_radius, location=neck_location)
        neck_cutter = bpy.context.active_object
        neck_cutter.name = "Neck_Cutter"
        
        # 2. Arm Cutters (Cylinders)
        shoulder_z = neck_z - (dim_z * 0.05)
        arm_radius = (dim_z * 0.07) # Increased from 0.05 to 0.07
        arm_offset_x = (dim_x * 0.25)
        
        # Left Arm
        bpy.ops.mesh.primitive_cylinder_add(
            radius=arm_radius, depth=dim_x * 1.5,
            location=(center_x - arm_offset_x, center_y, shoulder_z),
            rotation=(0, 1.5708, 0)
        )
        arm_l = bpy.context.active_object
        arm_l.name = "Arm_L_Cutter"
        
        # Right Arm
        bpy.ops.mesh.primitive_cylinder_add(
            radius=arm_radius, depth=dim_x * 1.5,
            location=(center_x + arm_offset_x, center_y, shoulder_z),
            rotation=(0, 1.5708, 0)
        )
        arm_r = bpy.context.active_object
        arm_r.name = "Arm_R_Cutter"
        
        # Apply Booleans
        log("Applying Booleans...")
        bpy.context.view_layer.objects.active = shirt
        
        mod_bool_neck = shirt.modifiers.new(name="BoolNeck", type='BOOLEAN')
        mod_bool_neck.object = neck_cutter
        mod_bool_neck.operation = 'DIFFERENCE'
        mod_bool_neck.solver = 'FLOAT' 
        bpy.ops.object.modifier_apply(modifier="BoolNeck")
        
        mod_bool_arm_l = shirt.modifiers.new(name="BoolArmL", type='BOOLEAN')
        mod_bool_arm_l.object = arm_l
        mod_bool_arm_l.operation = 'DIFFERENCE'
        mod_bool_arm_l.solver = 'FLOAT'
        bpy.ops.object.modifier_apply(modifier="BoolArmL")
        
        mod_bool_arm_r = shirt.modifiers.new(name="BoolArmR", type='BOOLEAN')
        mod_bool_arm_r.object = arm_r
        mod_bool_arm_r.operation = 'DIFFERENCE'
        mod_bool_arm_r.solver = 'FLOAT'
        bpy.ops.object.modifier_apply(modifier="BoolArmR")
        
        # Cleanup Cutters (Robust Deletion)
        log("Deleting Cutters...")
        bpy.ops.object.select_all(action='DESELECT')
        neck_cutter.select_set(True)
        arm_l.select_set(True)
        arm_r.select_set(True)
        bpy.ops.object.delete()
    
    # Reselect Shirt
    bpy.context.view_layer.objects.active = shirt
    shirt.select_set(True)
    
    # Solidify (Moved here for stability)
    if False: # Temporarily disabled
        log("Solidifying...")
        mod_solid = shirt.modifiers.new(name="Thickness", type='SOLIDIFY')
        mod_solid.thickness = 0.02 # 2cm
        mod_solid.offset = 1.0 # Outward
        bpy.ops.object.modifier_apply(modifier="Thickness")
    
    # Check vertices
    log(f"Shirt vertices: {len(shirt.data.vertices)}")
    
    # Remesh to fix topology after booleans?
    # Voxel Remesh is good for "White Embryo" smooth look.
    # log("Voxel Remeshing...")
    # # Ensure voxel size < thickness (0.02)
    # voxel_size = 0.008 # 8mm
    # shirt.data.remesh_voxel_size = voxel_size 
    # shirt.data.remesh_mode = 'VOXEL'
    # 
    # mod_remesh = shirt.modifiers.new(name="Remesh", type='REMESH')
    # mod_remesh.voxel_size = voxel_size
    # mod_remesh.mode = 'VOXEL'
    # bpy.ops.object.modifier_apply(modifier="Remesh")
    
    # Smooth again after remesh
    mod_smooth_post = shirt.modifiers.new(name="SmoothPost", type='CORRECTIVE_SMOOTH')
    mod_smooth_post.iterations = 40 # Increased smoothing
    mod_smooth_post.factor = 1.0
    mod_smooth_post.smooth_type = 'LENGTH_WEIGHTED'

    # C. Displace (Wrinkles)
    tex_name = "WrinkleTex"
    tex = bpy.data.textures.get(tex_name)
    if not tex:
        tex = bpy.data.textures.new(tex_name, 'CLOUDS')
        tex.noise_scale = 0.5
        tex.noise_depth = 2
        
    mod_disp = shirt.modifiers.new(name="Wrinkles", type='DISPLACE')
    mod_disp.texture = tex
    mod_disp.strength = 0.005 # 5mm subtle wave
    mod_disp.mid_level = 0.5
    
    # D. Solidify (Thickness) -> MOVED TO BEFORE BOOLEANS
    # mod_solid = shirt.modifiers.new(name="Thickness", type='SOLIDIFY')
    # mod_solid.thickness = 0.005 # 5mm
    # mod_solid.offset = 1.0
    
    # E. Subsurf (Final Polish)
    mod_sub = shirt.modifiers.new(name="Subsurf", type='SUBSURF')
    mod_sub.levels = 1
    
    # Material
    mat = bpy.data.materials.new(name="Shirt_Mat")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.96, 0.96, 0.94, 1.0) # Off-white
        bsdf.inputs['Roughness'].default_value = 0.9 # Fabric
        
    shirt.data.materials.append(mat)
    
    # 4. Export Body
    log("Exporting Body...")
    os.makedirs(os.path.dirname(BODY_EXPORT_PATH), exist_ok=True)
    
    bpy.ops.object.select_all(action='DESELECT')
    
    # Select body and its children (eyes, etc)
    target_mesh.select_set(True)
    if body != target_mesh:
        body.select_set(True)
    
    # Recursive children
    def select_children(obj):
        for child in obj.children:
            child.select_set(True)
            select_children(child)
    select_children(body)
        
    bpy.context.view_layer.objects.active = target_mesh
    
    try:
        bpy.ops.export_scene.gltf(
            filepath=BODY_EXPORT_PATH,
            use_selection=True,
            export_format='GLB',
            export_apply=True
        )
        log(f"Exported Body to {BODY_EXPORT_PATH}")
    except Exception as e:
        log(f"Error exporting body: {e}")
    
    # 5. Export Shirt
    log("Exporting Shirt...")
    bpy.ops.object.select_all(action='DESELECT')
    shirt.select_set(True)
    bpy.context.view_layer.objects.active = shirt
    
    try:
        bpy.ops.export_scene.gltf(
            filepath=SHIRT_EXPORT_PATH,
            use_selection=True,
            export_format='GLB',
            export_apply=True
        )
        log(f"Exported Shirt to {SHIRT_EXPORT_PATH}")
    except Exception as e:
        log(f"Error exporting shirt: {e}")
    
    return {"status": "success", "message": "Generated MPFB Body and Loose Shirt"}

try:
    result = run()
except Exception as e:
    import traceback
    trace = traceback.format_exc()
    with open(r"E:\Orchid Gesture\scripts\blender_run.log", "a") as f:
        f.write(f"CRITICAL ERROR: {str(e)}\n{trace}\n")
    result = {"status": "error", "message": str(e), "trace": trace}
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
