import socket
import json
import time

def demo_shape_keys(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('127.0.0.1', port))
        print(f"Connected to port {port}")

        # Python code to execute in Blender
        # This demonstrates the "Algorithmic Deformation" workflow
        blender_code = """
import bpy
import random

# 1. Clear Scene for a fresh start
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Create a base object (representing our "Standard Clothing")
# Using a Sphere as a proxy for now
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0,0,1))
obj = bpy.context.active_object
obj.name = "DeformableCloth_Demo"
bpy.ops.object.shade_smooth()

# Create a simple material
mat = bpy.data.materials.new(name="ClothMat")
mat.use_nodes = True
# Find the Principled BSDF node safely
bsdf = None
for node in mat.node_tree.nodes:
    if node.type == 'BSDF_PRINCIPLED':
        bsdf = node
        break

if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.2, 0.6, 1.0, 1.0) # Blue
else:
    # If not found for some reason, just skip color assignment
    pass

obj.data.materials.append(mat)

# 3. Add 'Basis' Shape Key (The original shape)
# Shape keys store different positions for the same vertices
basis_key = obj.shape_key_add(name="Basis")
basis_key.interpolation = 'KEY_LINEAR'

# 4. Create 'Fat/Big' Variation
# We create a new key, which starts as a copy of the Basis
big_key = obj.shape_key_add(name="Big_Size")

# Now we modify the vertices of this specific key
# In a real scenario, we might select vertices near the belly/chest and push them out
for i, point in enumerate(big_key.data):
    # Simple algorithm: Scale everything up by 1.5x
    # Real implementation would be more targeted (e.g. only waist width)
    point.co = point.co * 1.5

# 5. Create 'Thin/Small' Variation
small_key = obj.shape_key_add(name="Small_Size")
for i, point in enumerate(small_key.data):
    # Scale down by 0.7x
    point.co = point.co * 0.7

# 6. Add a "Belly" specific morph (to show targeted deformation)
belly_key = obj.shape_key_add(name="Belly_Expand")
for i, point in enumerate(belly_key.data):
    # Only move points that are in the front (y < 0) and middle height (z approx 1.0)
    # Sphere center is at (0,0,1), radius 1. So z range is 0 to 2.
    # Front is -Y.
    x, y, z = point.co
    if y < -0.5 and 0.5 < z < 1.5:
        # Push out forward (-y direction)
        point.co.y -= 0.5 

# 7. Set current state to show it works
# Let's set it to "Big" by default so the user sees a change immediately
obj.data.shape_keys.key_blocks["Big_Size"].value = 0.5

print("Created Deformable Demo Object with 3 Shape Keys")
"""

        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_code
            }
        }

        print("Sending Shape Key Demo payload...")
        s.sendall(json.dumps(payload).encode('utf-8'))

        # Receive response
        data = s.recv(4096)
        response = json.loads(data.decode('utf-8'))
        print(f"Response from Blender: {json.dumps(response, indent=2)}")
        
        if response.get("status") == "success":
            print("\nSUCCESS: Deformable object created with Shape Keys!")
            print("Go to Blender -> Object Data Properties (Green Triangle) -> Shape Keys to play with the sliders.")
            return True
        else:
            print("\nFAILURE: Blender reported an error.")
            return False

    except Exception as e:
        print(f"\nERROR: {e}")
        return False
    finally:
        s.close()

if __name__ == "__main__":
    demo_shape_keys(9876)
