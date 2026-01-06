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
  const [patternId, setPatternId] = useState('stripes') // 当前选中的模块ID

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
        name: '自定义花型', // 实际项目中可以是文件名
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

  return (
    <div className="app-container">
      {/* 左侧：3D 预览区 */}
      <div className="viewport-container">
        {/* 品牌浮层 */}
        <div className="viewport-overlay">
          <h1 className="brand-title">Orchid Gesture</h1>
          <div className="brand-subtitle">3D Fashion Design</div>
        </div>

        <Canvas shadows camera={{ position: [0, 0, 40], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <spotLight 
            position={[30, 30, 30]} 
            angle={0.15} 
            penumbra={1} 
            intensity={1} 
            castShadow 
            shadow-bias={-0.0001}
          />
          <pointLight position={[-15, -15, -15]} intensity={0.5} />
          <React.Suspense fallback={null}>
            <Environment preset="city" />
          </React.Suspense>
          <HumanModel 
            color={color}
            length={length}
            width={width}
            texture={texture}
            showTexture={patternId !== 'none'}
          />
          <ContactShadows 
            position={[0, -3, 0]} 
            opacity={0.4} 
            scale={20} 
            blur={2} 
            far={10} 
            resolution={256} 
            color="#000000" 
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
          <div className="panel-title">设计参数</div>
          <div style={{ fontSize: '12px', color: '#666' }}>V1.0.0</div>
        </div>

        <div className="panel-content">
          {/* 1. 模块库选择 */}
          <div className="panel-section">
            <div className="section-title">
              <span>模块库 (Patterns)</span>
              <label className="btn-upload">
                + 上传模块
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            
            <div className="pattern-grid">
              {patterns.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => setPatternId(p.id)}
                  className={`pattern-item ${patternId === p.id ? 'active' : ''}`}
                >
                  {p.img ? (
                    <div 
                      className="pattern-preview" 
                      style={{ backgroundImage: `url(${p.img})`, opacity: 0.8 }} 
                    />
                  ) : (
                    <div className="pattern-preview" style={{ background: p.id === 'none' ? '#eee' : 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzj//v37zajjxluIkiEZAQB9BAgehM72OAAAAABJRU5ErkJggg==)' }} />
                  )}
                  <div className="pattern-name">{p.name}</div>
                  <div className="pattern-type">{p.type.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. 配色控制 */}
          <div className="panel-section">
            <div className="section-title">精细改色 (Color Mapping)</div>
            
            <div className="control-row">
              <div className="control-label">
                <span>底色 (Base)</span>
                <span className="control-value">{color}</span>
              </div>
              <div className="color-picker-wrapper">
                <input 
                  type="color" 
                  value={color} 
                  onChange={(e) => setColor(e.target.value)}
                />
                <span style={{ fontSize: '13px', color: '#666' }}>点击色块选择</span>
              </div>
            </div>

            {patternId !== 'none' && (
              <div className="control-row">
                <div className="control-label">
                  <span>花型色 (Pattern)</span>
                  <span className="control-value">{stripeColor}</span>
                </div>
                <div className="color-picker-wrapper">
                  <input 
                    type="color" 
                    value={stripeColor} 
                    onChange={(e) => setStripeColor(e.target.value)}
                  />
                  <span style={{ fontSize: '13px', color: '#666' }}>点击色块选择</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. 版型微调 */}
          <div className="panel-section">
            <div className="section-title">版型微调 (Shape Keys)</div>
            
            <div className="control-row">
              <div className="control-label">
                <span>裙长 (Length)</span>
                <span className="control-value">{length.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="-0.5" 
                max="1.0" 
                step="0.1" 
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value))}
              />
            </div>

            <div className="control-row">
              <div className="control-label">
                <span>裙摆宽度 (Width)</span>
                <span className="control-value">{width.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1.5" 
                step="0.1" 
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App