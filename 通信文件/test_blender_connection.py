import socket
import json
import time

def create_orange_monkey(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('127.0.0.1', port))
        print(f"Connected to port {port}")

        # Python code to execute in Blender
        blender_code = """
import bpy

# Delete existing objects to clear the view (optional, but good for testing)
# bpy.ops.object.select_all(action='SELECT')
# bpy.ops.object.delete()

# Create Monkey
bpy.ops.mesh.primitive_monkey_add(size=2, location=(0, 0, 2))
obj = bpy.context.active_object
obj.name = "OrangeMonkey"

# Create Orange Material
mat_name = "OrangeMat"
if mat_name in bpy.data.materials:
    mat = bpy.data.materials[mat_name]
else:
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (1.0, 0.5, 0.0, 1.0) # Orange

# Assign Material
if obj.data.materials:
    obj.data.materials[0] = mat
else:
    obj.data.materials.append(mat)

# Smooth shade
bpy.ops.object.shade_smooth()
"""

        # Construct payload for 'execute_code' command
        # This matches what server.py sends to the addon
        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_code
            }
        }

        print("Sending payload to create Orange Monkey...")
        s.sendall(json.dumps(payload).encode('utf-8'))

        # Receive response
        data = s.recv(4096)
        response = json.loads(data.decode('utf-8'))
        print(f"Response from Blender: {json.dumps(response, indent=2)}")
        
        if response.get("status") == "success":
            print("\nSUCCESS: Orange Monkey command executed successfully!")
            return True
        else:
            print("\nFAILURE: Blender reported an error.")
            return False

    except ConnectionRefusedError:
        print(f"\nERROR: Connection refused on port {port}. Make sure Blender is running and the MCP addon is enabled.")
        return False
    except Exception as e:
        print(f"\nERROR: {e}")
        return False
    finally:
        s.close()

if __name__ == "__main__":
    create_orange_monkey(9876)
