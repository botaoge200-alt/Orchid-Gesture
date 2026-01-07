
const fs = require('fs');
const path = require('path');

// Mocking browser-specific APIs for Node.js environment
global.window = {
    innerWidth: 1024,
    innerHeight: 768,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
};
global.document = {
    createElement: () => ({ style: {}, setAttribute: () => {} }),
    body: { appendChild: () => {} },
};
global.self = global.window;

// We need a GLTF loader for Node.js. 
// Since we might not have 'three-stdlib' or similar in the node_modules for this environment easily accessible or compatible with pure Node, 
// and parsing binary GLB manually is complex.
// 
// ALTERNATIVE: I will use a simple binary parser to look for JSON chunk in GLB and print the structure.
// This is more robust than trying to run Three.js in this Node environment if dependencies are tricky.

function parseGLB(filePath) {
    const buffer = fs.readFileSync(filePath);
    
    // GLB Header: magic (4), version (4), length (4)
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46546C67) throw new Error('Not a valid GLB file');
    
    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    
    console.log(`GLB Version: ${version}, Total Length: ${length}`);
    
    // Chunk 0: JSON
    const chunkLength = buffer.readUInt32LE(12);
    const chunkType = buffer.readUInt32LE(16);
    
    if (chunkType !== 0x4E4F534A) throw new Error('First chunk is not JSON');
    
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const jsonStr = jsonBuffer.toString('utf8');
    const json = JSON.parse(jsonStr);
    
    return json;
}

try {
    const glbPath = path.resolve(__dirname, '../client/public/models/plmxs.glb');
    console.log(`Inspecting: ${glbPath}`);
    const gltf = parseGLB(glbPath);
    
    console.log('\n--- Meshes & Morph Targets ---');
    if (gltf.meshes) {
        gltf.meshes.forEach((mesh, index) => {
            console.log(`Mesh ${index}: ${mesh.name}`);
            if (mesh.primitives) {
                mesh.primitives.forEach((prim, pIndex) => {
                    if (prim.targets) {
                        console.log(`  Primitive ${pIndex} has ${prim.targets.length} morph targets.`);
                        // Check if target names are defined in 'extras' or mesh weights
                        if (mesh.weights) {
                           console.log(`  Initial Weights: ${mesh.weights.join(', ')}`);
                        }
                        // Try to find target names in mesh.extras or top-level extensions
                        if (mesh.extras && mesh.extras.targetNames) {
                            console.log(`  Target Names: ${mesh.extras.targetNames.join(', ')}`);
                        }
                    } else {
                        console.log(`  Primitive ${pIndex}: No morph targets`);
                    }
                });
            }
        });
    } else {
        console.log('No meshes found.');
    }

    console.log('\n--- Skins & Joints (Bones) ---');
    if (gltf.skins) {
        gltf.skins.forEach((skin, index) => {
            console.log(`Skin ${index}: ${skin.name || 'Unnamed'}`);
            console.log(`  Joint count: ${skin.joints.length}`);
        });
    } else {
        console.log('No skins found.');
    }
    
    console.log('\n--- Nodes (Hierarchy) ---');
    if (gltf.nodes) {
         gltf.nodes.forEach((node, index) => {
             if (node.name && (node.name.toLowerCase().includes('bone') || node.name.toLowerCase().includes('spine') || node.name.toLowerCase().includes('arm') || node.name.toLowerCase().includes('leg'))) {
                 console.log(`Node ${index}: ${node.name}`);
             }
         });
    }

} catch (error) {
    console.error('Error inspecting GLB:', error);
}
