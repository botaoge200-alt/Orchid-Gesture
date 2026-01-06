# 项目迁移指南 (Project Migration Guide)

## 方法一：使用 GitHub (推荐 - 自动同步)

### 1. 在当前电脑上 (上传)
我已经为您初始化了本地仓库并提交了所有代码。您只需要：

1.  登录您的 GitHub: [https://github.com/botaoge200-alt](https://github.com/botaoge200-alt)
2.  点击右上角 **+** 号 -> **New repository**。
3.  仓库名输入 `Orchid-Gesture` (或者您喜欢的名字)。
4.  **不要** 勾选 "Initialize with README" 或 .gitignore (本地已经有了)。
5.  点击 **Create repository**。
6.  复制页面上显示的 "…or push an existing repository from the command line" 下面的那两行命令，在终端里运行。
    *   命令通常长这样：
        ```bash
        git remote add origin https://github.com/botaoge200-alt/Orchid-Gesture.git
        git push -u origin master
        ```

### 2. 在办公室电脑上 (下载)
1.  安装 **Git** 和 **Node.js**。
2.  打开终端，运行：
    ```bash
    git clone https://github.com/botaoge200-alt/Orchid-Gesture.git
    cd Orchid-Gesture/client
    npm install
    npm run dev
    ```

---

## 方法二：U盘/网盘复制 (备用)

### 1. 打包
1.  找到 `E:\Orchid Gesture` 文件夹。
2.  **删除** `client/node_modules` 文件夹 (这个太大了，不用拷)。
3.  将整个文件夹复制到 U 盘。

### 2. 恢复
1.  复制到新电脑。
2.  进入 `client` 文件夹。
3.  运行 `npm install`。
4.  运行 `npm run dev`。
