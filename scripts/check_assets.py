import socket
import json
import time

def check_polyhaven(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(10)
        s.connect(('127.0.0.1', port))
        
        # 1. First ensure PolyHaven is enabled/checked
        # The server.py code implies we might need to enable it, but let's try listing categories directly.
        # It says "PolyHaven integration is disabled. Select it in the sidebar..."
        # We can try to force enable it or just check if it works.
        
        payload = {
            "type": "get_polyhaven_categories",
            "params": {
                "asset_type": "models"
            }
        }
        
        s.sendall(json.dumps(payload).encode('utf-8'))
        data = s.recv(16384) # Larger buffer for list
        response = json.loads(data.decode('utf-8'))
        
        print(f"Response: {json.dumps(response, indent=2)}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        s.close()

if __name__ == "__main__":
    check_polyhaven(9876)
