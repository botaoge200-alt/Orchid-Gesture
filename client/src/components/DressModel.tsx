import { useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

interface DressModelProps {
  color: string
  length: number
  width: number
  texture: THREE.Texture | null
  showTexture: boolean
}

export function DressModel({ color, length, width, texture, showTexture }: DressModelProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      {/* 
        CylinderGeometry 参数:
        radiusTop (腰围), radiusBottom (裙摆), height (裙长), radialSegments
      */}
      <cylinderGeometry args={[0.5, 0.5 + width, 1.5 + length, 32]} />
      
      {/* 材质: 恢复为 StandardMaterial 以展示光照效果 */}
      <meshStandardMaterial 
        color={showTexture ? 'white' : color} 
        map={texture}
        roughness={0.5} 
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
