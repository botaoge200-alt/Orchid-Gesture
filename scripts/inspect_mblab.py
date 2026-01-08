import bpy

print("--------------- MB-LAB OPERATOR SEARCH ---------------")
# Check for likely categories
categories = [attr for attr in dir(bpy.ops) if not attr.startswith("__")]
print(f"Operator Categories: {categories}")

# Specifically look for mblab
if hasattr(bpy.ops, 'mblab'):
    print("\n[bpy.ops.mblab] available operators:")
    print(dir(bpy.ops.mblab))
elif hasattr(bpy.ops, 'mb_lab'):
    print("\n[bpy.ops.mb_lab] available operators:")
    print(dir(bpy.ops.mb_lab))
else:
    print("\nCould not find 'mblab' or 'mb_lab' in bpy.ops. Searching all...")
    for cat in categories:
        try:
            ops = dir(getattr(bpy.ops, cat))
            for op in ops:
                if 'mb' in op or 'lab' in op:
                    print(f"Found potential match: bpy.ops.{cat}.{op}")
        except:
            pass
print("------------------------------------------------------")
