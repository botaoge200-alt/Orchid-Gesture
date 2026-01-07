import React, { useEffect, useRef, useState } from 'react'
import { Center, useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MODEL_CONFIG } from '../config'

interface HumanModelProps {
  activeTab?: string
  selectedPart?: string
  wardrobe: Record<string, {
    color: string
    texture: THREE.Texture | null
    textureId: string
    roughness?: number
    metalness?: number
    scale?: number
    textureRepeat?: [number, number]
    textureOffset?: [number, number]
  }>
  sculptSettings?: {
    radius: number
    intensity: number
    symmetry: boolean
    wireframe?: boolean
  }
  onModelClick?: () => void
  onHover?: (name: string) => void
}

export function HumanModel({ activeTab, selectedPart, wardrobe, sculptSettings, onModelClick, onHover }: HumanModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/plmxs.glb')
  const { camera, gl, controls } = useThree()
  
  const clonedScene = React.useMemo(() => scene.clone(), [scene])

  // 监听线框模式
  useEffect(() => {
    if (!clonedScene) return
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const material = mesh.material as THREE.MeshStandardMaterial
        if (material) {
          material.wireframe = !!sculptSettings?.wireframe
        }
      }
    })
  }, [clonedScene, sculptSettings?.wireframe])

  // --- 雕刻相关状态 ---
  const [isSculpting, setIsSculpting] = useState(false)
  
  const activeMeshRef = useRef<THREE.Mesh | null>(null)
  const affectedVerticesRef = useRef<{index: number, weight: number}[]>([])
  const affectedMirrorVerticesRef = useRef<{index: number, weight: number}[]>([])
  const lastPointRef = useRef(new THREE.Vector3())
  const planeRef = useRef(new THREE.Plane())
  const raycasterRef = useRef(new THREE.Raycaster())

  const handlePointerDown = (e: any) => {
    if (activeTab !== 'modeling' || !sculptSettings) return
    e.stopPropagation()
    
    // 禁用控制器
    if (controls) (controls as any).enabled = false

    const mesh = e.object as THREE.Mesh
    if (!mesh.isMesh) return

    setIsSculpting(true)
    activeMeshRef.current = mesh
    lastPointRef.current.copy(e.point)

    // 创建一个面向摄像机的平面，用于计算拖拽
    const normal = new THREE.Vector3()
    camera.getWorldDirection(normal)
    planeRef.current.setFromNormalAndCoplanarPoint(normal, e.point)

    // 查找受影响的顶点
    const geometry = mesh.geometry
    const posAttribute = geometry.attributes.position
    const vertex = new THREE.Vector3()
    const worldMatrix = mesh.matrixWorld
    const inverseMatrix = mesh.matrixWorld.clone().invert()

    // 将点击点转为局部坐标
    const localPoint = e.point.clone().applyMatrix4(inverseMatrix)
    
    // 查找对称点 (假设模型关于X轴对称)
    const mirrorLocalPoint = localPoint.clone()
    mirrorLocalPoint.x = -mirrorLocalPoint.x

    const vertices: {index: number, weight: number}[] = []
    const mirrorVertices: {index: number, weight: number}[] = []
    
    // 半径转为局部空间 (考虑世界缩放)
    const worldScale = new THREE.Vector3()
    mesh.getWorldScale(worldScale)
    const localRadius = sculptSettings.radius / worldScale.x 

    for (let i = 0; i < posAttribute.count; i++) {
      vertex.fromBufferAttribute(posAttribute, i)
      
      const dist = vertex.distanceTo(localPoint)
      if (dist < localRadius) {
        // 使用平滑衰减函数 (SmoothStep-like)
        const t = dist / localRadius
        const weight = Math.pow(1 - t, 2) // 二次衰减
        vertices.push({ index: i, weight })
      }

      if (sculptSettings.symmetry) {
        const mirrorDist = vertex.distanceTo(mirrorLocalPoint)
        if (mirrorDist < localRadius) {
           const t = mirrorDist / localRadius
           const weight = Math.pow(1 - t, 2)
           mirrorVertices.push({ index: i, weight })
        }
      }
    }
    
    affectedVerticesRef.current = vertices
    affectedMirrorVerticesRef.current = mirrorVertices
  }

  const handlePointerMove = (e: any) => {
    if (!isSculpting || !activeMeshRef.current || !sculptSettings) return
    e.stopPropagation()

    // 计算当前鼠标在平面上的投影位置
    const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
    )
    raycasterRef.current.setFromCamera(mouse, camera)
    const intersectPoint = new THREE.Vector3()
    raycasterRef.current.ray.intersectPlane(planeRef.current, intersectPoint)

    if (intersectPoint) {
       const delta = intersectPoint.clone().sub(lastPointRef.current)
       
       // 将 delta 转为局部空间
       const inverseMatrix = activeMeshRef.current.matrixWorld.clone().invert()
       
       // 正确的坐标转换方式：将世界坐标点转为局部坐标点，然后相减
       const localCurrent = intersectPoint.clone().applyMatrix4(inverseMatrix)
       const localLast = lastPointRef.current.clone().applyMatrix4(inverseMatrix)
       const localDelta = localCurrent.sub(localLast)
       
       const geometry = activeMeshRef.current.geometry
       const posAttribute = geometry.attributes.position
       const intensity = sculptSettings.intensity

       // 应用变形
       affectedVerticesRef.current.forEach(v => {
           const x = posAttribute.getX(v.index)
           const y = posAttribute.getY(v.index)
           const z = posAttribute.getZ(v.index)
           
           posAttribute.setXYZ(
               v.index,
               x + localDelta.x * v.weight * intensity,
               y + localDelta.y * v.weight * intensity,
               z + localDelta.z * v.weight * intensity
           )
       })

       // 应用对称变形 (X轴反向)
       if (sculptSettings.symmetry) {
           const mirrorDelta = localDelta.clone()
           mirrorDelta.x = -mirrorDelta.x // 镜像移动
           
           affectedMirrorVerticesRef.current.forEach(v => {
               const x = posAttribute.getX(v.index)
               const y = posAttribute.getY(v.index)
               const z = posAttribute.getZ(v.index)
               
               posAttribute.setXYZ(
                   v.index,
                   x + mirrorDelta.x * v.weight * intensity,
                   y + mirrorDelta.y * v.weight * intensity,
                   z + mirrorDelta.z * v.weight * intensity
               )
           })
       }

       posAttribute.needsUpdate = true
       // geometry.computeVertexNormals() // 实时计算法线太慢，可以在 Up 时计算
       
       lastPointRef.current.copy(intersectPoint)
    }
  }

  const handlePointerUp = (e: any) => {
    if (isSculpting) {
       setIsSculpting(false)
       if (controls) (controls as any).enabled = true
       
       // 拖拽结束后重新计算法线
       if (activeMeshRef.current) {
           activeMeshRef.current.geometry.computeVertexNormals()
       }
       activeMeshRef.current = null
    }
  }

  // 全局监听 pointer up/move (防止鼠标移出模型)
  useEffect(() => {
      const onUp = (e: PointerEvent) => handlePointerUp(e)
      const onMove = (e: PointerEvent) => {
          if (isSculpting) {
             // 我们需要手动构建一个类似 r3f event 的对象，或者简化处理
             // 这里使用 R3F 的 useThree 获取的 raycaster 手动投射有点麻烦
             // 简单的方案：在 mesh 上监听 onPointerMove。
             // 但是如果鼠标移出 mesh，拖拽应该继续。
             // 这是一个常见问题。通常在 window 上监听。
             // 但是我们需要 raycast。
             // 让我们依赖 mesh 的 onPointerMove 吧，只要 mesh 足够大或者捕捉指针。
             // e.target.setPointerCapture 可以解决。
          }
      }
      // window.addEventListener('pointerup', onUp)
      // return () => window.removeEventListener('pointerup', onUp)
  }, [isSculpting])


  // 辅助函数：判断是否为身体部件（不应被染色）

  const isBodyPart = (name: string) => {
    const n = name.toLowerCase()
    return n.includes('body') || 
           n.includes('base') || 
           n.includes('skin') || 
           n.includes('high-poly') || 
           n.includes('eye') || 
           n.includes('teeth') || 
           n.includes('tongue') ||
           n.includes('lash') ||
           n.includes('brow') ||
           n.includes('hair') ||    // 头发单独处理
           n.includes('ponytail') ||
           n.includes('plmxs') ||    
           n.includes('gawen')       
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
        
        // 保存原始缩放比例 (仅一次)
        if (!mesh.userData.originalScale) {
          mesh.userData.originalScale = mesh.scale.clone()
        }

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
          // 皮肤处理逻辑保持不变
          try {
             mesh.geometry.deleteAttribute('normal')
             mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry)
             mesh.geometry.computeVertexNormals()
          } catch (e) {
             console.warn('Geometry merge failed for:', mesh.name, e)
             mesh.geometry.computeVertexNormals()
          }
          if (mesh.material) {
             const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
             const newSkinMat = oldMat.clone()
             newSkinMat.flatShading = false 
             mesh.material = newSkinMat
          }
          const setOpaque = (mat: any) => {
            if (!mat) return
            mat.transparent = false
            mat.opacity = 1
            mat.depthTest = true
            mat.depthWrite = true
            mat.side = THREE.FrontSide
            mat.flatShading = false 
            if (typeof mat.metalness === 'number') mat.metalness = 0
            if (typeof mat.roughness === 'number') mat.roughness = Math.max(0.5, mat.roughness || 0.5) 
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

  // 2. 响应 wardrobe 状态变化，更新模型材质
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const meshName = mesh.name.toLowerCase()

        // 定义部位映射关系，根据实际 GLB 内部 Mesh 名称
        const partMapping: Record<string, string[]> = {
          'top': ['crudefemaletshirt', 'shirt', 'top'],
          'bottom': ['elvs_zombiekiller_pant1', 'pant', 'trousers', 'jeans'],
          'shoes': ['shoes01', 'shoe', 'boot'],
          'hat': ['fedora_cocked', 'fedora', 'hat', 'cap'],
          'dress': ['plmxs', 'body', 'skin'], // 身体作为全身/dress处理
          'hair': ['ponytail01', 'hair', 'ponytail'],
          'accessory': ['eyebrow', 'eyelash']
        }

        // 查找当前 mesh 属于哪个部位
        let matchedPartId: string | null = null
        
        for (const [partId, keywords] of Object.entries(partMapping)) {
          if (keywords.some(k => meshName.includes(k))) {
            matchedPartId = partId
            break
          }
        }

        // 如果找到了对应的部位配置
        if (matchedPartId && wardrobe[matchedPartId]) {
          const style = wardrobe[matchedPartId]
          const showTexture = !!style.texture

          // 应用形状缩放 (基于原始缩放比例)
          if (style.scale !== undefined && mesh.userData.originalScale) {
             mesh.scale.copy(mesh.userData.originalScale).multiplyScalar(style.scale)
          }

          // 应用纹理变换
          if (showTexture && style.texture) {
             style.texture.wrapS = style.texture.wrapT = THREE.RepeatWrapping
             if (style.textureRepeat) {
                 style.texture.repeat.set(style.textureRepeat[0], style.textureRepeat[1])
             }
             if (style.textureOffset) {
                 style.texture.offset.set(style.textureOffset[0], style.textureOffset[1])
             }
             style.texture.needsUpdate = true
          }

          const newMaterial = new THREE.MeshStandardMaterial({
               color: showTexture ? 'white' : style.color,
               map: showTexture ? style.texture : null,
               transparent: true, // 允许透明
               alphaTest: 0.5,    // 允许镂空
               roughness: style.roughness !== undefined ? style.roughness : 0.6,
               metalness: style.metalness !== undefined ? style.metalness : 0.0,
               envMapIntensity: 0.35,
               side: THREE.DoubleSide,
               skinning: true,
               flatShading: false
           })
           
           // 高亮选中部位 (仅在材质模式下)
           if (activeTab === 'materials' && selectedPart === matchedPartId) {
             newMaterial.emissive.setHex(0x333333)
           } else {
             newMaterial.emissive.setHex(0x000000)
           }

           mesh.material = newMaterial
         }
       }
     })
  }, [clonedScene, wardrobe, activeTab, selectedPart]) // 依赖整个 wardrobe 对象及选中状态

  return (
    <group ref={group} dispose={null} position={[0, 0, 0]}>
      <Center position={MODEL_CONFIG.MODEL_OFFSET}>
        <primitive 
          object={clonedScene} 
          scale={MODEL_CONFIG.MODEL_SCALE} 
          onClick={(e: any) => {
            if (activeTab === 'modeling') return // 建模模式下不触发点击选择
            e.stopPropagation()
            const meshName = e.object.name
            console.log('Clicked mesh:', meshName)
            onModelClick && onModelClick()
          }}
          onPointerDown={(e: any) => {
            if (activeTab === 'modeling') {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              handlePointerDown(e);
            }
          }}
          onPointerMove={(e: any) => {
             if (activeTab === 'modeling') handlePointerMove(e);
          }}
          onPointerUp={(e: any) => {
             if (activeTab === 'modeling') {
               (e.target as HTMLElement).releasePointerCapture(e.pointerId);
               handlePointerUp(e);
             }
          }}
          onPointerOver={(e: any) => {
            if (activeTab === 'modeling' && onHover) {
              e.stopPropagation()
              onHover(e.object.name || 'Unnamed Mesh')
            }
          }}
          onPointerOut={(e: any) => {
             if (activeTab === 'modeling' && onHover) {
                onHover('')
             }
          }}
        />
      </Center>
    </group>
  )
}
