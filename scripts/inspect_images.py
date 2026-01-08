import os

def check_file(path):
    print(f"Checking {path}...")
    if not os.path.exists(path):
        print("File not found.")
        return
        
    size = os.path.getsize(path)
    print(f"Size: {size} bytes")
    
    with open(path, "rb") as f:
        header = f.read(10)
        print(f"Header: {header.hex()}")

check_file(r"E:\Orchid Gesture\tupian\23456.jpg")
check_file(r"E:\Orchid Gesture\tupian\56789.jpg")
