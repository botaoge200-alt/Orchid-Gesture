import websocket
import uuid
import json
import urllib.request
import urllib.parse
import requests
import os

class ComfyUIClient:
    def __init__(self, server_address="127.0.0.1:8188"):
        self.server_address = server_address
        self.client_id = str(uuid.uuid4())
        self.ws = None

    def queue_prompt(self, prompt):
        p = {"prompt": prompt, "client_id": self.client_id}
        data = json.dumps(p).encode('utf-8')
        req =  urllib.request.Request(f"http://{self.server_address}/prompt", data=data)
        return json.loads(urllib.request.urlopen(req).read())

    def get_image(self, filename, subfolder, folder_type):
        data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url_values = urllib.parse.urlencode(data)
        with urllib.request.urlopen(f"http://{self.server_address}/view?{url_values}") as response:
            return response.read()

    def get_history(self, prompt_id):
        with urllib.request.urlopen(f"http://{self.server_address}/history/{prompt_id}") as response:
            return json.loads(response.read())

    def get_object_info(self):
        """获取所有节点的信息，包括模型列表"""
        with urllib.request.urlopen(f"http://{self.server_address}/object_info") as response:
            return json.loads(response.read())

    def upload_image(self, file_path, subfolder="", overwrite=True):
        """
        上传本地图片到 ComfyUI
        """
        try:
            with open(file_path, 'rb') as f:
                files = {'image': f}
                data = {'overwrite': str(overwrite).lower(), 'subfolder': subfolder}
                response = requests.post(
                    f"http://{self.server_address}/upload/image", 
                    files=files, 
                    data=data
                )
            
            if response.status_code == 200:
                result = response.json()
                # ComfyUI 返回的是 name, subfolder, type
                return result
            else:
                print(f"Upload failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Error uploading image: {e}")
            return None

    def connect_websocket(self):
        self.ws = websocket.WebSocket()
        self.ws.connect(f"ws://{self.server_address}/ws?clientId={self.client_id}")

    def close_websocket(self):
        if self.ws:
            self.ws.close()

    def generate(self, prompt_workflow):
        """
        执行完整的生成流程：连接WS -> 提交任务 -> 等待完成 -> 获取结果
        """
        try:
            self.connect_websocket()
            
            print("Sending prompt to ComfyUI...")
            prompt_id = self.queue_prompt(prompt_workflow)['prompt_id']
            print(f"Prompt ID: {prompt_id}")
            
            output_images = {}
            
            while True:
                out = self.ws.recv()
                if isinstance(out, str):
                    message = json.loads(out)
                    # print(f"WS Message: {message['type']}")
                    
                    if message['type'] == 'executing':
                        data = message['data']
                        if data['node'] is None and data['prompt_id'] == prompt_id:
                            # 执行完成
                            break
                else:
                    continue

            # 获取历史记录以找到输出图片
            history = self.get_history(prompt_id)[prompt_id]
            for node_id in history['outputs']:
                node_output = history['outputs'][node_id]
                if 'images' in node_output:
                    images_output = []
                    for image in node_output['images']:
                        image_data = self.get_image(image['filename'], image['subfolder'], image['type'])
                        images_output.append({
                            'filename': image['filename'],
                            'data': image_data
                        })
                    output_images[node_id] = images_output

            return output_images
            
        except Exception as e:
            print(f"Generation error: {e}")
            return None
        finally:
            self.close_websocket()
