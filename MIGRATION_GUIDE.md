# 项目迁移指南 (Project Migration Guide)

## 1. 准备工作 (在办公室电脑上)
在开始之前，请确保办公室的电脑安装了以下软件：

1.  **Node.js** (运行环境)
    *   下载地址: https://nodejs.org/
    *   版本建议: v20 或更高 (您家里用的是 v24)
    *   安装后验证: 打开命令行(CMD/PowerShell) 输入 `node -v` 也就是看看有没有版本号。

2.  **辅助工具 (如果需要调整模型)**
    *   MakeHuman (用于生成人体)
    *   Blender (用于格式转换)
    *   *注：如果只是开发网页功能，这两个暂时不需要，只带代码就行。*

---

## 2. 如何启动项目

将项目文件夹复制到办公室电脑后，请按以下步骤操作：

### 第一步：打开项目
1.  找到 `Orchid Gesture` 文件夹。
2.  进入 `client` 文件夹 (代码都在这里)。
3.  在空白处 **右键 -> 在终端中打开** (或者 Open in Terminal)。

### 第二步：安装依赖 (如果没复制 node_modules 文件夹)
如果您复制过来的文件夹里没有 `node_modules` (通常为了文件体积小会删掉它再复制)，请执行：
```bash
npm install
```
*等待进度条走完...*

### 第三步：启动预览
输入以下命令启动网页：
```bash
npm run dev
```

### 第四步：查看
按住 `Ctrl` 点击终端里显示的链接 (通常是 http://localhost:5173)，或者在浏览器手动输入这个地址。

---

## 3. 常见问题

*   **报错 "npm is not recognized"**: 说明 Node.js 没安装好，请重新安装 Node.js。
*   **报错 "vite is not recognized"**: 说明依赖没装好，请重新执行 `npm install`。
*   **模型不显示**: 检查 `public/models/plmxs.glb` 文件是否在位。
