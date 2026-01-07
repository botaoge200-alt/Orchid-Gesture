import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useGLTF, Center, Decal, Html, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { createPortal, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

interface HumanModelProps {
  color: string
  length: number
  width: number
  texture: THREE.Texture | null
  showTexture: boolean
  isDecal?: boolean
  enablePlacement?: boolean
  onModelClick?: () => void
}

// 记录每个部件的材质状态
interface PartState {
  color: string
  texture: THREE.Texture | null
  showTexture: boolean
}

export function HumanModel({ color, length, width, texture, showTexture, isDecal, enablePlacement, onModelClick }: HumanModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/plmxs.glb')
  const { gl, camera } = useThree()
  const decalRef = useRef<THREE.Mesh>(null)
  
  // Clone scene
  const clonedScene = useMemo(() => scene.clone(), [scene])
  
  const [targetMesh, setTargetMesh] = useState<THREE.Mesh | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...')
  const [decalPos, setDecalPos] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
  const [decalScale, setDecalScale] = useState<THREE.Vector3>(new THREE.Vector3(1, 1, 1))
  const [decalRot, setDecalRot] = useState<THREE.Euler>(new THREE.Euler(0, Math.PI, 0))
  
  // 使用状态来存储每个部件的样式，初始为空
  const [partStates, setPartStates] = React.useState<Record<string, PartState>>({})

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

  // Decal Placement Logic
  const placeDecalAtIntersection = (mesh: THREE.Mesh, worldPoint: THREE.Vector3, faceIndex: number | null) => {
    const bm = targetMesh || mesh
    setTargetMesh(bm)
    const geom = bm.geometry as THREE.BufferGeometry
    const index = geom.index
    const posAttr = geom.attributes.position as THREE.BufferAttribute
    const hitPointLocal = worldPoint.clone()
    bm.worldToLocal(hitPointLocal)
    let normalLocal = new THREE.Vector3(0, 0, 1)
    if (index && posAttr && faceIndex !== null) {
      const i0 = index.getX(faceIndex * 3)
      const i1 = index.getX(faceIndex * 3 + 1)
      const i2 = index.getX(faceIndex * 3 + 2)
      const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0)
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1)
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2)
      const triNormal = new THREE.Vector3()
      THREE.Triangle.getNormal(v0, v1, v2, triNormal)
      normalLocal.copy(triNormal).normalize()
    }
    const offsetOut = 0.5 // 稍微大一点的偏移，防止 z-fighting
    const pos = hitPointLocal.clone().add(normalLocal.clone().multiplyScalar(offsetOut))
    
    // 计算包围盒以确定胸口高度 (作为参考，如果点击失败)
    bm.geometry.computeBoundingBox()
    const bbox = bm.geometry.boundingBox
    // 如果是点击触发，直接使用点击位置 pos.y，不需要强制覆盖为胸口高度
    // const h = bbox ? bbox.max.y - bbox.min.y : 1.8
    // const chestY = bbox ? bbox.min.y + h * 0.55 : pos.y
    // pos.y = chestY 

    const lookDir = normalLocal.clone().normalize()
    const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), lookDir, new THREE.Vector3(0, 1, 0))
    const quat = new THREE.Quaternion().setFromRotationMatrix(lookMat)
    const baseEuler = new THREE.Euler().setFromQuaternion(quat, 'XYZ')
    const rot = new THREE.Euler(baseEuler.x, baseEuler.y, baseEuler.z + Math.PI / 2)
    
    setDecalPos(pos)
    setDecalRot(rot)
    
    // 设置一个合理的初始大小 (相对于模型尺寸)
    // 假设模型缩放为 19，这里给一个相对值
    setDecalScale(new THREE.Vector3(4, 4, 4)) 
  }

  const onPointerDown = (e: any) => {
    if (!enablePlacement || !isDecal || !showTexture) return
    e.stopPropagation()
    // Primary: use event-provided intersection
    const obj = e.object as THREE.Object3D
    const mesh = (obj as THREE.Mesh)
    const point = e.point as THREE.Vector3
    const faceIndex = typeof e.faceIndex === 'number' ? e.faceIndex : null
    if (mesh && point) {
      placeDecalAtIntersection(mesh, point, faceIndex)
      return
    }
    // Fallback: global raycast from camera to pointer
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObject(clonedScene, true)
    if (hits.length > 0) {
      const h = hits[0]
      const hMesh = h.object as THREE.Mesh
      const hPoint = h.point as THREE.Vector3
      const hFace = typeof h.faceIndex === 'number' ? h.faceIndex : null
      placeDecalAtIntersection(hMesh, hPoint, hFace)
    }
  }

  // 1. 初始化模型处理（几何体优化 + 寻找最佳投射 Mesh）
  useEffect(() => {
    let bestMesh: THREE.Mesh | null = null;
    let maxVertices = 0;

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        
        // --- 远程逻辑：几何体优化 ---
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
          // 强制合并顶点以消除由于顶点分裂导致的硬边
          try {
             mesh.geometry.deleteAttribute('normal')
             mesh.geometry = BufferGeometryUtils.mergeVertices(mesh.geometry)
             mesh.geometry.computeVertexNormals()
          } catch (e) {
             console.warn('Geometry merge failed for:', mesh.name, e)
             mesh.geometry.computeVertexNormals()
          }
          // 强制克隆材质，断开与其他部件的连接
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
        } else if (!isBodyPart(mesh.name)) {
           // 衣服等部件优化
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
        // ---------------------------

        // --- 本地逻辑：寻找最佳投射 Mesh ---
        const vertexCount = mesh.geometry.attributes.position.count
        // Find body (most vertices)
        if (vertexCount > maxVertices) {
          maxVertices = vertexCount
          bestMesh = mesh
        }
      }
    })
    
    // 设置初始 Target Mesh
    setTargetMesh(bestMesh)

    // 初始化 Decal 位置 (如果还没设置过)
    if (bestMesh) {
      const bm = bestMesh as THREE.Mesh;
      // 基于远程的 scale=19，我们需要一个合适的初始位置
      // 假设模型中心在原点，胸口大概在 y=1.5 (如果scale=1) -> y=28.5 (如果scale=19)
      // 但这里我们是在 local space 操作 Decal，因为 Decal 是 portal 到 targetMesh 上的。
      // Wait: createPortal(..., targetMesh) 意味着 Decal 成为 targetMesh 的子对象。
      // 所以 Decal 的 position/scale 应该是相对于 targetMesh 的 local space。
      // 远程代码中 primitive scale=[19,19,19]，意味着 targetMesh 也被缩放了 19 倍。
      // 如果我们把 Decal 加为 targetMesh 的子对象，Decal 也会继承这个 19 倍缩放。
      // 所以 Decal 的 local scale 应该保持小数值 (比如 1)，最终显示出来就是 19。
      
      // 但是，Decal 组件本身通常是 World Space 的投影，或者它需要正确的大小。
      // 让我们看看之前本地成功的经验：
      // 之前是 scaleFactor > 10 ? 100 : 1。
      // 远程模型看起来是 CM 单位或者单纯放大。
      
      // 重新计算初始位置
      bm.geometry.computeBoundingBox();
      const bbox = bm.geometry.boundingBox;
      if (bbox) {
          const h = bbox.max.y - bbox.min.y;
          const chestY = bbox.min.y + h * 0.55;
          const initialPos = new THREE.Vector3(0, chestY, 0.5); // 0.5 forward offset
          
          setDecalPos(initialPos);
          // 初始大小，相对于模型
          setDecalScale(new THREE.Vector3(4, 4, 4)); 
          setDecalRot(new THREE.Euler(0, 0, 0));
      }
    }
    
    setDebugInfo(`Vertices: ${maxVertices}`)
    
  }, [clonedScene])

  // 2. 响应外部状态变化，更新模型材质 (远程逻辑)
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (isBodyPart(mesh.name)) return

        // 获取当前部件的状态
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
             // 默认材质
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
  }, [clonedScene, partStates, isBodyPart])

  return (
    <>
      <group ref={group} dispose={null} position={[0, 0, 0]}>
        <Center>
          <primitive 
            object={clonedScene} 
            scale={[19, 19, 19]} 
            onClick={(e: any) => {
              // 优先处理点击交互 (分部件染色)
              if (!enablePlacement) {
                  e.stopPropagation()
                  const meshName = e.object.name
                  console.log('Clicked mesh:', meshName, 'Is Body Part:', isBodyPart(meshName))
                  if (!isBodyPart(meshName)) {
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
              }
            }}
            onPointerDown={(e: any) => {
                // 处理 Decal 放置
                if (enablePlacement) {
                    onPointerDown(e)
                }
            }}
          />
          
          {/* Decal Rendering */}
          {enablePlacement && targetMesh && createPortal(
            <>
              <Decal
                position={decalPos} 
                rotation={decalRot}
                scale={decalScale}
                debug={false} // 关闭 debug 框
                ref={decalRef as any}
              >
                <meshBasicMaterial 
                    map={isDecal ? texture : null}
                    color={isDecal ? 'white' : 'magenta'} // 如果没有纹理，显示洋红
                    transparent 
                    opacity={0.9} 
                    polygonOffset 
                    polygonOffsetFactor={-10} 
                    depthTest={false} 
                    depthWrite={false} 
                />
              </Decal>
              {decalRef.current && (decalRef.current.renderOrder = 999)}
              {/* 调试用小球，显示点击位置 */}
              {/* <mesh position={decalPos}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="red" wireframe depthTest={false} />
              </mesh> */}
            </>,
            targetMesh
          )}
        </Center>
      </group>

      <Grid position={[0, -1, 0]} infiniteGrid fadeDistance={200} fadeStrength={1} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ff0000', '#00ff00', '#0000ff']} labelColor="white" />
      </GizmoHelper>
    </>
  )
}
