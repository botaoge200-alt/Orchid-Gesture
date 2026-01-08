import socket
import json
import time

def create_tshirt(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect(('127.0.0.1', port))
        print(f"Connected to port {port}")

        blender_code = """
import bpy
import math

# 1. Clear Scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Create Torso (Main Body)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
torso = bpy.context.active_object
torso.name = "TShirt_Torso"
torso.scale = (0.6, 0.3, 1.0) # Width, Depth, Height
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# 3. Create Left Sleeve
bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.5, 0, 0.3))
sleeve_l = bpy.context.active_object
sleeve_l.name = "Sleeve_L"
sleeve_l.scale = (0.4, 0.25, 0.4)
sleeve_l.rotation_euler = (0, 0, 0.2) # Slight angle
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# 4. Create Right Sleeve
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.5, 0, 0.3))
sleeve_r = bpy.context.active_object
sleeve_r.name = "Sleeve_R"
sleeve_r.scale = (0.4, 0.25, 0.4)
sleeve_r.rotation_euler = (0, 0, -0.2)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# 5. Join them into one object
# Modern Blender approach: Ensure selection is correct, then call join()
bpy.ops.object.select_all(action='DESELECT')
torso.select_set(True)
sleeve_l.select_set(True)
sleeve_r.select_set(True)
bpy.context.view_layer.objects.active = torso
bpy.ops.object.join()

# 6. Remesh to make it a single continuous skin
# (This is important so it deforms like fabric, not separate boxes)
bpy.ops.object.modifier_add(type='REMESH')
# Get the last added modifier (safest way)
mod = torso.modifiers[-1]
mod.mode = 'VOXEL'
mod.voxel_size = 0.05
bpy.ops.object.modifier_apply(modifier=mod.name)

# Smooth it out
bpy.ops.object.shade_smooth()
torso.name = "Procedural_TShirt"

# 7. Add Material
mat = bpy.data.materials.new(name="TShirt_Fabric")
mat.use_nodes = True
# Safe node finding
bsdf = None
for node in mat.node_tree.nodes:
    if node.type == 'BSDF_PRINCIPLED':
        bsdf = node
        break
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1.0) # White/Grey
    bsdf.inputs["Roughness"].default_value = 0.9 # Fabric is rough
torso.data.materials.append(mat)

# 8. Add Shape Keys (Deformation Logic)
basis = torso.shape_key_add(name="Basis")

# KEY 1: FAT / WIDE
key_fat = torso.shape_key_add(name="Size_Wide")
for point in key_fat.data:
    # Expand horizontally (X) and depth (Y)
    point.co.x *= 1.4
    point.co.y *= 1.4

# KEY 2: LONG
key_long = torso.shape_key_add(name="Size_Long")
for point in key_long.data:
    # Stretch vertically (Z)
    point.co.z *= 1.3

# KEY 3: BELLY (Local deformation)
key_belly = torso.shape_key_add(name="Belly_Pot")
for point in key_belly.data:
    x, y, z = point.co
    # If point is in front (y < 0) and lower-middle (-0.5 < z < 0)
    if y < -0.1 and -0.5 < z < 0.2:
        dist = 1.0 - abs(x) # More effect in center
        if dist > 0:
            point.co.y -= 0.3 * dist # Push out forward

# 9. Animate for demonstration
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 150

# Reset
key_fat.value = 0
key_long.value = 0
key_belly.value = 0

# Animate Wide
key_fat.keyframe_insert(data_path="value", frame=1)
key_fat.value = 1.0
key_fat.keyframe_insert(data_path="value", frame=40)
key_fat.value = 0.0
key_fat.keyframe_insert(data_path="value", frame=80)

# Animate Long (Overlap)
key_long.keyframe_insert(data_path="value", frame=60)
key_long.value = 1.0
key_long.keyframe_insert(data_path="value", frame=100)
key_long.value = 0.0
key_long.keyframe_insert(data_path="value", frame=140)

bpy.ops.screen.animation_play()
"""

        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_code
            }
        }

        print("Sending T-Shirt Generation payload...")
        s.sendall(json.dumps(payload).encode('utf-8'))

        data = s.recv(4096)
        response = json.loads(data.decode('utf-8'))
        
        if response.get("status") == "success":
            print("\nSUCCESS: Generated Deformable T-Shirt in Blender!")
        else:
            print(f"\nFAILURE: {response}")

    except Exception as e:
        print(f"\nERROR: {e}")
    finally:
        s.close()

if __name__ == "__main__":
    create_tshirt(9876)
