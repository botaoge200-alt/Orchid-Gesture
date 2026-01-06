import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useGLTF, Center, Decal, Html, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { createPortal, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface HumanModelProps {
  color: string
  length: number
  width: number
  texture: THREE.Texture | null
  showTexture: boolean
  isDecal?: boolean
  enablePlacement?: boolean
}

export function HumanModel({ color, length, width, texture, showTexture, isDecal, enablePlacement }: HumanModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/plmxs.glb')
  const { gl, camera } = useThree()
  const decalRef = useRef<THREE.Mesh>(null)
  
  // Clone scene
  const clonedScene = useMemo(() => scene.clone(), [scene])
  
  const [targetMesh, setTargetMesh] = useState<THREE.Mesh | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...')
  const [scaleFactor, setScaleFactor] = useState<number>(1) // Add scale factor state
  const [decalPos, setDecalPos] = useState<THREE.Vector3>(new THREE.Vector3(0, 0, 0))
  const [decalScale, setDecalScale] = useState<THREE.Vector3>(new THREE.Vector3(1, 1, 1))
  const [decalRot, setDecalRot] = useState<THREE.Euler>(new THREE.Euler(0, Math.PI, 0))
  const orientedTexture = useMemo(() => {
    if (!texture) return null
    const t = texture.clone()
    t.center.set(0.5, 0.5)
    t.rotation = -Math.PI / 2
    t.needsUpdate = true
    return t
  }, [texture])

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
    const offsetOut = scaleFactor > 10 ? 1.0 : 0.01
    const pos = hitPointLocal.clone().add(normalLocal.clone().multiplyScalar(offsetOut))
    bm.geometry.computeBoundingBox()
    const bbox = bm.geometry.boundingBox
    const h = bbox ? bbox.max.y - bbox.min.y : (scaleFactor > 10 ? 180 : 1.8)
    const chestY = bbox ? bbox.min.y + h * 0.55 : pos.y
    pos.y = chestY
    const lookDir = normalLocal.clone().normalize()
    const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), lookDir, new THREE.Vector3(0, 1, 0))
    const quat = new THREE.Quaternion().setFromRotationMatrix(lookMat)
    const baseEuler = new THREE.Euler().setFromQuaternion(quat, 'XYZ')
    const rot = new THREE.Euler(baseEuler.x, baseEuler.y, baseEuler.z + Math.PI / 2)
    setDecalPos(pos)
    setDecalRot(rot)
    const s = h * 2.0
    const t = h * 0.5
    setDecalScale(new THREE.Vector3(s, s, t))
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

  useEffect(() => {
    let bestMesh: THREE.Mesh | null = null;
    let maxVertices = 0;
    let meshNames: string[] = [];
    
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const vertexCount = mesh.geometry.attributes.position.count
        meshNames.push(`${mesh.name} (${vertexCount}v)`)
        
        // Find body (most vertices)
        if (vertexCount > maxVertices) {
          maxVertices = vertexCount
          bestMesh = mesh
        }

        // Apply material
        const useTextureAsMap = showTexture && !isDecal
        const newMaterial = new THREE.MeshStandardMaterial({
          color: (showTexture && !isDecal) ? 'white' : color,
          map: useTextureAsMap ? texture : null,
          roughness: 0.5,
          metalness: 0.1,
          side: THREE.DoubleSide
        })
        mesh.material = newMaterial
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    
    setTargetMesh(bestMesh)

    // Calculate scale factor based on bounding box
    let calculatedScale = 1;
    let isCm = false;
    let height = 0;
    if (bestMesh) {
        const bm = bestMesh as THREE.Mesh;
        bm.geometry.computeBoundingBox();
        const bbox = bm.geometry.boundingBox;
        if (bbox) {
            height = bbox.max.y - bbox.min.y;
            console.log('Mesh Bounding Box Height:', height);
            // If height is around 150-200, it's likely in CM, so we need to scale up Decal position/scale by 100
            // But wait, if Mesh is in CM (e.g. vertices are 0..180), and we put Decal at y=1.5, that's 1.5cm from feet.
            // So we need to multiply Decal pos by 100.
            if (height > 50) {
                calculatedScale = 100; 
                isCm = true;
            }
        }
    }
    setScaleFactor(calculatedScale);
    
    if (bestMesh) {
      const bm = bestMesh as THREE.Mesh;
      const basePos = isCm ? new THREE.Vector3(0, 30, 25) : new THREE.Vector3(0, 0.3, 0.25);
      const baseScale = isCm ? new THREE.Vector3(80, 80, 80) : new THREE.Vector3(0.8, 0.8, 0.8);
      let pos = basePos.clone();
      let rot = new THREE.Euler(0, Math.PI, 0);
      
      const bbox = bm.geometry.boundingBox;
      const h = bbox ? bbox.max.y - bbox.min.y : 60;
      const chestY = bbox ? bbox.min.y + h * 0.5 : 30;
      const originLocal = new THREE.Vector3(0, chestY, isCm ? 25 : 0.25);
      const originWorld = originLocal.clone();
      bm.localToWorld(originWorld);
      const worldQuat = new THREE.Quaternion();
      bm.getWorldQuaternion(worldQuat);
      const candidates = [
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
      ];
      let bestHitPoint: THREE.Vector3 | null = null;
      let bestDirWorld: THREE.Vector3 | null = null;
      let bestFaceIndex: number | null = null;
      let bestDist = Infinity;
      for (const d of candidates) {
        const dirWorld = d.clone().applyQuaternion(worldQuat).normalize();
        const raycaster = new THREE.Raycaster(originWorld, dirWorld);
        const hits = raycaster.intersectObject(bm, true);
        if (hits.length > 0) {
          const h0 = hits[0];
          if (h0.distance < bestDist) {
            bestDist = h0.distance;
            bestHitPoint = h0.point.clone();
            bestDirWorld = dirWorld.clone();
            bestFaceIndex = typeof h0.faceIndex === 'number' ? h0.faceIndex : null;
          }
        }
      }
      if (bestHitPoint) {
        const hitPointLocal = bestHitPoint.clone();
        bm.worldToLocal(hitPointLocal);
        // Compute local triangle normal for orientation
        const geom = bm.geometry as THREE.BufferGeometry;
        const index = geom.index;
        const posAttr = geom.attributes.position as THREE.BufferAttribute;
        let normalLocal = new THREE.Vector3(0, 0, 1);
        if (index && posAttr && bestFaceIndex !== null) {
          const i0 = index.getX(bestFaceIndex * 3);
          const i1 = index.getX(bestFaceIndex * 3 + 1);
          const i2 = index.getX(bestFaceIndex * 3 + 2);
          const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
          const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
          const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2);
          const triNormal = new THREE.Vector3();
          THREE.Triangle.getNormal(v0, v1, v2, triNormal);
          normalLocal.copy(triNormal).normalize();
        }
        // Slightly offset outward along the surface normal to ensure visibility
        const offsetOut = isCm ? 1.0 : 0.01;
        pos = hitPointLocal.clone().add(normalLocal.clone().multiplyScalar(offsetOut));
        // Orient decal to face along local normal
        const lookDir = normalLocal.clone().normalize();
        const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), lookDir, new THREE.Vector3(0, 1, 0));
        const quat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
        const baseEuler = new THREE.Euler().setFromQuaternion(quat, 'XYZ');
        rot = new THREE.Euler(baseEuler.x, baseEuler.y, baseEuler.z + Math.PI / 2);
      }
      
      setDecalPos(pos);
      setDecalScale(new THREE.Vector3(baseScale.x * 2, baseScale.y * 2, baseScale.z * 2));
      setDecalRot(rot);
    }
    
    // Update debug info
    setDebugInfo(`
      Vertices: ${maxVertices}
      Texture: ${texture ? 'Loaded' : 'Null'}
      IsDecal: ${isDecal}
      ScaleFactor: ${calculatedScale}
    `)
    
  }, [clonedScene, color, texture, showTexture, isDecal])

  // Decal configuration
  // Use large values for CM-based models
  // Origin is assumed to be at Hips/Center, so Y=30 is Chest area.
  const basePos = new THREE.Vector3(0, 30, 15)
  const baseScale = new THREE.Vector3(40, 40, 40)
  
  // Force scaleFactor to 1 if detection failed, or use detection but fallback to 1
  // Actually, we want to USE these base values directly if the model is big.
  // Let's rely on base values being "Medium" and scaleFactor adjusting.
  // BUT the previous logic set calculatedScale = 100 for height > 50.
  // If height > 50 (e.g. 180), scale is 100.
  // Then decalPos = (0, 3000, 1500). Too big.
  // The issue was: Base was (0, 1.5, 0.3). x100 = (0, 150, 30).
  // (0, 150, 30) is decent for feet-origin model.
  // But for center-origin model, y=150 is way above head.
  
  // So, let's simplify. We will use the CM values directly, and set scaleFactor to 1 by default,
  // unless the model is TINY (meters).
  
  // New Logic:
  // If height > 50 (CM model): Use pos(0, 30, 15), scale(40, 40, 40)
  // If height < 50 (Meter model): Use pos(0, 0.3, 0.15), scale(0.4, 0.4, 0.4)
  
  const isCmModel = scaleFactor > 10; // calculatedScale was 100
  
  const finalScale = isCmModel
      ? new THREE.Vector3(80, 80, 80)
      : new THREE.Vector3(0.8, 0.8, 0.8);
  
  const offsetX = isCmModel ? 30 : 0.3
  const offsetZ = isCmModel ? 90 : 0.9

  return (
    <>
      <mesh position={[0, 1, 0]} rotation={[0, 3 * Math.PI / 2, 0]} scale={[2.5, 2.5, 2.5]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial map={texture || undefined} color={texture ? 'white' : 'gray'} />
      </mesh>

      <group ref={group} dispose={null} position={[-offsetX, -1, -offsetZ]} onPointerDown={onPointerDown}>
        <Center>
          <primitive object={clonedScene} scale={[2, 2, 2]} />
          {enablePlacement && targetMesh && createPortal(
            <>
              <Decal
                position={decalPos} 
                rotation={decalRot}
                scale={decalScale}
                debug={false}
                ref={decalRef as any}
              >
                <meshBasicMaterial color="magenta" transparent opacity={0.9} polygonOffset polygonOffsetFactor={-10} depthTest={false} depthWrite={false} />
              </Decal>
              {decalRef.current && (decalRef.current.renderOrder = 999)}
              <mesh position={decalPos}>
                <sphereGeometry args={[isCmModel ? 5 : 0.05, 16, 16]} />
                <meshBasicMaterial color="red" wireframe depthTest={false} />
              </mesh>
            </>,
            targetMesh
          )}
        </Center>
      </group>

      <Grid position={[0, -1, 0]} infiniteGrid fadeDistance={200} fadeStrength={1} />
      <axesHelper args={[100]} />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ff0000', '#00ff00', '#0000ff']} labelColor="white" />
      </GizmoHelper>
    </>
  )
}

useGLTF.preload('/models/plmxs.glb')
