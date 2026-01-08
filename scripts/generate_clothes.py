import socket
import json
import time
import base64
import os
import sys
from pathlib import Path

HOST = '127.0.0.1'
PORT = 9876

def generate_from_image(image_path, model_name):
    print(f"--- Starting Generation for {model_name} from {image_path} ---")
    
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} not found.")
        return

    # 1. Prepare Image Data (Base64)
    suffix = Path(image_path).suffix
    with open(image_path, "rb") as f:
        img_data = base64.b64encode(f.read()).decode("ascii")
    
    # Rodin expects a list of images. Each image is [suffix, base64_data]
    images_payload = [[suffix, img_data]]

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(300) # Long timeout for initial upload
        s.connect((HOST, PORT))
        
        # 2. Submit Job
        print("Submitting job to Hyper3D Rodin...")
        payload = {
            "type": "create_rodin_job",
            "params": {
                "text_prompt": None,
                "images": images_payload,
                "bbox_condition": None
            }
        }
        s.sendall(json.dumps(payload).encode('utf-8'))
        
        resp_data = s.recv(16384)
        response = json.loads(resp_data.decode('utf-8'))
        
        if response.get("status") == "error":
            print(f"Submission Error: {response.get('message')}")
            return

        result = response.get("result", {})
        task_uuid = result.get("uuid")
        subscription_key = result.get("jobs", {}).get("subscription_key")
        
        if not task_uuid:
            print(f"Failed to get task UUID. Response: {result}")
            return
            
        print(f"Job Submitted! UUID: {task_uuid}")
        
        # 3. Poll Status
        print("Polling for completion (this may take a few minutes)...")
        status = "processing"
        
        while status not in ["Done", "Failed", "Succeed", "COMPLETED"]: # Cover various API responses
            time.sleep(5) 
            
            # Reconnect for polling
            s_poll = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s_poll.settimeout(10)
            s_poll.connect((HOST, PORT))
            
            poll_payload = {
                "type": "poll_rodin_job_status",
                "params": {
                    "subscription_key": subscription_key
                }
            }
            s_poll.sendall(json.dumps(poll_payload).encode('utf-8'))
            poll_resp = s_poll.recv(4096)
            s_poll.close()
            
            poll_result = json.loads(poll_resp.decode('utf-8'))
            # Rodin MAIN_SITE returns a list of statuses, one for each sub-task? 
            # Or just a status string?
            # server.py says: "Returns a list of status. The task is done if all status are 'Done'."
            
            res_data = poll_result.get("result", [])
            # It might be a list like ["Done", "processing"] or just ["processing"]
            
            print(f"Status: {res_data}", end="\r")
            
            if isinstance(res_data, list):
                if all(st == "Done" for st in res_data):
                    status = "Done"
                elif any(st == "Failed" for st in res_data):
                    status = "Failed"
            else:
                # Fallback if structure is different
                if res_data == "Done": status = "Done"
        
        print(f"\nFinal Status: {status}")
        
        if status == "Done":
            # 4. Import Asset
            print(f"Importing asset as '{model_name}'...")
            s_import = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s_import.connect((HOST, PORT))
            
            import_payload = {
                "type": "import_generated_asset",
                "params": {
                    "name": model_name,
                    "task_uuid": task_uuid
                }
            }
            s_import.sendall(json.dumps(import_payload).encode('utf-8'))
            import_resp = s_import.recv(4096)
            s_import.close()
            
            print(f"Import Result: {import_resp.decode('utf-8')}")
        else:
            print("Generation Failed.")

    except Exception as e:
        print(f"\nException: {e}")
    finally:
        s.close()

if __name__ == "__main__":
    # Process both images
    # Image 1
    generate_from_image(r"E:\Orchid Gesture\tupian\23456.jpg", "Generated_Cloth_1")
    print("\n" + "="*30 + "\n")
    # Image 2
    generate_from_image(r"E:\Orchid Gesture\tupian\56789.jpg", "Generated_Cloth_2")
