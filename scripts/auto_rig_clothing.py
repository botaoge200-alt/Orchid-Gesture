import socket
import json
import textwrap

HOST = '127.0.0.1'
PORT = 9876

def auto_rig():
    print("Attempting to Auto-Rig shirt to Armature...")
    
    blender_script = textwrap.dedent("""
    import bpy

    shirt_name = "Generated_Blue_Shirt.001"
    shirt = bpy.data.objects.get(shirt_name)
    
    # Find Armature
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break
            
    if not shirt:
        print("Error: Shirt not found.")
    elif not armature:
        print("Error: No Armature found in scene. Please import a human model first.")
    else:
        print(f"Parenting {{shirt.name}} to {{armature.name}}...")
        
        # Deselect all
        bpy.ops.object.select_all(action='DESELECT')
        
        # Select Shirt then Armature
        shirt.select_set(True)
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature
        
        # Parent with Automatic Weights
        try:
            bpy.ops.object.parent_set(type='ARMATURE_AUTO')
            print("Success: Shirt parented with Automatic Weights.")
        except Exception as e:
            print(f"Parenting failed: {{e}}")
            
        # Optional: Data Transfer for better quality (if body mesh exists)
        # We look for a mesh that is a child of the armature and likely the body
        body_mesh = None
        for child in armature.children:
            if child.type == 'MESH' and child != shirt:
                body_mesh = child
                break
        
        if body_mesh:
            print(f"Found body mesh {{body_mesh.name}}. Adding Data Transfer...")
            mod = shirt.modifiers.new(name="DataTransfer", type='DATA_TRANSFER')
            mod.object = body_mesh
            mod.use_loop_data_custom_normal = True
            mod.use_vert_data_vertex_group = True
            mod.data_types_loops = {'CUSTOM_NORMAL'}
            mod.data_types_verts = {'VGROUP_WEIGHTS'}
            
            # Apply the transfer
            bpy.context.view_layer.objects.active = shirt
            bpy.ops.object.datalayout_transfer(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            print("Data Transfer applied.")
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
    auto_rig()
