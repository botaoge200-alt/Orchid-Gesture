import socket
import json
import time

HOST = '127.0.0.1'
PORT = 9876

# Blue Shirt
TASK_UUID = "2070227a-8c78-4726-bf4b-0bdfd88d9887"
SUB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoxLCJqb2JJZHMiOlsiNTJhODFiN2MtMDc0Ni00Y2FmLTk5ZjEtYmE5ODg5OTg2ZTcwIiwiNWFkMThkYmUtM2ViOC00ZGJhLTg0NzctZGFiMTA1OWJlMmFmIiwiM2VmY2U0ZWMtZWQ3Ni00MWEyLTlhNmQtM2ZiNDA3MjNmODQxIiwiMGYxMThjYzMtOWE1Ny00NzMxLWI2M2QtNmI2ZTRjMWMyYjc2IiwiNDY5ZWMxMWQtYTI4NS00MDRjLWI1NGYtMjI5MTc0YzUwNzZlIiwiNThlM2YxNjQtYTMyZi00YTRiLWIzMDItZjQwN2JhMjQ0ZDBkIl0sImlhdCI6MTc2Nzg3MjI5NH0.UKBdBb0opPy5PqmuiDZibWbFLYb4n1A66KfFcJn15HA"
MODEL_NAME = "Generated_Blue_Shirt"

def poll_and_import():
    print(f"Resuming polling for {MODEL_NAME}...")
    status = "processing"
    
    while status not in ["Done", "Failed", "Succeed", "COMPLETED"]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(10)
            s.connect((HOST, PORT))
            
            payload = {
                "type": "poll_rodin_job_status",
                "params": {
                    "subscription_key": SUB_KEY
                }
            }
            s.sendall(json.dumps(payload).encode('utf-8'))
            resp = s.recv(4096)
            s.close()
            
            data = json.loads(resp.decode('utf-8'))
            result = data.get("result", {})
            
            print(f"Status Result: {result}")
            
            # Parse Status
            if isinstance(result, list):
                if all(st == "Done" for st in result):
                    status = "Done"
                elif any(st == "Failed" for st in result):
                    status = "Failed"
            elif isinstance(result, dict) and "status_list" in result:
                s_list = result["status_list"]
                if all(st == "Done" for st in s_list):
                    status = "Done"
                elif any(st == "Failed" for st in s_list):
                    status = "Failed"
            elif result == "Done":
                status = "Done"
                
            if status != "Done":
                time.sleep(10) # Poll every 10s
                
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(10)
            
    print(f"Final Status: {status}")
    
    if status == "Done":
        print(f"Importing asset as '{MODEL_NAME}'...")
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((HOST, PORT))
            
            payload = {
                "type": "import_generated_asset",
                "params": {
                    "name": MODEL_NAME,
                    "task_uuid": TASK_UUID
                }
            }
            s.sendall(json.dumps(payload).encode('utf-8'))
            resp = s.recv(4096)
            s.close()
            print(f"Import Result: {resp.decode('utf-8')}")
        except Exception as e:
            print(f"Import Error: {e}")

if __name__ == "__main__":
    poll_and_import()
