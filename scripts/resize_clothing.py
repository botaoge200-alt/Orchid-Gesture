import bpy
import os
import mathutils

# 配置
INPUT_FILE = "Blue_Outdoor_Shirt.glb"
OUTPUT_FILE = "Blue_Outdoor_Shirt_Resized.glb"
MODELS_DIR = os.path.abspath("e:/Orchid Gesture/client/public/models")

# 目标参数
SCALE_FACTOR = 0.32
OFFSET_X = -0.382
OFFSET_Z = 1.086
TARGET_SHOULDER_Z = 1.45

def run():
    # 清除场景
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    in_path = os.path.join(MODELS_DIR, INPUT_FILE)
    out_path = os.path.join(MODELS_DIR, OUTPUT_FILE)
    
    if not os.path.exists(in_path):
        print(f"Error: Input file not found: {in_path}")
        return

    print(f"Importing {in_path}...")
    bpy.ops.import_scene.gltf(filepath=in_path)
    
    # 获取主要 Mesh 对象
    target_obj = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            target_obj = obj
            break
            
    if not target_obj:
        print("Error: No mesh object found in GLB")
        return

    print(f"Processing object: {target_obj.name}")
    
    # 1. 居中 X (根据之前的 BBox 分析)
    # 之前分析 X range: [-1.9172, 2.6819], center = 0.38235
    # 所以要移动 -0.38235
    print(f"Translating X by {OFFSET_X}")
    target_obj.location.x += OFFSET_X
    
    # 2. 应用变换 (把位移烘焙进网格，重置原点)
    bpy.ops.object.select_all(action='DESELECT')
    target_obj.select_set(True)
    bpy.context.view_layer.objects.active = target_obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    # 3. 缩放
    print(f"Scaling by {SCALE_FACTOR}")
    target_obj.scale = (SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR)
    bpy.ops.object.transform_apply(scale=True)
    
    # 4. 调整 Z 高度
    # 获取当前的 Z Max
    bbox = [target_obj.matrix_world @ mathutils.Vector(corner) for corner in target_obj.bound_box]
    current_max_z = max(v.z for v in bbox)
    print(f"Current Max Z: {current_max_z}")
    
    z_translation = TARGET_SHOULDER_Z - current_max_z
    print(f"Translating Z by {z_translation} to reach {TARGET_SHOULDER_Z}")
    target_obj.location.z += z_translation
    
    # 5. 应用最终变换
    bpy.ops.object.transform_apply(location=True)
    
    # 6. 导出
    print(f"Exporting to {out_path}...")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True)
    print("Done.")

if __name__ == "__main__":
    run()
