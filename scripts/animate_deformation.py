import socket
import json
import time

def animate_deformation(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('127.0.0.1', port))
        print(f"Connected to port {port}")

        # Python code to execute in Blender
        # This will add keyframes to animate the shape keys
        blender_code = """
import bpy

# Find our object
obj = bpy.data.objects.get("DeformableCloth_Demo")

if obj and obj.data.shape_keys:
    key_blocks = obj.data.shape_keys.key_blocks
    
    # Ensure we are in object mode
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
        
    # Reset all keys
    key_blocks["Big_Size"].value = 0
    key_blocks["Small_Size"].value = 0
    key_blocks["Belly_Expand"].value = 0
    
    # Frame 1: Normal (Start)
    bpy.context.scene.frame_set(1)
    key_blocks["Big_Size"].keyframe_insert(data_path="value", frame=1)
    key_blocks["Small_Size"].keyframe_insert(data_path="value", frame=1)
    
    # Frame 30: Big (Grow)
    bpy.context.scene.frame_set(30)
    key_blocks["Big_Size"].value = 1.0
    key_blocks["Big_Size"].keyframe_insert(data_path="value", frame=30)
    
    # Frame 60: Back to Normal
    bpy.context.scene.frame_set(60)
    key_blocks["Big_Size"].value = 0.0
    key_blocks["Big_Size"].keyframe_insert(data_path="value", frame=60)
    
    # Frame 90: Small (Shrink)
    bpy.context.scene.frame_set(90)
    key_blocks["Small_Size"].value = 1.0
    key_blocks["Small_Size"].keyframe_insert(data_path="value", frame=90)
    
    # Frame 120: Back to Normal
    bpy.context.scene.frame_set(120)
    key_blocks["Small_Size"].value = 0.0
    key_blocks["Small_Size"].keyframe_insert(data_path="value", frame=120)
    
    # Frame 150: Belly Expand
    bpy.context.scene.frame_set(150)
    key_blocks["Belly_Expand"].value = 1.0
    key_blocks["Belly_Expand"].keyframe_insert(data_path="value", frame=150)
    
    # Frame 180: Normal
    bpy.context.scene.frame_set(180)
    key_blocks["Belly_Expand"].value = 0.0
    key_blocks["Belly_Expand"].keyframe_insert(data_path="value", frame=180)

    # Set animation range
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 200
    
    # Start Playback
    bpy.ops.screen.animation_play()
    
    print("Animation created and started!")
else:
    print("Object 'DeformableCloth_Demo' not found!")
"""

        payload = {
            "type": "execute_code",
            "params": {
                "code": blender_code
            }
        }

        print("Sending Animation payload...")
        s.sendall(json.dumps(payload).encode('utf-8'))

        # Receive response
        data = s.recv(4096)
        response = json.loads(data.decode('utf-8'))
        print(f"Response from Blender: {json.dumps(response, indent=2)}")
        
        if response.get("status") == "success":
            print("\nSUCCESS: Animation started in Blender!")
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
    animate_deformation(9876)
