import React, { useState, useMemo } from 'react'
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
  const [patterns, setPatterns] = useState([
    { id: 'none', name: '纯色基础款', type: 'solid', img: null },
    { id: 'stripes', name: '经典双色夹条', type: 'svg', img: null },
    { id: 'plaid', name: '苏格兰格纹', type: 'svg', img: null },
    { id: 'dots', name: '波点印花', type: 'svg', img: null },
  ])

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imgUrl = event.target?.result as string
      const newPattern = {
        id: `custom-${Date.now()}`,
        name: file.name, // 使用原始文件名
        type: 'image',
        img: imgUrl
      }
      setPatterns(prev => [...prev, newPattern])
      setPatternId(newPattern.id) // 自动选中新上传的
    }
    reader.readAsDataURL(file)
  }

  // 动态生成纹理的逻辑
  const texture = useMemo(() => {
    if (patternId === 'none') return null

    const currentPattern = patterns.find(p => p.id === patternId)
    
    // 如果是图片类型的模块 (UGC)
    if (currentPattern?.type === 'image' && currentPattern.img) {
      const loader = new THREE.TextureLoader()
      const tex = loader.load(currentPattern.img)
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.colorSpace = THREE.SRGBColorSpace // 修正颜色空间
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
  }, [color, stripeColor, patternId])

  // 获取当前选中的花型对象
  const currentPattern = patterns.find(p => p.id === patternId) || patterns[0]

  return (
    <div 
      className={`app-container ${selectedBrushColor ? 'cursor-paint' : ''}`}
      style={selectedBrushColor ? { cursor: 'crosshair' } : {}}
      onClick={() => setIsPatternMenuOpen(false)} // 点击其他地方关闭菜单
    >
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
        {/* 品牌浮层 */}
        <div className="viewport-overlay">
          <h1 className="brand-title">Orchid Gesture</h1>
          <div className="brand-subtitle">3D Fashion Design</div>
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
          />
          <OrbitControls 
            enablePan={false} 
            minPolarAngle={Math.PI / 2 - (70 * Math.PI / 180)} /* 俯视最大 70 度 (从水平面向上) */
            maxPolarAngle={Math.PI / 2 + (70 * Math.PI / 180)} /* 仰视最大 70 度 (从水平面向下) */
            minDistance={10} 
            maxDistance={100} 
            enableDamping={true} /* 开启阻尼，让旋转更有质感 */
            dampingFactor={0.05}
            target={[0, 0, 0]} /* 视角中心调整到人体中部 */
          />
        </Canvas>
      </div>

      {/* 右侧：控制面板 */}
      <div className="control-panel">
        <div className="panel-header">
          <div className="panel-title">调色板 (Palette)</div>
          {selectedBrushColor && (
             <button 
               className="btn-cancel-brush"
               onClick={() => setSelectedBrushColor(null)}
             >
               取消 (ESC)
             </button>
          )}
        </div>

        <div className="panel-content">
          <div className="color-grid-container">
            {presetColors.map((c) => (
              <div
                key={c}
                className={`color-cell ${selectedBrushColor === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setSelectedBrushColor(c)}
                title={c}
              />
            ))}
          </div>
          
          <div className="instruction-text">
            {selectedBrushColor 
              ? `已吸附颜色: ${selectedBrushColor}，点击模型上色` 
              : '点击颜色块吸附颜色'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
