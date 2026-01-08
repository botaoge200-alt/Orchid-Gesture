import json
import struct
import os

def inspect_glb(file_path):
    print(f"Inspecting: {file_path}")
    if not os.path.exists(file_path):
        print("File not found.")
        return

    with open(file_path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            print("Not a valid binary glTF file.")
            return
        
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        
        print(f"glTF Version: {version}")
        
        # Read chunks
        while f.tell() < length:
            chunk_length = struct.unpack('<I', f.read(4))[0]
            chunk_type = f.read(4)
            
            if chunk_type == b'JSON':
                json_data = f.read(chunk_length)
                data = json.loads(json_data)
                
                # Inspect meshes for morph targets
                if 'meshes' in data:
                    print(f"Found {len(data['meshes'])} meshes.")
                    for i, mesh in enumerate(data['meshes']):
                        print(f"Mesh {i}: {mesh.get('name', 'Unnamed')}")
                        if 'primitives' in mesh:
                            for prim in mesh['primitives']:
                                if 'targets' in prim:
                                    print(f"  - Has {len(prim['targets'])} Morph Targets")
                                    # Try to find target names in extras or mesh weights
                                    if 'weights' in mesh:
                                        print(f"  - Default Weights: {mesh['weights']}")
                                    
                                    # Names are usually in mesh.extras.targetNames or just implied
                                    if 'extras' in mesh and 'targetNames' in mesh['extras']:
                                        print(f"  - Target Names: {mesh['extras']['targetNames']}")
                                else:
                                    print("  - No Morph Targets found.")
                else:
                    print("No meshes found.")
                    
                break
            else:
                f.seek(chunk_length, 1)

import sys

if __name__ == "__main__":
    path = "models/Blue_Outdoor_Shirt.glb"
    if len(sys.argv) > 1:
        path = sys.argv[1]
    inspect_glb(path)
