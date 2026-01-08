import socket
import json
import textwrap
import os

HOST = '127.0.0.1'
PORT = 9876
EXPORT_PATH = os.path.abspath("models/Blue_Outdoor_Shirt.glb").replace("\\", "/")

def export_shirt():
    print(f"Exporting model to: {EXPORT_PATH}")
    
    blender_script = textwrap.dedent(f"""
    import bpy
    
    # 1. Select the shirt
    obj_name = "Generated_Blue_Shirt.001"
    obj = bpy.data.objects.get(obj_name)
    
    if not obj:
        print("Error: Shirt object not found")
    else:
        # Deselect all
        bpy.ops.object.select_all(action='DESELECT')
        
        # Select Shirt
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        
        # Export
        # We use 'export_apply=True' to bake the Lattice deformation into the mesh
        # NOTE: This might remove Shape Keys if they exist. 
        # If preserving Shape Keys is prioritized over Lattice, set export_apply=False.
        
        print(f"Exporting to {{'{EXPORT_PATH}'}}...")
        bpy.ops.export_scene.gltf(
            filepath='{EXPORT_PATH}',
            check_existing=False,
            use_selection=True,
            export_format='GLB',
            export_apply=True  # Bake modifiers (Subsurf, Lattice)
        )
        print("Export successful!")
    """)
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(30)
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
    export_shirt()
