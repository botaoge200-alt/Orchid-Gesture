import bpy
import socket
import threading

# --- Blender 内部简易服务器 ---
# 功能：监听 9876 端口，接收纯文本 Python 代码并执行
# 使用方法：在 Blender 的 Scripting 界面打开此文件，点击“运行脚本” (Run Script)

def run_server():
    HOST = '127.0.0.1'
    PORT = 9876
    
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind((HOST, PORT))
        server.listen(1)
        print(f"--> [Server] Listening on {HOST}:{PORT}...")
        
        while True:
            # 接受连接
            conn, addr = server.accept()
            try:
                # 接收数据
                data = conn.recv(10240).decode('utf-8')
                if not data:
                    break
                
                print(f"--> [Server] Executing command (len={len(data)})")
                
                # 在 Blender 主上下文中执行代码
                # 必须用 try-except 包裹以防崩溃
                try:
                    exec(data)
                    response = "SUCCESS"
                except Exception as e:
                    print(f"Execution Error: {e}")
                    response = f"ERROR: {e}"
                
                conn.sendall(response.encode('utf-8'))
            except Exception as e:
                print(f"Connection Error: {e}")
            finally:
                conn.close()
                
    except OSError as e:
        print(f"Server Bind Error (Port likely in use): {e}")
    finally:
        server.close()

# 启动后台线程
# 注意：如果在 Blender 里重复运行此脚本，可能会因为端口占用报错，重启 Blender 即可
thread = threading.Thread(target=run_server, daemon=True)
thread.start()

print("--------------------------------------------------")
print(f"Blender Server Started on Port 9876")
print("Waiting for commands...")
print("--------------------------------------------------")
