export const MODEL_CONFIG = {
  CAMERA_POSITION: [0, 0, 40] as [number, number, number],
  MODEL_SCALE: [19, 19, 19] as [number, number, number],
  MODEL_OFFSET: [0, 10, 0] as [number, number, number],
  FOV: 45
}

export const AVAILABLE_CLOTHES = [
  { id: 'none', name: '无', file: null, category: 'clothes' },
  { id: 'blue_shirt', name: 'Blue Outdoor Shirt', file: '/models/Blue_Outdoor_Shirt.glb', category: 'clothes' }
]
