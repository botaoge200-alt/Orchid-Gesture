import bpy
import json

def get_vertex_groups():
    # Find the body mesh
    body = None
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            # Prioritize selected or likely names
            if 'woman' in obj.name.lower() or 'body' in obj.name.lower():
                body = obj
                break
    
    if not body:
        return {"status": "error", "message": "No body mesh found"}

    # List groups
    vgroups = [g.name for g in body.vertex_groups]
    
    return {
        "status": "success", 
        "body_name": body.name,
        "vertex_groups": vgroups
    }

# Execute and print
try:
    result = get_vertex_groups()
    print("Blender Result: " + json.dumps(result))
except Exception as e:
    print("Blender Result: " + json.dumps({"status": "error", "message": str(e)}))
