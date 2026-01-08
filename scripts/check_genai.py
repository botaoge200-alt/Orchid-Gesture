import socket
import json
import time

def check_genai_status(port=9876):
    print(f"Connecting to Blender on port {port}...")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        s.connect(('127.0.0.1', port))
        
        # Check Hyper3D Rodin
        print("Checking Hyper3D Rodin status...")
        s.sendall(json.dumps({"type": "get_hyper3d_status"}).encode('utf-8'))
        data = s.recv(4096)
        print(f"Rodin Response: {data.decode('utf-8')}")
        
        # Reconnect for next request (simple implementation often closes socket or expects one req)
        # But server.py uses a loop, so we might be able to reuse. Let's try reusing.
        
        # Check Hunyuan3D
        print("\nChecking Hunyuan3D status...")
        s.sendall(json.dumps({"type": "get_hunyuan3d_status"}).encode('utf-8'))
        data = s.recv(4096)
        print(f"Hunyuan Response: {data.decode('utf-8')}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        s.close()

if __name__ == "__main__":
    check_genai_status(9876)
