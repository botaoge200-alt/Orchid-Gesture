from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import shutil
import os
import cv2
import numpy as np
from pathlib import Path

app = FastAPI()

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
async def generate_texture(file: UploadFile = File(...)):
    """
    接收前端上传的图片，模拟 AI 处理流程，返回处理后的纹理图片 URL。
    目前阶段使用 OpenCV 进行简单的图像处理（如边缘检测）作为 Mock。
    后期将在此处对接 Stable Diffusion API。
    """
    try:
        # 1. 保存上传的文件
        file_location = UPLOAD_DIR / file.filename
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Mock AI 处理 (这里用 OpenCV 做一个简单的反色或边缘检测，证明流程通了)
        # 读取图片
        img = cv2.imread(str(file_location))
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # 模拟：简单的图像处理，证明后端在工作
        # 这里我们做一个简单的伪彩色处理，模拟"生成"了新的纹理
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        inverted = cv2.bitwise_not(gray)
        processed_img = cv2.applyColorMap(inverted, cv2.COLORMAP_DEEPGREEN)

        # 3. 保存结果
        output_filename = f"processed_{file.filename}"
        output_path = OUTPUT_DIR / output_filename
        cv2.imwrite(str(output_path), processed_img)

        # 4. 返回可访问的 URL
        # 注意：这里假设后端运行在 localhost:8000
        return {
            "status": "success",
            "original_image": file.filename,
            "texture_url": f"http://localhost:8000/outputs/{output_filename}",
            "message": "Mock processing complete. Ready for Stable Diffusion integration."
        }

    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
