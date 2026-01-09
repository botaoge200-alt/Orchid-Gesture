import os
import sys
import runpy

# Force the port to 5001 before loading the module
os.environ["BLENDER_PORT"] = "5001"

print(f"Starting Blender MCP server on port {os.environ['BLENDER_PORT']}...")

# We can run the module directly
# This is equivalent to 'python -m blender_mcp' but with the env var set
try:
    runpy.run_module("blender_mcp", run_name="__main__")
except Exception as e:
    print(f"Error running blender_mcp: {e}")
    sys.exit(1)
