import bpy
import os
import mathutils

# 清除场景
bpy.ops.wm.read_factory_settings(use_empty=True)

models_dir = os.path.abspath("e:/Orchid Gesture/client/public/models")
files = ["MBLab_Female.glb", "Blue_Outdoor_Shirt.glb"]

print("-" * 50)
for f in files:
    path = os.path.join(models_dir, f)
    if not os.path.exists(path):
        print(f"File not found: {path}")
        continue
        
    # 导入 GLB
    bpy.ops.import_scene.gltf(filepath=path)
    
    # 获取选中的对象（通常是导入的对象）
    # GLTF 导入后通常会选中根对象或所有对象
    # 我们计算所有选中对象的整体边界框
    
    min_v = [float('inf')] * 3
    max_v = [float('-inf')] * 3
    
    found_obj = False
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            found_obj = True
            # 应用变换以获取世界坐标下的尺寸
            # 注意：GLTF 导入后可能有层级，这里简化处理，直接看 dimensions
            # 更准确的是遍历所有顶点的世界坐标，但直接读 dimensions 通常够用
            dims = obj.dimensions
            print(f"Object: {obj.name}, Dimensions: {dims}")
            
            # 获取边界框的世界坐标
            bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
            min_x = min(v.x for v in bbox)
            max_x = max(v.x for v in bbox)
            min_z = min(v.z for v in bbox)
            max_z = max(v.z for v in bbox)
            
            print(f"  BBox X: [{min_x:.4f}, {max_x:.4f}]")
            print(f"  BBox Z: [{min_z:.4f}, {max_z:.4f}]")


    print(f"Finished checking {f}")
    
    # 清除场景以便下一个文件
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    print("-" * 50)
