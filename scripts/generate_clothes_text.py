import socket
import json
import time

HOST = '127.0.0.1'
PORT = 9876

def generate_from_text(prompt, model_name):
    print(f"--- Starting Generation for '{model_name}' via Text Prompt ---")
    print(f"Prompt: {prompt}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(300)
        s.connect((HOST, PORT))
        
        # 1. Submit Job
        print("Submitting job to Hyper3D Rodin...")
        payload = {
            "type": "create_rodin_job",
            "params": {
                "text_prompt": prompt,
                "images": None,
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
        print(f"Subscription Key: {subscription_key}")
        
        # 2. Poll Status
        print("Polling for completion (this may take a few minutes)...")
        status = "processing"
        
        while status not in ["Done", "Failed", "Succeed", "COMPLETED"]:
            time.sleep(5) # Poll every 5s
            
            try:
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
                res_data = poll_result.get("result", {})
                
                print(f"Status: {res_data}")
                
                if isinstance(res_data, list):
                    if all(st == "Done" for st in res_data):
                        status = "Done"
                    elif any(st == "Failed" for st in res_data):
                        status = "Failed"
                elif isinstance(res_data, dict) and "status_list" in res_data:
                    s_list = res_data["status_list"]
                    if all(st == "Done" for st in s_list):
                        status = "Done"
                    elif any(st == "Failed" for st in s_list):
                        status = "Failed"
                else:
                    if res_data == "Done": status = "Done"
            except Exception as poll_e:
                print(f"Polling error: {poll_e}")
                time.sleep(5)
        
        print(f"\nFinal Status: {status}")
        
        if status == "Done":
            # 3. Import Asset
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
        if 's' in locals(): s.close()

if __name__ == "__main__":
    # Generate Top (Done)
    # generate_from_text("A high quality 3D model of a stylish casual t-shirt, realistic fabric texture, isolated white background", "Generated_Top")
    # print("\n" + "="*30 + "\n")
    # Generate Pants
    generate_from_text("A high quality 3D model of stylish casual pants, trousers, realistic fabric texture, isolated white background", "Generated_Pants")
