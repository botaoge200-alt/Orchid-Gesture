import bpy

def show_message_box(message="", title="MCP Diagnostics", icon='INFO'):
    def draw(self, context):
        self.layout.label(text=message)
    bpy.context.window_manager.popup_menu(draw, title=title, icon=icon)

print("\n" + "="*50)
print("开始查找 MCP 插件信息...")

# 1. 检查已启用的插件
found_addon = False
print("正在检查已启用的插件...")
for addon_name in bpy.context.preferences.addons.keys():
    if "mcp" in addon_name.lower() or "agent" in addon_name.lower():
        print(f"  [√] 发现已启用插件: {addon_name}")
        found_addon = True

if not found_addon:
    print("  [!] 未发现名称包含 'mcp' 或 'agent' 的已启用插件。")
    print("      请检查 编辑 -> 偏好设置 -> 插件，确保插件已勾选！")

# 2. 检查 N 面板 (Sidebar) 的标签页
print("\n正在检查 3D 视图侧边栏 (N-Panel) 的标签...")
found_tab = False
categories = set()

for cls in bpy.types.Panel.__subclasses__():
    if hasattr(cls, "bl_category"):
        cat = cls.bl_category
        categories.add(cat)
        # 检查是否看起来像 MCP
        if "MCP" in cat or "Agent" in cat or "Orchid" in cat:
            print(f"  [√] 找到疑似 MCP 的标签页: 【 {cat} 】")
            found_tab = True

print("-" * 30)
print("所有检测到的标签页名称:")
print(sorted(list(categories)))
print("-" * 30)

if found_tab:
    msg = "找到啦！请在 3D 视图按 'N' 键，在右侧标签栏找带有 'MCP' 字样的标签。"
    print(f"\n==> {msg}")
    show_message_box(msg, icon='CHECKMARK')
else:
    msg = "未找到 MCP 标签。可能插件未启用，或名字不叫 MCP。"
    print(f"\n==> {msg}")
    show_message_box(msg, icon='ERROR')

print("="*50 + "\n")
