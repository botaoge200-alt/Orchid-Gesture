import socket
import json
import textwrap

HOST = '127.0.0.1'
PORT = 9876

def check_modifiers():
    print("Checking modifiers...")
    
    blender_script = textwrap.dedent("""
    import bpy
    
    obj_name = "Generated_Blue_Shirt.001"
    obj = bpy.data.objects.get(obj_name)
    
    if obj:
        print(f"Object: {obj.name}")
        print(f"Modifiers: {[m.name + ' (' + m.type + ')' for m in obj.modifiers]}")
        if obj.data.shape_keys:
            print(f"Shape Keys: {[kb.name for kb in obj.data.shape_keys.key_blocks]}")
        else:
            print("No Shape Keys.")
    else:
        print("Object not found.")
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
    check_modifiers()
