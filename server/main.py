from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
import cv2
import numpy as np
from pathlib import Path
import json
from .comfy_client import ComfyUIClient

app = FastAPI()

# 初始化 ComfyUI 客户端
# 注意：确保 ComfyUI 已经启动并监听 8188 端口
comfy_client = ComfyUIClient(server_address="127.0.0.1:8188")

# 全局变量存储当前使用的模型名称
CURRENT_CKPT_NAME = None

def ensure_model_selected():
    """
    尝试从 ComfyUI 获取可用的 Checkpoint 模型列表，并选择第一个。
    如果获取失败，返回 None。
    """
    global CURRENT_CKPT_NAME
    if CURRENT_CKPT_NAME:
        return CURRENT_CKPT_NAME
        
    try:
        print("Fetching available models from ComfyUI...")
        info = comfy_client.get_object_info()
        # CheckpointLoaderSimple 节点的 input.required.ckpt_name[0] 是列表
        checkpoints = info['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0]
        if checkpoints:
            CURRENT_CKPT_NAME = checkpoints[0]
            print(f"Auto-selected model: {CURRENT_CKPT_NAME}")
            return CURRENT_CKPT_NAME
    except Exception as e:
        print(f"Failed to fetch models: {e}")
        return None

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许跨域请求，方便前端调试
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保上传和输出目录存在
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# 挂载静态文件目录，以便前端访问生成的图片
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

@app.get("/")
async def root():
    return {"message": "Orchid Gesture AI Backend is running"}

@app.post("/generate-texture")
async def generate_texture(
    file: UploadFile = File(None), 
    part: str = Form(None),
    prompt: str = Form(None)
):
    """
    接收前端上传的图片或 Prompt，通过 ComfyUI 进行 AI 处理，返回结果。
    """
    try:
        print(f"Request received. Part: {part}, Prompt: {prompt}, File: {file.filename if file else 'None'}")
        
        # 暂时模拟返回结果，为了验证前端流程
        # 如果是 AI 设计模式（只有 Prompt，没有 File），或者有 File
        # 在真实场景中，这里会构建不同的 ComfyUI 工作流
        
        # 1. 如果有文件，保存文件
        comfy_filename = None
        if file:
            file_location = UPLOAD_DIR / file.filename
            with open(file_location, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            print(f"Received file: {file.filename}")
            
            # 上传到 ComfyUI
            print("Uploading to ComfyUI...")
            upload_resp = comfy_client.upload_image(file_location)
            if upload_resp:
                comfy_filename = upload_resp.get("name")
        
        # 2. 如果没有 ComfyUI 连接，或者为了快速测试 UI，直接返回一个测试图片
        # 检查 outputs 目录下有没有现成的图片，随便返回一张作为演示
        # 或者如果有 prompt，我们假装生成了一张
        
        # TODO: 这里应该根据 prompt 动态生成
        # 现在我们先查找 outputs 目录下的最新图片返回，如果没有，就返回一个默认的
        
        # 模拟处理时间
        import time
        # time.sleep(2) 
        
        # 寻找最近生成的图片
        output_files = sorted(OUTPUT_DIR.glob("*.png"), key=os.path.getmtime, reverse=True)
        if output_files:
            latest_image = output_files[0]
            filename = latest_image.name
            print(f"Returning cached/latest image: {filename}")
            return {
                "status": "success",
                "message": "Texture generated successfully",
                "texture_url": f"http://localhost:8000/outputs/{filename}",
                "part": part
            }
        else:
            # 如果没有生成的图片，返回一个 placeholder 或者错误
            # 这里为了演示，我们假设有一张 placeholder
            return {
                "status": "success", 
                "message": "Mock generation (no outputs found)",
                "texture_url": "https://via.placeholder.com/512x512.png?text=AI+Texture",
                "part": part
            }

        # --- 以下是原本的 ComfyUI 逻辑，暂时注释掉或保留作为参考 ---
        # 真实逻辑应该根据 prompt 修改 workflow["6"]["inputs"]["text"] = prompt
        
        """
        # 3. 加载工作流模板
        with open("workflow_template.json", "r", encoding="utf-8") as f:
            workflow = json.load(f)

        # 4. 修改参数
        if comfy_filename:
            workflow["3"]["inputs"]["image"] = comfy_filename
            
        if prompt:
             # 假设节点 6 是 CLIP Text Encode (Prompt)
             # workflow["6"]["inputs"]["text"] = prompt
             pass

        # 5. 发送任务
        prompt_id = comfy_client.queue_prompt(workflow)["prompt_id"]
        
        # 6. 等待结果
        output_images = comfy_client.get_images(prompt_id)
        
        # ... 保存并返回 ...
        """

    except Exception as e:
        print(f"Error processing request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
