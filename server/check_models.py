from comfy_client import ComfyUIClient
import json

try:
    client = ComfyUIClient()
    info = client.get_object_info()
    
    # CheckpointLoaderSimple 节点的 widgets_values 包含模型列表
    checkpoints = info['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0]
    print("Available Checkpoints:", checkpoints)
    
except Exception as e:
    print("Error connecting to ComfyUI:", e)
