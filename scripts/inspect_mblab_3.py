import bpy

print("--------------- MB-LAB PROPERTIES INSPECTION ---------------")

# Inspect Scene properties
print("\n[Scene Properties starting with 'mb']:")
for prop in dir(bpy.context.scene):
    if prop.startswith('mb'):
        print(f"  - {prop}")
        try:
            val = getattr(bpy.context.scene, prop)
            print(f"    Value: {val}")
        except:
            pass

# Try to find character types enum
# Usually it's in a property group or just a list
# Let's try to instantiate a character with a dummy type to provoke an error message listing valid types
print("\n[Attempting init_character with dummy type]")
try:
    bpy.ops.mbast.init_character(type='DUMMY_TYPE')
except Exception as e:
    print(f"Error caught (expected): {e}")

print("------------------------------------------------------------")
