import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'client/public/models/plmxs.glb');

try {
  const buffer = fs.readFileSync(filePath);
  
  // GLB Header: Magic (4) + Version (4) + Length (4) = 12 bytes
  const magic = buffer.readUInt32LE(0);
  const version = buffer.readUInt32LE(4);
  const totalLength = buffer.readUInt32LE(8);
  
  if (magic !== 0x46546C67) { // 'glTF'
    console.error('Not a valid GLB file');
    process.exit(1);
  }
  
  // Chunk 0: Length (4) + Type (4) + Data
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);
  
  if (chunkType !== 0x4E4F534A) { // 'JSON'
    console.error('First chunk is not JSON');
    process.exit(1);
  }
  
  const jsonBuffer = buffer.subarray(20, 20 + chunkLength);
  const jsonStr = jsonBuffer.toString('utf8');
  const json = JSON.parse(jsonStr);
  
  console.log('--- Model Analysis ---');
  console.log('Meshes:', json.meshes ? json.meshes.length : 0);
  
  if (json.meshes) {
    console.log('\nMesh Names:');
    json.meshes.forEach((mesh, index) => {
      console.log(`${index}: ${mesh.name}`);
      if (mesh.primitives) {
          mesh.primitives.forEach((p, pi) => {
              console.log(`  - Primitive ${pi}: material=${p.material}, targets=${p.targets ? p.targets.length : 0}`);
              if (p.targets) {
                  // GLTF targets usually match 'extras' or 'weights' names if available in mesh
                  // But pure JSON might not show names easily without looking at mesh.extras.targetNames
                  // We'll just check existence.
              }
          });
      }
      if (mesh.extras && mesh.extras.targetNames) {
          console.log(`    Target Names: ${mesh.extras.targetNames.join(', ')}`);
      }
    });
  }

  if (json.nodes) {
      console.log('\nNode Names (Hierarchy):');
      json.nodes.forEach((node, index) => {
          if (node.mesh !== undefined) {
             console.log(`${index}: ${node.name} (Has Mesh)`);
          } else {
             console.log(`${index}: ${node.name}`);
          }
      });
  }
  
} catch (error) {
  console.error('Error parsing GLB:', error);
}
