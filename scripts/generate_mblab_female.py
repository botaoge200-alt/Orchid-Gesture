import bpy
import os

# Settings
OUTPUT_DIR = os.path.join(os.getcwd(), "client", "public", "models")
EXPORT_PATH = os.path.join(OUTPUT_DIR, "MBLab_Female.glb")
BLEND_PATH = os.path.join(os.getcwd(), "temp_mblab.blend")

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Save current blend file to allow relative paths for textures
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

print("Initializing MB-Lab Character...")
# Set Character Type: Caucasian Female
bpy.context.scene.mblab_character_name = 'f_ca01' 
bpy.context.scene.mblab_use_lamps = False
bpy.context.scene.mblab_use_cycles = True # Use Cycles for baking if needed, though Eevee is faster
# bpy.context.scene.mblab_use_eevee = True

try:
    bpy.ops.mbast.init_character()
    print("Character Initialized.")
    
    # Print objects
    print("Objects after init:", [o.name for o in bpy.context.scene.objects])

except Exception as e:
    print(f"Error initializing character: {e}")
    exit(1)

# Finalize Character (Bake textures, apply rigging)
# print("Finalizing Character...")
# try:
#     # Finalize requires saving images.
#     bpy.ops.mbast.finalize_character()
#     print("Character Finalized.")
# except Exception as e:
#     print(f"Error finalizing character: {e}")
#     # Continue anyway, maybe it's partially done

# Select the character object
# MB-Lab usually names the object based on the type, e.g., "MBLab_skin" or "Human_Female"
# Let's find the mesh object.
mesh_obj = None
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH' and 'MBLab' in obj.name: # Guessing name
        mesh_obj = obj
        break
    if obj.type == 'MESH' and 'Skin' in obj.name:
        mesh_obj = obj

if not mesh_obj:
    # Fallback: select the active object if it's a mesh
    if bpy.context.active_object and bpy.context.active_object.type == 'MESH':
        mesh_obj = bpy.context.active_object

if mesh_obj:
    print(f"Exporting object: {mesh_obj.name}")
    # Select only the mesh and armature
    bpy.ops.object.select_all(action='DESELECT')
    mesh_obj.select_set(True)
    if mesh_obj.parent:
        mesh_obj.parent.select_set(True) # Select armature

    # Export
    print(f"Exporting to {EXPORT_PATH}...")
    bpy.ops.export_scene.gltf(
        filepath=EXPORT_PATH,
        check_existing=False,
        use_selection=True,
        export_format='GLB',
        export_apply=True  # Apply modifiers
    )
    print("Export successful!")
else:
    print("Could not find character mesh to export.")
    # Print all objects for debugging
    print("Objects in scene:", [o.name for o in bpy.context.scene.objects])
