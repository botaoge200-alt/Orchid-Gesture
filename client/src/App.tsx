import React, { useState, useMemo, Suspense, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Html, useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { HumanModel } from './components/HumanModel'
import './App.css'

import { MODEL_CONFIG } from './config'

function Loader() {
  const { progress } = useProgress()
  return <Html center>{progress.toFixed(1)} % loaded</Html>
}

// 部件列表定义
const wardrobeParts = [
  { id: 'top', name: '上装 / 衬衫' },
  { id: 'bottom', name: '下装 / 裤子' },
  { id: 'dress', name: '连衣裙 / 全身' },
  { id: 'shoes', name: '鞋履' },
  { id: 'hat', name: '帽子 / 头饰' },
  { id: 'scarf', name: '围巾 / 颈饰' },
  { id: 'accessory', name: '配饰' }
]

const TABS = [
  { id: 'file', label: '文件' },
  { id: 'modeling', label: '建模' },
  { id: 'geometries', label: '几何形状' },
  { id: 'materials', label: '材质' },
  { id: 'pose', label: '姿态/动画' },
  { id: 'render', label: '渲染' },
  { id: 'settings', label: '设置' },
  { id: 'utilities', label: '工具' },
  { id: 'help', label: '帮助' },
  { id: 'community', label: '社区' }
]

const SUB_TABS: Record<string, { id: string, label: string }[]> = {
  file: [
    { id: 'open', label: '打开' },
    { id: 'save', label: '保存' },
    { id: 'export', label: '导出' }
  ],
  // 其他一级菜单的二级菜单可以在此预留
  modeling: [],
  geometries: [],
  materials: [],
  pose: [],
  render: [],
  settings: [],
  utilities: [],
  help: [],
  community: []
}



function App() {
  // --- 状态管理 ---

  // 1. 界面导航状态
  const [activeTab, setActiveTab] = useState<string>('file')
  const [activeSubTab, setActiveSubTab] = useState<string>('open')
  const [selectedPart, setSelectedPart] = useState('dress')

  // 文件路径模拟
  const [currentPath, setCurrentPath] = useState('C:/Users/User/Documents/makehuman/v1py3/models')

  // 2. 材质/衣柜状态
  // 存储每个部位的材质信息
  const [wardrobe, setWardrobe] = useState<Record<string, {
    color: string
    texture: THREE.Texture | null
    textureUrl: string | null
    textureId: string
    roughness: number
    metalness: number
    // 形状与纹理变换
    scale: number
    textureRepeat: [number, number]
    textureOffset: [number, number]
  }>>(() => {
    // 初始化默认状态
    const initial: any = {}
    wardrobeParts.forEach(part => {
      initial[part.id] = {
        color: '#ffffff',
        texture: null,
        textureUrl: null,
        textureId: 'none',
        roughness: 0.6,
        metalness: 0.0,
        scale: 1.0,
        textureRepeat: [1, 1],
        textureOffset: [0, 0]
      }
    })
    return initial
  })

  const [sculptSettings, setSculptSettings] = useState({
    radius: 0.1,
    intensity: 1.0, // Default to 1.0 (Direct follow)
    symmetry: true,
    wireframe: false
  })
  const [hoveredMeshName, setHoveredMeshName] = useState<string>('')

  // 阻止右键菜单和事件冒泡，防止浏览器手势
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<any>(null)

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset()
      // 确保目标点回到模型中心
      controlsRef.current.target.set(0, 10, 0)
      controlsRef.current.update()
    }
  }

  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }

    const handleMouse = (e: MouseEvent) => {
      if (e.button === 2) { // Right click
        e.stopPropagation() // Stop bubbling to window (where gestures listen)
      }
    }

    container.addEventListener('contextmenu', handleContextMenu)
    container.addEventListener('mousedown', handleMouse)
    container.addEventListener('mouseup', handleMouse)

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu)
      container.removeEventListener('mousedown', handleMouse)
      container.removeEventListener('mouseup', handleMouse)
    }
  }, [])

  // --- 事件处理 ---

  // 3. 模型点击处理
  const updatePartStyle = (partId: string, updates: Partial<typeof wardrobe['dress']>) => {
    setWardrobe(prev => ({
      ...prev,
      [partId]: { ...prev[partId], ...updates }
    }))
  }

  // 处理纹理上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, partId: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    const loader = new THREE.TextureLoader()
    
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.flipY = false // GLTF/FBX 通常不需要翻转Y
      
      updatePartStyle(partId, {
        texture: texture,
        textureUrl: url,
        textureId: file.name
      })
    })
  }

  // 模型点击处理
  const handleModelClick = () => {
    // 未来可以实现点击模型选中对应部位
    // 目前 HumanModel 内部已经有简单的点击日志
  }

  return (
    <div className="main-layout">
      {/* 顶部导航栏 - MakeHuman 风格 */}
      <div className="top-bar">
        <div className="tabs">
            {TABS.map(tab => (
                <button 
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab(tab.id as any)
                        // 切换一级菜单时，默认选中第一个二级菜单（如果有）
                        const subTabs = SUB_TABS[tab.id]
                        if (subTabs && subTabs.length > 0) {
                          setActiveSubTab(subTabs[0].id)
                        }
                    }}
                >
                    {tab.label}
                </button>
            ))}
        </div>
      </div>

      {/* 顶部：二级菜单 (仅当有二级菜单时显示) */}
      {SUB_TABS[activeTab] && SUB_TABS[activeTab].length > 0 && (
        <div className="sub-top-bar">
          {SUB_TABS[activeTab].map(subTab => (
            <button
              key={subTab.id}
              className={`sub-tab-btn ${activeSubTab === subTab.id ? 'active' : ''}`}
              onClick={() => setActiveSubTab(subTab.id)}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      )}

      <div className="app-container">
        {/* 左侧：资产库面板 (根据 Tab 变化) */}
        <div className="left-panel">
          {activeTab === 'materials' ? (
             <ul className="part-list">
               {wardrobeParts.map(part => (
                 <li 
                   key={part.id} 
                   className={`part-item ${selectedPart === part.id ? 'active' : ''}`}
                   onClick={() => setSelectedPart(part.id)}
                 >
                   {part.name}
                 </li>
               ))}
             </ul>
          ) : activeTab === 'file' && activeSubTab === 'open' ? (
            // 文件 -> 打开：排序与筛选
            <>
              <div className="property-group">
                <div className="group-title">排序</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px' }}>
                  <label><input type="radio" name="sort" defaultChecked /> 按名称</label>
                  <label><input type="radio" name="sort" /> 按创建时间</label>
                  <label><input type="radio" name="sort" /> 按修改时间</label>
                  <label><input type="radio" name="sort" /> 按大小</label>
                </div>
              </div>
              <div className="property-group">
                <div className="group-title">标签筛选</div>
                <div style={{ padding: '10px', color: '#888' }}>
                  (无标签)
                </div>
              </div>
            </>
          ) : (
             <div style={{padding: '20px', color: '#888', fontStyle: 'italic', fontSize: '13px'}}>
                {activeTab} 功能开发中...
             </div>
          )}
        </div>

        {/* 中间：3D 预览区 */}
        <div 
          className="canvas-container"
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            return false
          }}
        >
          {/* 文件路径条 (仅在文件模式显示) */}
          {activeTab === 'file' && (
            <div style={{ background: '#333', padding: '5px', display: 'flex', alignItems: 'center', gap: '5px', borderBottom: '1px solid #444' }}>
              <span style={{ fontSize: '12px' }}>Selected Folder:</span>
              <input type="text" value={currentPath} readOnly style={{ flex: 1, background: '#222', border: '1px solid #555', color: '#ddd', padding: '2px 5px' }} />
              <button style={{ background: '#555', border: 'none', color: 'white', padding: '2px 8px', cursor: 'pointer' }}>...</button>
            </div>
          )}

          <Canvas camera={{ position: MODEL_CONFIG.CAMERA_POSITION, fov: MODEL_CONFIG.FOV }} gl={{ toneMappingExposure: 1.0 }}>
            <ambientLight intensity={0.7} />
            <spotLight 
              position={[30, 30, 30]} 
              angle={0.15} 
              penumbra={1} 
              intensity={1.0} 
              shadow-bias={-0.0001}
            />
            <pointLight position={[-15, -15, -15]} intensity={0.5} />
            <Environment files="/textures/studio_small_09_1k.hdr" background={false} />
            
            <Suspense fallback={<Loader />}>
              <HumanModel 
                activeTab={activeTab}
                selectedPart={selectedPart}
                wardrobe={wardrobe}
                sculptSettings={sculptSettings}
                onModelClick={handleModelClick}
                onHover={(name) => setHoveredMeshName(name)}
              />
            </Suspense>
            <OrbitControls 
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              mouseButtons={{
                LEFT: undefined as any, // 禁用左键摄像机，保留给雕刻
                MIDDLE: THREE.MOUSE.PAN, // 中键平移
                RIGHT: THREE.MOUSE.ROTATE // 右键旋转
              }}
              minPolarAngle={Math.PI / 2 - (70 * Math.PI / 180)}
              maxPolarAngle={Math.PI / 2 + (70 * Math.PI / 180)}
              minDistance={10} 
              maxDistance={100} 
              enableDamping={true}
              dampingFactor={0.05}
              target={[0, 10, 0]} 
            />
          </Canvas>
        </div>

        {/* 右侧：属性面板 - MakeHuman 风格 */}
        <div className="right-panel">
          {activeTab === 'modeling' ? (
             <div className="property-group">
                <div className="group-title">塑形工具 (Sculpt)</div>
                <div className="control-row">
                    <label>笔刷大小 (Radius): {sculptSettings.radius.toFixed(2)}</label>
                    <input 
                      type="range" 
                      min="0.01" 
                      max="0.5" 
                      step="0.01"
                      style={{width: '100%'}}
                      value={sculptSettings.radius}
                      onChange={(e) => setSculptSettings({...sculptSettings, radius: parseFloat(e.target.value)})}
                    />
                </div>
                {/* 强度控制已移除，默认跟随鼠标 */}
                <div className="control-row">
                    <label>对称编辑 (Symmetry)</label>
                    <input 
                      type="checkbox" 
                      checked={sculptSettings.symmetry}
                      onChange={(e) => setSculptSettings({...sculptSettings, symmetry: e.target.checked})}
                    />
                </div>
                <div className="control-row">
                    <label>显示网格 (Wireframe)</label>
                    <input 
                      type="checkbox" 
                      checked={sculptSettings.wireframe}
                      onChange={(e) => setSculptSettings({...sculptSettings, wireframe: e.target.checked})}
                    />
                </div>
                {hoveredMeshName && (
                  <div className="control-row" style={{marginTop: '10px', padding: '5px', background: '#333', borderRadius: '4px'}}>
                      <label style={{fontSize: '11px', color: '#aaa'}}>当前目标 (Target):</label>
                      <div style={{fontSize: '12px', color: '#4f9'}}>{hoveredMeshName}</div>
                  </div>
                )}
                <div className="description-text" style={{marginTop: '10px', fontSize: '12px', color: '#888'}}>
                    操作指南:
                    <br/>- 左键按住模型拖拽可调整形状
                    <br/>- 右键按住旋转视角
                    <br/>- 对称模式下会自动调整另一侧
                </div>
             </div>
          ) : activeTab === 'materials' ? (
             <>
             <div className="property-group">
                <div className="group-title">当前选中部位 (Selected Part)</div>
                <div className="control-row">
                    <label>当前选择</label>
                    <div style={{padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px'}}>
                        {wardrobeParts.find(p => p.id === selectedPart)?.name}
                    </div>
                </div>
             </div>

             <div className="property-group">
                <div className="group-title">材质参数设置 (Material)</div>
                
                {/* 颜色选择 */}
                <div className="control-row">
                    <label>基础颜色 (Color)</label>
                    <div className="color-picker-wrapper">
                         <input 
                           type="color" 
                           value={wardrobe[selectedPart].color}
                           onChange={(e) => updatePartStyle(selectedPart, { color: e.target.value })}
                         />
                         <span>{wardrobe[selectedPart].color}</span>
                    </div>
                </div>

                {/* 纹理预览与操作 */}
                <div className="control-row">
                    <label>纹理贴图 (Texture)</label>
                    <div className="texture-slot">
                        {wardrobe[selectedPart].textureUrl ? (
                            <img src={wardrobe[selectedPart].textureUrl || ''} className="texture-thumb" alt="Texture" />
                        ) : (
                            <div className="texture-empty">暂无纹理</div>
                        )}
                    </div>
                    <div className="button-row">
                         <label className="btn-mh-style">
                            加载纹理...
                            <input 
                                type="file" 
                                accept="image/*" 
                                hidden 
                                onChange={(e) => handleFileUpload(e, selectedPart)}
                            />
                         </label>
                         {wardrobe[selectedPart].textureUrl && (
                             <button 
                                className="btn-mh-style"
                                onClick={() => updatePartStyle(selectedPart, { texture: null, textureUrl: null, textureId: 'none' })}
                             >
                                移除纹理
                             </button>
                         )}
                    </div>
                </div>

                {/* 质感控制 */}
                <div className="control-row">
                    <label>粗糙度 (Roughness): {wardrobe[selectedPart].roughness?.toFixed(2)}</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      style={{width: '100%'}}
                      value={wardrobe[selectedPart].roughness || 0.6}
                      onChange={(e) => updatePartStyle(selectedPart, { roughness: parseFloat(e.target.value) })}
                    />
                </div>
                <div className="control-row">
                    <label>金属度 (Metalness): {wardrobe[selectedPart].metalness?.toFixed(2)}</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      style={{width: '100%'}}
                      value={wardrobe[selectedPart].metalness || 0.0}
                      onChange={(e) => updatePartStyle(selectedPart, { metalness: parseFloat(e.target.value) })}
                    />
                </div>

                {/* 形状调整 (仅缩放) */}
                <div className="property-group" style={{marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px'}}>
                    <div className="group-title">形状缩放 (Scale)</div>
                    <div className="control-row">
                        <label>整体缩放: {wardrobe[selectedPart].scale?.toFixed(2)}</label>
                        <input 
                          type="range" 
                          min="0.8" 
                          max="1.5" 
                          step="0.01"
                          style={{width: '100%'}}
                          value={wardrobe[selectedPart].scale || 1.0}
                          onChange={(e) => updatePartStyle(selectedPart, { scale: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>

                {/* 纹理变换 */}
                {wardrobe[selectedPart].textureUrl && (
                <div className="property-group" style={{marginTop: '10px', borderTop: '1px solid #444', paddingTop: '10px'}}>
                    <div className="group-title">纹理变换 (Transform)</div>
                    <div className="control-row">
                        <label>平铺 X (Repeat X): {wardrobe[selectedPart].textureRepeat?.[0].toFixed(1)}</label>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="5" 
                          step="0.1"
                          style={{width: '100%'}}
                          value={wardrobe[selectedPart].textureRepeat?.[0] || 1}
                          onChange={(e) => {
                              const current = wardrobe[selectedPart].textureRepeat || [1, 1]
                              updatePartStyle(selectedPart, { textureRepeat: [parseFloat(e.target.value), current[1]] })
                          }}
                        />
                    </div>
                    <div className="control-row">
                        <label>平铺 Y (Repeat Y): {wardrobe[selectedPart].textureRepeat?.[1].toFixed(1)}</label>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="5" 
                          step="0.1"
                          style={{width: '100%'}}
                          value={wardrobe[selectedPart].textureRepeat?.[1] || 1}
                          onChange={(e) => {
                              const current = wardrobe[selectedPart].textureRepeat || [1, 1]
                              updatePartStyle(selectedPart, { textureRepeat: [current[0], parseFloat(e.target.value)] })
                          }}
                        />
                    </div>
                    <div className="control-row">
                        <label>偏移 X (Offset X): {wardrobe[selectedPart].textureOffset?.[0].toFixed(2)}</label>
                        <input 
                          type="range" 
                          min="-1" 
                          max="1" 
                          step="0.01"
                          style={{width: '100%'}}
                          value={wardrobe[selectedPart].textureOffset?.[0] || 0}
                          onChange={(e) => {
                              const current = wardrobe[selectedPart].textureOffset || [0, 0]
                              updatePartStyle(selectedPart, { textureOffset: [parseFloat(e.target.value), current[1]] })
                          }}
                        />
                    </div>
                     <div className="control-row">
                        <label>偏移 Y (Offset Y): {wardrobe[selectedPart].textureOffset?.[1].toFixed(2)}</label>
                        <input 
                          type="range" 
                          min="-1" 
                          max="1" 
                          step="0.01"
                          style={{width: '100%'}}
                          value={wardrobe[selectedPart].textureOffset?.[1] || 0}
                          onChange={(e) => {
                              const current = wardrobe[selectedPart].textureOffset || [0, 0]
                              updatePartStyle(selectedPart, { textureOffset: [current[0], parseFloat(e.target.value)] })
                          }}
                        />
                    </div>
                </div>
                )}
             </div>
             </>
          ) : activeTab === 'file' && activeSubTab === 'open' ? (
            // 文件 -> 打开：文件选择器
            <div className="property-group">
              <div className="group-title">文件选择器</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', padding: '10px' }}>
                {/* 模拟文件列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', background: '#444', padding: '5px', borderRadius: '4px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#666', marginBottom: '5px' }}></div>
                  <div style={{ fontSize: '11px', textAlign: 'center', wordBreak: 'break-all' }}>plmxs</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ width: '40px', height: '40px', background: '#333', marginBottom: '5px' }}></div>
                  <div style={{ fontSize: '11px', textAlign: 'center' }}>Default</div>
                </div>
              </div>
            </div>
          ) : (
             <div className="property-group">
                <div className="group-title">属性</div>
                <div style={{padding: '10px', color: '#888'}}>暂无属性</div>
             </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default App
