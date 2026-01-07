import React, { useState, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { HumanModel } from './components/HumanModel'
import './App.css'

function App() {
  // 状态管理
  const [color, setColor] = useState('#ff0000') // 主色
  const [stripeColor, setStripeColor] = useState('#ffffff') // 条纹色/辅色
  const [width, setWidth] = useState(0) // 裙摆宽度
  const [length, setLength] = useState(0) // 裙长
  const [patternId, setPatternId] = useState('none') // 当前选中的模块ID (默认纯色)

  // 颜色画笔状态
  const [selectedBrushColor, setSelectedBrushColor] = useState<string | null>(null)
  
  // 花型下拉菜单状态
  const [isPatternMenuOpen, setIsPatternMenuOpen] = useState(false)

  // 预设颜色 (32色)
  const presetColors = useMemo(() => [
    '#FF0000', '#FF4500', '#FF8C00', '#FFD700', 
    '#FFFF00', '#ADFF2F', '#00FF00', '#32CD32',
    '#00FA9A', '#00FFFF', '#00BFFF', '#1E90FF', 
    '#0000FF', '#8A2BE2', '#FF00FF', '#C71585',
    '#FF69B4', '#FFB6C1', '#F08080', '#FA8072',
    '#FFA07A', '#F4A460', '#D2691E', '#8B4513',
    '#A0522D', '#D2B48C', '#F5DEB3', '#FFF8DC',
    '#FFFFFF', '#C0C0C0', '#808080', '#000000'
  ], [])

  // 监听 ESC 键取消颜色选择
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBrushColor(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 处理3D模型点击
  const handleModelClick = () => {
    if (selectedBrushColor) {
      setColor(selectedBrushColor)
      // 如果需要保留条纹模式但改变颜色，可以根据逻辑调整。这里假设点击直接变纯色，或者改变主色。
      // 如果当前是纯色模式，直接变色。如果是有花型，可能只变底色。
      // 用户说"涂上鼠标已经吸附的颜色"，这里简单处理为改变主色。
    }
  }

  // 筛选器状态
  const [category, setCategory] = useState('patterns') // 一级菜单：模块库
  const [clothingType, setClothingType] = useState('dress') // 二级菜单：衣服类型
  const [materialType, setMaterialType] = useState('cotton') // 三级菜单：面料选择
  const [selectedTool, setSelectedTool] = useState<'brush'|'circle'|'square'|'line'|'wand'|'freeform'>('brush')
  const toolCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [toolDrawing, setToolDrawing] = useState(false)
  const [toolLineStart, setToolLineStart] = useState<{x:number,y:number} | null>(null)
  const [toolSize, setToolSize] = useState(40)

  // 一级分类列表状态
  const [categories, setCategories] = useState([
    { id: 'patterns', name: '模块库 (Patterns)' },
    { id: 'clothes', name: '服装库 (Clothes)' },
    { id: 'scenes', name: '场景库 (Scenes)' }
  ])

  // 添加新分类
  const handleAddCategory = () => {
    const name = window.prompt('请输入新分类名称：')
    if (name) {
      const id = `cat-${Date.now()}`
      setCategories(prev => [...prev, { id, name }])
      setCategory(id) // 自动切换到新分类
    }
  }

  // 模拟模块库数据 (现在改为状态，以便添加新模块)
  type Pattern = { id: string, name: string, type: 'solid'|'svg'|'image', img: string|null }
  const defaultPatterns: Pattern[] = [
    { id: 'none', name: '纯色基础款', type: 'solid', img: null },
    { id: 'stripes', name: '经典双色夹条', type: 'svg', img: null },
    { id: 'plaid', name: '苏格兰格纹', type: 'svg', img: null },
    { id: 'dots', name: '波点印花', type: 'svg', img: null },
  ]
  const [patternsByPart, setPatternsByPart] = useState<Record<string, Pattern[]>>({
    dress: defaultPatterns,
    top: defaultPatterns,
    skirt: defaultPatterns
  })
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('patternsByPart')
      if (saved) {
        const parsed = JSON.parse(saved)
        setPatternsByPart(prev => ({ ...prev, ...parsed }))
      }
    } catch {}
  }, [])
  React.useEffect(() => {
    try {
      localStorage.setItem('patternsByPart', JSON.stringify(patternsByPart))
    } catch {}
  }, [patternsByPart])
  const patterns = useMemo(() => patternsByPart[clothingType] || defaultPatterns, [patternsByPart, clothingType])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('http://localhost:8000/generate-texture', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const newPattern: Pattern = {
        id: `custom-${Date.now()}`,
        name: file.name,
        type: 'image',
        img: data.texture_url as string
      }
      setPatternsByPart(prev => {
        const list = prev[clothingType] || defaultPatterns
        return { ...prev, [clothingType]: [...list, newPattern] }
      })
      setPatternId(newPattern.id)
    } catch {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imgUrl = event.target?.result as string
        const newPattern: Pattern = {
          id: `custom-${Date.now()}`,
          name: file.name,
          type: 'image',
          img: imgUrl
        }
        setPatternsByPart(prev => {
          const list = prev[clothingType] || defaultPatterns
          return { ...prev, [clothingType]: [...list, newPattern] }
        })
        setPatternId(newPattern.id)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleApplyToolTexture = () => {
    const canvas = toolCanvasRef.current
    if (!canvas) return
    const imgUrl = canvas.toDataURL('image/png')
    const newPattern: Pattern = {
      id: `tool-${Date.now()}`,
      name: `工具纹理`,
      type: 'image',
      img: imgUrl
    }
    setPatternsByPart(prev => {
      const list = prev[clothingType] || defaultPatterns
      return { ...prev, [clothingType]: [...list, newPattern] }
    })
    setPatternId(newPattern.id)
  }

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const getCtx = () => {
    const canvas = toolCanvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    return ctx
  }
  const toolColor = selectedBrushColor || stripeColor
  const onToolMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    const ctx = getCtx()
    if (!ctx) return
    if (selectedTool === 'brush' || selectedTool === 'freeform') {
      setToolDrawing(true)
      ctx.strokeStyle = toolColor
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    } else if (selectedTool === 'circle') {
      ctx.fillStyle = toolColor
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, toolSize, 0, Math.PI * 2)
      ctx.fill()
    } else if (selectedTool === 'square') {
      ctx.fillStyle = toolColor
      ctx.fillRect(pos.x - toolSize, pos.y - toolSize, toolSize * 2, toolSize * 2)
    } else if (selectedTool === 'line') {
      if (!toolLineStart) {
        setToolLineStart(pos)
      } else {
        ctx.strokeStyle = toolColor
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(toolLineStart.x, toolLineStart.y)
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        setToolLineStart(null)
      }
    } else if (selectedTool === 'wand') {
      const canvas = toolCanvasRef.current
      if (!canvas) return
      const ctx2 = canvas.getContext('2d')
      if (!ctx2) return
      const img = ctx2.getImageData(0, 0, canvas.width, canvas.height)
      const target = ((pos.y | 0) * canvas.width + (pos.x | 0)) * 4
      const r0 = img.data[target], g0 = img.data[target+1], b0 = img.data[target+2]
      const stack: number[] = [pos.x | 0, pos.y | 0]
      const visited = new Set<string>()
      const tol = 32
      while (stack.length) {
        const y = stack.pop() as number
        const x = stack.pop() as number
        const key = x + ',' + y
        if (visited.has(key)) continue
        visited.add(key)
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue
        const idx = (y * canvas.width + x) * 4
        const r = img.data[idx], g = img.data[idx+1], b = img.data[idx+2]
        if (Math.abs(r - r0) <= tol && Math.abs(g - g0) <= tol && Math.abs(b - b0) <= tol) {
          img.data[idx] = parseInt(toolColor.slice(1,3),16)
          img.data[idx+1] = parseInt(toolColor.slice(3,5),16)
          img.data[idx+2] = parseInt(toolColor.slice(5,7),16)
          stack.push(x+1,y, x-1,y, x,y+1, x,y-1)
        }
      }
      ctx2.putImageData(img, 0, 0)
    }
  }
  const onToolMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!toolDrawing) return
    const pos = getCanvasPos(e)
    const ctx = getCtx()
    if (!ctx) return
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }
  const onToolMouseUp = () => {
    setToolDrawing(false)
  }

  // 动态生成纹理的逻辑
  const texture = useMemo(() => {
    console.log('Recalculating texture for patternId:', patternId)
    if (patternId === 'none') return null

    const currentPattern = patterns.find(p => p.id === patternId)
    console.log('Current pattern:', currentPattern)
    
    // 如果是图片类型的模块 (UGC)
    if (currentPattern?.type === 'image' && currentPattern.img) {
      console.log('Loading image texture...')
      const loader = new THREE.TextureLoader()
      const tex = loader.load(currentPattern.img, (t) => {
        console.log('Texture loaded successfully:', t)
        t.needsUpdate = true
      }, undefined, (err) => {
        console.error('Texture load failed:', err)
      })
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.colorSpace = THREE.SRGBColorSpace 
      return tex
    }

    // 如果是程序化生成的模块 (SVG/Canvas)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 背景色
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 512, 512)

    if (patternId === 'stripes') {
      // 绘制条纹
      ctx.fillStyle = stripeColor
      const stripeWidth = 40
      for (let i = 0; i < 512; i += stripeWidth * 2) {
        ctx.fillRect(i, 0, stripeWidth, 512)
      }
    } else if (patternId === 'plaid') {
      // 绘制格纹
      ctx.strokeStyle = stripeColor
      ctx.lineWidth = 20
      // 竖线
      for (let i = 20; i < 512; i += 80) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, 512)
        ctx.stroke()
      }
      // 横线
      for (let i = 20; i < 512; i += 80) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(512, i)
        ctx.stroke()
      }
    } else if (patternId === 'dots') {
      // 绘制波点
      ctx.fillStyle = stripeColor
      for (let x = 25; x < 512; x += 60) {
        for (let y = 25; y < 512; y += 60) {
          ctx.beginPath()
          ctx.arc(x, y, 15, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.needsUpdate = true
    return tex
  }, [color, stripeColor, patternId, patterns])

  // 获取当前选中的花型对象
  const currentPattern = patterns.find(p => p.id === patternId) || patterns[0]

  return (
    <div className="main-layout"
      onClick={() => setIsPatternMenuOpen(false)} // 点击其他地方关闭菜单
      style={selectedBrushColor ? { cursor: 'crosshair' } : {}}
    >
      {/* 顶部导航栏 */}
      <div className="top-bar">
        {/* 第一行：图标 + 标题 + 版本 */}
        <div className="title-row">
          <div className="app-icon">
            {/* 这里用一个简单的 CSS 图标或者 SVG 占位 */}
            <div className="icon-placeholder">🌸</div>
          </div>
          <span className="app-name-cn">兰花指</span>
          <span className="app-name-en">Orchid Gesture</span>
          <span className="app-version">v1.0.0</span>
        </div>
        
        {/* 第二行：菜单栏 */}
        <div className="menu-row">
          <div className="menu-item">文件 (File)</div>
          <div className="menu-item">编辑 (Edit)</div>
          <div className="menu-item">窗口 (Window)</div>
          <div className="menu-item">帮助 (Help)</div>
        </div>
      </div>

      <div className="app-container">
        {/* 左侧：资源库面板 */}
      <div className="left-panel">
        <div className="panel-header">
          <div className="panel-title">资源库 (Assets)</div>
        </div>
        
        <div className="panel-content">
          {/* 筛选器区域 */}
          <div className="filter-section">
            <div className="filter-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>一级分类</label>
                <button 
                  onClick={handleAddCategory}
                  className="btn-add-category"
                  title="添加新分类"
                >
                  +
                </button>
              </div>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>衣服类型</label>
              <select value={clothingType} onChange={(e) => setClothingType(e.target.value)}>
                <option value="all">全部类型</option>
                <option value="dress">连衣裙</option>
                <option value="top">上衣</option>
                <option value="skirt">半身裙</option>
              </select>
            </div>

            <div className="filter-group">
              <label>面料选择</label>
              <select value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                <option value="cotton">纯棉 (Cotton)</option>
                <option value="silk">丝绸 (Silk)</option>
                <option value="linen">亚麻 (Linen)</option>
                <option value="denim">丹宁 (Denim)</option>
              </select>
            </div>
          </div>

          <div className="divider"></div>

          {/* 列表区域：根据一级分类显示内容 */}
          {category === 'patterns' && (
            <div className="control-section">
              <div className="control-row">
                <div className="control-label">
                  <span>花型 (Pattern)</span>
                  <label className="btn-upload-mini">
                    上传
                    <input 
                      type="file" 
                      accept="image/*" 
                      hidden 
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
                
                {/* 自定义下拉菜单 */}
                <div className="custom-select-container" onClick={(e) => e.stopPropagation()}>
                  <div 
                    className="custom-select-trigger"
                    onClick={() => setIsPatternMenuOpen(!isPatternMenuOpen)}
                  >
                    <div className="selected-pattern-preview">
                      {currentPattern.img ? (
                        <div 
                          className="pattern-icon" 
                          style={{ backgroundImage: `url(${currentPattern.img})` }} 
                        />
                      ) : (
                        <div 
                          className="pattern-icon" 
                          style={{ background: currentPattern.id === 'none' ? '#eee' : 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzj//v37zajjxluIkiEZAQB9BAgehM72OAAAAABJRU5ErkJggg==)' }} 
                        />
                      )}
                      <span>{currentPattern.name}</span>
                    </div>
                    <div className="select-arrow">▼</div>
                  </div>

                  {isPatternMenuOpen && (
                    <div className="custom-select-options">
                      {patterns.map((p) => (
                        <div 
                          key={p.id}
                          className={`custom-option ${patternId === p.id ? 'selected' : ''}`}
                          onClick={() => {
                            setPatternId(p.id)
                            setIsPatternMenuOpen(false)
                          }}
                        >
                          {p.img ? (
                            <div 
                              className="pattern-icon" 
                              style={{ backgroundImage: `url(${p.img})` }} 
                            />
                          ) : (
                            <div 
                              className="pattern-icon" 
                              style={{ background: p.id === 'none' ? '#eee' : 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzj//v37zajjxluIkiEZAQB9BAgehM72OAAAAABJRU5ErkJggg==)' }} 
                            />
                          )}
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {category === 'clothes' && (
            <div className="empty-state">
              暂无服装模型<br/>
              <span style={{fontSize: '12px', color: '#999'}}>请先连接 MakeHuman 导入</span>
            </div>
          )}
        </div>
      </div>

      {/* 中间：3D 预览区 */}
      <div className="viewport-container">
        {/* 品牌浮层 - 顶部导航已包含品牌信息，此处可简化或仅保留视口信息 */}
        <div className="viewport-overlay">
          {/* <h1 className="brand-title">Orchid Gesture</h1>
          <div className="brand-subtitle">兰花指 FASHION DESIGN</div> */}
          <div className="brand-subtitle" style={{color: '#aaa'}}>User Perspective</div>
        </div>

        <Canvas camera={{ position: [0, 0, 40], fov: 45 }} gl={{ toneMappingExposure: 1.0 }}>
          <ambientLight intensity={0.7} />
          <spotLight 
            position={[30, 30, 30]} 
            angle={0.15} 
            penumbra={1} 
            intensity={1.0} 
            shadow-bias={-0.0001}
          />
          <pointLight position={[-15, -15, -15]} intensity={0.5} />
          {/* 使用本地 HDR 环境光，提升渲染质感 */}
          <Environment files="/textures/studio_small_09_1k.hdr" background={false} />
          
          <HumanModel 
            color={color}
            length={length}
            width={width}
            texture={texture}
            showTexture={patternId !== 'none'}
            onModelClick={handleModelClick}
            isDecal={patterns.find(p => p.id === patternId)?.type === 'image'}
            enablePlacement={patternId !== 'none'}
          />
          <OrbitControls 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 1.8}
            enablePan={false}
          />
          <ContactShadows position={[0, -20, 0]} opacity={0.4} scale={50} blur={2.5} far={4.5} />
        </Canvas>
      </div>

      {/* 右侧：属性面板 */}
      <div className="right-panel">
        <div className="panel-header">
          <div className="panel-title">属性 (Properties)</div>
        </div>

        <div className="panel-content">
          <div className="control-group">
            <div className="group-title">颜色选择 (Color)</div>
            <div className="color-palette">
              {presetColors.map(c => (
                <div 
                  key={c} 
                  className={`color-swatch ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
              <div className="color-input-wrapper">
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  title="自定义颜色"
                />
              </div>
            </div>
          </div>
          
          <div className="divider"></div>

          <div className="control-group">
            <div className="group-title">参数调整 (Parameters)</div>
            
            <div className="control-row">
              <div className="control-label">裙摆宽度</div>
              <input 
                type="range" 
                min="-5" max="5" step="0.1" 
                value={width} 
                onChange={(e) => setWidth(parseFloat(e.target.value))}
              />
              <span className="value-display">{width}</span>
            </div>

            <div className="control-row">
              <div className="control-label">裙长</div>
              <input 
                type="range" 
                min="-5" max="5" step="0.1" 
                value={length} 
                onChange={(e) => setLength(parseFloat(e.target.value))}
              />
              <span className="value-display">{length}</span>
            </div>
          </div>

          <div className="divider"></div>

          {/* 绘画工具面板 */}
          <div className="control-group">
             <div className="group-title">绘画工具 (Tools)</div>
             <div className="tools-grid">
               <button 
                 className={`tool-btn ${selectedTool === 'brush' ? 'active' : ''}`}
                 onClick={() => setSelectedTool('brush')}
                 title="画笔"
               >🖊️</button>
               <button 
                 className={`tool-btn ${selectedTool === 'circle' ? 'active' : ''}`}
                 onClick={() => setSelectedTool('circle')}
                 title="圆形"
               >⭕</button>
               <button 
                 className={`tool-btn ${selectedTool === 'square' ? 'active' : ''}`}
                 onClick={() => setSelectedTool('square')}
                 title="方形"
               >⬛</button>
               <button 
                 className={`tool-btn ${selectedTool === 'line' ? 'active' : ''}`}
                 onClick={() => setSelectedTool('line')}
                 title="直线"
               >📏</button>
               <button 
                 className={`tool-btn ${selectedTool === 'wand' ? 'active' : ''}`}
                 onClick={() => setSelectedTool('wand')}
                 title="魔棒"
               >🪄</button>
             </div>
             
             <div className="control-row" style={{marginTop: '10px'}}>
               <div className="control-label">画笔大小</div>
               <input 
                 type="range" 
                 min="1" max="100" 
                 value={toolSize} 
                 onChange={(e) => setToolSize(parseInt(e.target.value))}
               />
               <span className="value-display">{toolSize}</span>
             </div>

             <div className="control-row">
               <div className="control-label">画笔颜色</div>
               <div className="color-palette mini">
                 {presetColors.slice(0, 8).map(c => (
                   <div 
                     key={c} 
                     className={`color-swatch ${selectedBrushColor === c ? 'active' : ''}`}
                     style={{ backgroundColor: c, width: '20px', height: '20px' }}
                     onClick={() => setSelectedBrushColor(c)}
                   />
                 ))}
                 <input 
                   type="color" 
                   value={selectedBrushColor || '#000000'}
                   onChange={(e) => setSelectedBrushColor(e.target.value)}
                   style={{width: '24px', height: '24px', padding: 0}}
                 />
               </div>
             </div>

             <div className="canvas-wrapper">
               <canvas 
                 ref={toolCanvasRef}
                 width={512}
                 height={512}
                 className="drawing-canvas"
                 onMouseDown={onToolMouseDown}
                 onMouseMove={onToolMouseMove}
                 onMouseUp={onToolMouseUp}
                 onMouseLeave={onToolMouseUp}
               />
               <button className="btn-apply" onClick={handleApplyToolTexture}>
                 应用到模型
               </button>
             </div>
          </div>

        </div>
      </div>
      </div>
    </div>
  )
}

export default App
