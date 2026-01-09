import socket
import json
import os
import time
import math

HOST = '127.0.0.1'
PORT = 9876

# The Blender script to be executed remotely
BLENDER_SCRIPT = r"""
import bpy
import os
import mathutils
import math

def log(msg):
    print(f"[Blender] {msg}")
    with open(r"E:\Orchid Gesture\scripts\blender_run.log", "a") as f:
        f.write(f"{msg}\n")

def create_aligned_cylinder(p1, p2, radius, name="Cylinder"):
    # Create a cylinder between two points p1 and p2
    
    # Calculate vector and length
    v = p2 - p1
    length = v.length
    
    # Midpoint
    center = (p1 + p2) / 2
    
    # Rotation (Align Z axis to vector)
    direction = v.normalized()
    up_vec = mathutils.Vector((0, 0, 1))
    
    # Calculate rotation quaternion
    rot_quat = up_vec.rotation_difference(direction)
    
    # Create Cylinder
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, 
        depth=length, 
        vertices=32,
        location=center,
        rotation=rot_quat.to_euler()
    )
    
    obj = bpy.context.active_object
    obj.name = name
    return obj

def run():
    BODY_EXPORT_PATH = os.path.abspath(r"E:\Orchid Gesture\client\public\models\mpfb_body.glb")
    SWEATER_EXPORT_PATH = os.path.abspath(r"E:\Orchid Gesture\client\public\models\fitted_shirt.glb")
    
    # 1. Clear Scene
    log("Clearing Scene...")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Clean unused data
    for block in bpy.data.meshes: bpy.data.meshes.remove(block)
    for block in bpy.data.materials: bpy.data.materials.remove(block)
    
    # 2. Create MPFB Human
    log("Creating MPFB Human...")
    if not hasattr(bpy.ops, 'mpfb'):
        return {"status": "error", "message": "MPFB addon not found"}
        
    try:
        # Create human with rig
        bpy.ops.mpfb.create_human(rig="rigify") 
        # Note: 'rigify' or 'standard' usually creates a rig. 
        # If args differ, default create_human() usually adds a rig or we can add one.
        # Let's try default first, then check for rig.
    except Exception as e:
        log(f"Create human failed, trying simple: {e}")
        bpy.ops.mpfb.create_human()
        
    body = bpy.context.active_object
    log(f"Active Object: {body.name} ({body.type})")
    
    # Find Armature and Mesh
    armature = None
    target_mesh = None
    
    if body.type == 'ARMATURE':
        armature = body
        for child in body.children:
            if child.type == 'MESH':
                target_mesh = child
                break
    elif body.type == 'MESH':
        target_mesh = body
        if body.parent and body.parent.type == 'ARMATURE':
            armature = body.parent
            
    if not armature:
        log("No armature found! Cannot generate rigged sweater. Attempting to add rig...")
        # Fallback: MPFB add rig if missing?
        # For now, assume MPFB creates one or we rely on bounds.
        # If no rig, we fail over to bounds method? 
        # Actually, let's try to find ANY armature.
        for obj in bpy.data.objects:
            if obj.type == 'ARMATURE':
                armature = obj
                break
    
    if not armature:
        return {"status": "error", "message": "Armature not found. Please ensure MPFB generates a rig."}

    log(f"Using Armature: {armature.name}")
    
    # Ensure we are in Object Mode
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # 3. Analyze Skeleton for Dimensions
    # We need world coordinates of bones
    mw = armature.matrix_world
    
    # Helper to get bone head/tail in world space
    def get_bone_locs(bone_name):
        # Rigify names vs Standard names
        # Common: 'spine', 'spine.001', 'upper_arm.L', 'forearm.L'
        # MPFB might use 'upperarm01.L' etc.
        # Let's search for fuzzy matches
        
        found_bone = None
        for bone in armature.data.bones:
            if bone_name in bone.name:
                found_bone = bone
                break
        
        if not found_bone:
            return None, None
            
        return mw @ found_bone.head, mw @ found_bone.tail

    # Points of interest
    spine_head, spine_tail = get_bone_locs("spine") # Lower spine
    neck_head, neck_tail = get_bone_locs("neck") # Neck
    
    # If standard spine not found, try to find top and bottom of torso
    # Torso: Pelvis to Neck
    pelvis_head, pelvis_tail = get_bone_locs("pelvis")
    if not pelvis_head: pelvis_head, pelvis_tail = get_bone_locs("hip")
    
    # Arms
    arm_l_head, arm_l_tail = get_bone_locs("upper_arm.L")
    if not arm_l_head: arm_l_head, arm_l_tail = get_bone_locs("upperarm")
    
    forearm_l_head, forearm_l_tail = get_bone_locs("forearm.L")
    
    arm_r_head, arm_r_tail = get_bone_locs("upper_arm.R")
    forearm_r_head, forearm_r_tail = get_bone_locs("forearm.R")
    
    # Validate
    if not (neck_head and arm_l_head):
        log("Critical bones not found. Dumping bone names...")
        for b in armature.data.bones: log(b.name)
        return {"status": "error", "message": "Skeleton structure unknown"}

    # 4. Construct Sweater Parts
    parts = []
    
    # A. Torso Tube
    # From Hips (Pelvis) to Neck
    # If pelvis found, use it. Else estimate from spine.
    torso_bottom = pelvis_head if pelvis_head else spine_head
    torso_top = neck_head
    
    # Torso Radius
    # Measure body bounds to guess radius?
    # Or just fixed generous radius. 
    # Average human width ~40-50cm. Radius ~0.25m.
    # Let's make it loose: 0.28m
    # Better: Measure distance between shoulders?
    shoulder_width = (arm_l_head - arm_r_head).length
    torso_radius = shoulder_width * 0.35 # Slightly wider than half width
    
    log("Creating Torso...")
    torso = create_aligned_cylinder(torso_bottom, torso_top, torso_radius, "Torso_Part")
    parts.append(torso)
    
    # B. Sleeves (Long)
    # Left Arm (Upper + Forearm combined for simplicity? Or separate segments?)
    # Separate segments allow for bending.
    arm_radius = torso_radius * 0.4 # Sleeves are thinner
    
    log("Creating Left Sleeve...")
    # Upper
    sleeve_l1 = create_aligned_cylinder(arm_l_head, arm_l_tail, arm_radius, "Sleeve_L1")
    parts.append(sleeve_l1)
    # Lower (Forearm) - Extend slightly for wrist
    sleeve_l2 = create_aligned_cylinder(forearm_l_head, forearm_l_tail * 1.1, arm_radius * 0.85, "Sleeve_L2") # Tapered
    parts.append(sleeve_l2)
    
    log("Creating Right Sleeve...")
    # Upper
    sleeve_r1 = create_aligned_cylinder(arm_r_head, arm_r_tail, arm_radius, "Sleeve_R1")
    parts.append(sleeve_r1)
    # Lower
    sleeve_r2 = create_aligned_cylinder(forearm_r_head, forearm_r_tail * 1.1, arm_radius * 0.85, "Sleeve_R2")
    parts.append(sleeve_r2)
    
    # 5. Union All Parts
    log("Unioning Parts...")
    bpy.ops.object.select_all(action='DESELECT')
    
    # Active: Torso
    bpy.context.view_layer.objects.active = torso
    torso.select_set(True)
    
    for part in parts:
        if part != torso:
            mod_bool = torso.modifiers.new(name=f"Union_{part.name}", type='BOOLEAN')
            mod_bool.object = part
            mod_bool.operation = 'UNION'
            mod_bool.solver = 'FLOAT' # Fast is more stable for simple primitives
            bpy.ops.object.modifier_apply(modifier=mod_bool.name)
            
            # Delete the part
            bpy.data.objects.remove(part, do_unlink=True)
            
    sweater = torso
    sweater.name = "Sweater_Base"
    
    # 6. Refinement (Remesh & Smooth)
    log("Refining Shape...")
    
    # Voxel Remesh to fuse seams and make it organic
    mod_remesh = sweater.modifiers.new(name="Remesh", type='REMESH')
    mod_remesh.mode = 'VOXEL'
    mod_remesh.voxel_size = 0.015 # 1.5cm resolution (coarse but smooth)
    mod_remesh.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier="Remesh")
    
    # Corrective Smooth to bubble it out
    mod_smooth = sweater.modifiers.new(name="Smooth", type='CORRECTIVE_SMOOTH')
    mod_smooth.iterations = 50
    mod_smooth.factor = 1.0
    mod_smooth.smooth_type = 'LENGTH_WEIGHTED'
    bpy.ops.object.modifier_apply(modifier="Smooth")
    
    # 7. Cut Neck Hole
    # Create a cutter at the neck position
    log("Cutting Neck...")
    neck_cutter_radius = torso_radius * 0.5
    neck_cutter = create_aligned_cylinder(
        neck_head - mathutils.Vector((0,0,0.1)), 
        neck_head + mathutils.Vector((0,0,0.3)), 
        neck_cutter_radius, 
        "Neck_Cutter"
    )
    
    mod_cut = sweater.modifiers.new(name="NeckCut", type='BOOLEAN')
    mod_cut.object = neck_cutter
    mod_cut.operation = 'DIFFERENCE'
    bpy.ops.object.modifier_apply(modifier="NeckCut")
    bpy.data.objects.remove(neck_cutter, do_unlink=True)
    
    # 8. Shrinkwrap to Body (Loose Fit)
    # This pulls the "Baymax" shape back towards the human form slightly
    log("Shrinkwrapping...")
    mod_wrap = sweater.modifiers.new(name="Fit", type='SHRINKWRAP')
    mod_wrap.target = target_mesh
    mod_wrap.wrap_method = 'NEAREST_SURFACEPOINT'
    mod_wrap.wrap_mode = 'OUTSIDE_SURFACE'
    mod_wrap.offset = 0.03 # 3cm gap (Thick sweater)
    # We apply it on a Vertex Group? No, whole body.
    # But sleeves might collapse if arm is far.
    # So we use a vertex group for the torso only? Or just apply gently.
    # Actually, the 'Project' mode is risky. 'Nearest Surface Point' is safe.
    bpy.ops.object.modifier_apply(modifier="Fit")
    
    # 9. Final Polish
    # Subsurf
    mod_sub = sweater.modifiers.new(name="Subsurf", type='SUBSURF')
    mod_sub.levels = 1
    
    # Solidify (Thickness)
    mod_solid = sweater.modifiers.new(name="Thickness", type='SOLIDIFY')
    mod_solid.thickness = 0.01
    mod_solid.offset = 1.0
    
    # 10. UV Unwrap
    log("UV Unwrapping...")
    bpy.context.view_layer.objects.active = sweater
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # Smart UV Project for "Pixel level decal" coverage
    bpy.ops.uv.smart_project(island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Material
    mat = bpy.data.materials.new(name="Sweater_White")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.95, 0.95, 0.95, 1.0)
    sweater.data.materials.append(mat)
    
    # 11. Export
    log(f"Exporting to {SWEATER_EXPORT_PATH}...")
    
    # Select only sweater
    bpy.ops.object.select_all(action='DESELECT')
    sweater.select_set(True)
    
    bpy.ops.export_scene.gltf(
        filepath=SWEATER_EXPORT_PATH,
        export_format='GLB',
        use_selection=True,
        export_apply=True  # Apply modifiers
    )
    
    # Export Body
    target_mesh.select_set(True)
    sweater.select_set(False)
    bpy.ops.export_scene.gltf(
        filepath=BODY_EXPORT_PATH,
        export_format='GLB',
        use_selection=True
    )
    
    return {"status": "success", "message": "Sweater created"}

try:
    result = run()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
    traceback.print_exc()
"""

def send_script_to_blender(script_content):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((HOST, PORT))
            s.sendall(script_content.encode('utf-8'))
            
            # Wait for response
            s.settimeout(300) # 5 minutes timeout for heavy processing
            data = s.recv(4096)
            response = json.loads(data.decode('utf-8'))
            return response
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}

if __name__ == "__main__":
    print("Connecting to Blender...")
    resp = send_script_to_blender(BLENDER_SCRIPT)
    print(f"Result: {resp}")
