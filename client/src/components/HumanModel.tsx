import React, { useEffect, useRef } from 'react'
import { useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

interface HumanModelProps {
  color: string
  length: number // 暂时未用，将来映射到身高
  width: number  // 暂时未用，将来映射到胖瘦
  texture: THREE.Texture | null
  showTexture: boolean
  onModelClick?: () => void
}

// 记录每个部件的材质状态
interface PartState {
  color: string
  texture: THREE.Texture | null
  showTexture: boolean
}

export function HumanModel({ color, length, width, texture, showTexture, onModelClick }: HumanModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/plmxs.glb')
  
  // 使用状态来存储每个部件的样式，初始为空
  const [partStates, setPartStates] = React.useState<Record<string, PartState>>({})

  // 克隆场景以避免因为多次加载导致的引用问题
  const clonedScene = React.useMemo(() => scene.clone(), [scene])

  // 辅助函数：判断是否为身体部件（不应被染色）
  const isBodyPart = (name: string) => {
    const n = name.toLowerCase()
    return n.includes('body') || 
           n.includes('base') || 
           n.includes('skin') || 
           n.includes('high-poly') || // MakeHuman 身体网格常见名称
           n.includes('eye') || 
           n.includes('teeth') || 
           n.includes('tongue') ||
           n.includes('lash') ||
           n.includes('brow') ||
           n.includes('hair') ||    // 头发
           n.includes('ponytail') || // 马尾
           n.includes('plmxs') ||    // 模型核心部件（可能是眼睛或基础网格）
           n.includes('gawen')       // 可能是头发或特定部件，先排除
  }
  const isSkinMesh = (name: string) => {
    const n = name.toLowerCase()
    return n.includes('high-poly') || n.includes('body') || n.includes('skin') || n.includes('plmxs')
  }

  // 1. 初始化模型处理（仅执行一次：平滑法线、标记部件）
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const applyEnvIntensity = (mat: any) => {
          if (mat && typeof mat.envMapIntensity === 'number') {
            mat.envMapIntensity = 0.35
          }
        }
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(applyEnvIntensity)
        } else {
          applyEnvIntensity(mesh.material as any)
        }
        if (isSkinMesh(mesh.name)) {
          // 强制克隆材质，断开与其他部件的连接
          if (mesh.material) {
             const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
             const newSkinMat = oldMat.clone()
             mesh.material = newSkinMat
          }
          
          const setOpaque = (mat: any) => {
            if (!mat) return
            mat.transparent = false
            mat.opacity = 1
            mat.depthTest = true
            mat.depthWrite = true
            mat.side = THREE.FrontSide
            if (typeof mat.metalness === 'number') mat.metalness = 0
            if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.8, mat.roughness || 0.8)
            if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.5
          }
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(setOpaque)
          } else {
            setOpaque(mesh.material as any)
          }
          return
        }
        if (isBodyPart(mesh.name)) return

        // 尝试优化几何体以支持平滑着色
        if (!mesh.userData.isSmoothed) {
           if (!mesh.geometry.attributes.normal) {
              mesh.geometry.computeVertexNormals()
           }
           try {
              const mergedGeometry = BufferGeometryUtils.mergeVertices(mesh.geometry)
              mergedGeometry.computeVertexNormals()
              mesh.geometry = mergedGeometry
              mesh.userData.isSmoothed = true
           } catch (e) {
              console.warn('Failed to merge vertices:', e)
              mesh.geometry.computeVertexNormals()
           }
        }
      }
    })
  }, [clonedScene])

  // 2. 响应外部状态变化，更新模型材质
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (isBodyPart(mesh.name)) return

        // 获取当前部件的状态，如果没有单独设置过，就用默认的
        // 注意：这里的逻辑改为“只有点击过的才变色”，初始保持原色（白色）
        const state = partStates[mesh.name]
        
        // 如果该部件有独立状态，就应用它的状态
        if (state) {
            const newMaterial = new THREE.MeshStandardMaterial({
              color: state.showTexture ? 'white' : state.color,
              map: state.texture,
              roughness: 0.5,
              metalness: 0.1,
              envMapIntensity: 0.35,
              side: THREE.DoubleSide,
              skinning: true,
              flatShading: false
            })
            mesh.material = newMaterial
        } else {
             // 默认材质（可以给个初始白色或保持原样）
             // 这里为了统一，给一个默认的白色材质
             const defaultMaterial = new THREE.MeshStandardMaterial({
                color: 'white', 
                roughness: 0.5,
                metalness: 0.1,
                envMapIntensity: 0.35,
                side: THREE.DoubleSide,
                skinning: true,
                flatShading: false
             })
             mesh.material = defaultMaterial
        }
      }
    })
  }, [clonedScene, partStates]) // 依赖 partStates

  return (
    // 位置已锁定：[0, 0, 0] 绝对居中，绝不改变
    <group ref={group} dispose={null} position={[0, 0, 0]}>
      <Center>
        <primitive 
          object={clonedScene} 
          // 缩放已锁定：[19, 19, 19] 完美大小，绝不改变
          scale={[19, 19, 19]} 
          onClick={(e: any) => {
            e.stopPropagation()
            const meshName = e.object.name
            
            console.log('Clicked mesh:', meshName, 'Is Body Part:', isBodyPart(meshName))

            // 点击身体部件时不触发染色
            if (!isBodyPart(meshName)) {
                // 仅更新被点击部件的状态
                setPartStates(prev => ({
                    ...prev,
                    [meshName]: {
                        color: color,
                        texture: texture,
                        showTexture: showTexture
                    }
                }))
                
                onModelClick && onModelClick()
            }
          }}
        />
      </Center>
    </group>
  )
}

// 预加载模型，避免切换时卡顿
useGLTF.preload('/models/plmxs.glb')
