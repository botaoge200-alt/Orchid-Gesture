import socket
import json
import base64
import time

HOST = '127.0.0.1'
PORT = 9876

def test_tiny_image():
    # A tiny 1x1 red PNG
    # Hex: 89 50 4E 47 ...
    # This is a valid base64 of a 1x1 red pixel PNG
    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    
    print("Testing with 1x1 PNG (Multiple variants)...")
    
    variants = [
        ("No dot", [["png", tiny_png_b64]]),
        ("Mime", [["image/png", tiny_png_b64]]),
        ("Dot + Raw", [[".png", tiny_png_b64]]),
        ("Dot + Prefix", [[".png", "data:image/png;base64," + tiny_png_b64]])
    ]
    
    for name, images_payload in variants:
        print(f"--- Trying {name} ---")
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect((HOST, PORT))
            
            payload = {
                "type": "create_rodin_job",
                "params": {
                    "text_prompt": None,
                    "images": images_payload,
                    "bbox_condition": None
                }
            }
            s.sendall(json.dumps(payload).encode('utf-8'))
            
            resp = s.recv(4096)
            print(f"Response: {resp.decode('utf-8')}")
            s.close()
            time.sleep(1)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_tiny_image()
