import bpy

print("--------------- MB-LAB OPERATOR INSPECTION ---------------")

if hasattr(bpy.ops, 'mbast'):
    print("\n[bpy.ops.mbast] available operators:")
    print(dir(bpy.ops.mbast))

if hasattr(bpy.ops, 'mbcrea'):
    print("\n[bpy.ops.mbcrea] available operators:")
    print(dir(bpy.ops.mbcrea))

print("----------------------------------------------------------")
