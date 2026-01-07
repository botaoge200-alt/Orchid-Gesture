import struct
import json
import os

def parse_glb_names(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'rb') as f:
        # Header: magic(4), version(4), length(4)
        magic, version, length = struct.unpack('<III', f.read(12))
        if magic != 0x46546C67: # 'glTF'
            print("Not a valid GLB file")
            return

        # Chunk 0: JSON
        chunk_length, chunk_type = struct.unpack('<II', f.read(8))
        if chunk_type != 0x4E4F534A: # 'JSON'
            print("First chunk is not JSON")
            return
        
        json_data = f.read(chunk_length)
        gltf = json.loads(json_data)
        
        print("--- Meshes/Nodes in GLB ---")
        if 'nodes' in gltf:
            for i, node in enumerate(gltf['nodes']):
                if 'mesh' in node:
                    name = node.get('name', f"Node_{i}")
                    print(f"Node: {name}")
        else:
            print("No nodes found.")

parse_glb_names(r"E:\Orchid Gesture\client\public\models\plmxs.glb")
