import React, { useEffect, useRef } from 'react'
import { useGLTF, Center } from '@react-three/drei'
import * as THREE from 'three'

interface HumanModelProps {
  color: string
  length: number // 暂时未用，将来映射到身高
  width: number  // 暂时未用，将来映射到胖瘦
  texture: THREE.Texture | null
  showTexture: boolean
}

export function HumanModel({ color, length, width, texture, showTexture }: HumanModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/plmxs.glb')

  // 克隆场景以避免因为多次加载导致的引用问题
  const clonedScene = React.useMemo(() => scene.clone(), [scene])

  useEffect(() => {
    // 遍历模型中的所有网格，应用材质和颜色
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        
        // 确保材质是 StandardMaterial 以支持光照
        // 如果原模型已经有材质，我们可以在其基础上修改，或者直接替换
        // 这里为了演示换装/换色，我们创建一个新的材质
        const newMaterial = new THREE.MeshStandardMaterial({
          color: showTexture ? 'white' : color,
          map: texture,
          roughness: 0.5,
          metalness: 0.1,
          side: THREE.DoubleSide, // 防止穿模时看到背面透明
          skinning: true // 如果模型有骨骼，必须开启
        })

        mesh.material = newMaterial
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
  }, [clonedScene, color, texture, showTexture])

  return (
    <group ref={group} dispose={null} position={[0, -1, 0]}>
      <Center>
        <primitive object={clonedScene} scale={[2, 2, 2]} />
      </Center>
    </group>
  )
}

// 预加载模型，避免切换时卡顿
useGLTF.preload('/models/plmxs.glb')
