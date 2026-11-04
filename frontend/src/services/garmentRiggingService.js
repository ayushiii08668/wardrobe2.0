import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const modelCache = new Map();

/**
 * Anatomical anchor configurations for fitting arbitrary static 3D garments
 * to the ReadyPlayerMe female avatar.
 */
const ANATOMY_TARGETS = {
  dress: {
    targetHeight: 0.84, // from knees (0.63) to collarbone (1.47)
    targetWidth: 0.52,  // wider across hips, waist, bust and shoulders to fully fit female avatar
    targetDepth: 0.38,  // chest to back
    targetCenterY: 1.045, // (1.46 + 0.63) / 2
    targetCenterZ: 0.035,
  },
  top: {
    targetHeight: 0.36, // from waist (1.135) to collarbone (1.495)
    targetWidth: 0.38,
    targetDepth: 0.26,
    targetCenterY: 1.315,
    targetCenterZ: 0.035,
  },
  trousers: {
    targetHeight: 0.94, // from ankles (0.20) to waist (1.14)
    targetWidth: 0.35,
    targetDepth: 0.26,
    targetCenterY: 0.67,
    targetCenterZ: 0.025,
  },
};

/**
 * Fits and rigs an arbitrary static geometry to the ReadyPlayerMe avatar skeleton.
 * Adds skinIndex and skinWeight attributes so the garment follows live skeletal movement.
 *
 * @param {THREE.BufferGeometry} inputGeometry
 * @param {THREE.Material} material
 * @param {THREE.Skeleton} avatarSkeleton
 * @param {string} category - 'dress' | 'top' | 'trousers'
 * @returns {THREE.SkinnedMesh}
 */
export function fitAndRigStaticGarment(inputGeometry, material, avatarSkeleton, category = 'dress') {
  if (!inputGeometry || !avatarSkeleton) {
    throw new Error('fitAndRigStaticGarment: Missing geometry or avatarSkeleton');
  }

  const geom = inputGeometry.clone();
  geom.computeBoundingBox();
  const bbox = geom.boundingBox;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);

  // 1. Center geometry at origin (0, 0, 0)
  geom.translate(-center.x, -center.y, -center.z);

  // 2. Anatomical scaling & translation to match avatar body
  const config = ANATOMY_TARGETS[category] || ANATOMY_TARGETS.dress;
  const scaleX = config.targetWidth / Math.max(0.001, size.x);
  const scaleY = config.targetHeight / Math.max(0.001, size.y);
  const scaleZ = config.targetDepth / Math.max(0.001, size.z);

  geom.scale(scaleX, scaleY, scaleZ);
  geom.translate(0, config.targetCenterY, config.targetCenterZ);

  // 3. Map ReadyPlayerMe skeleton bone indices
  const boneMap = {};
  avatarSkeleton.bones.forEach((b, idx) => {
    boneMap[b.name] = idx;
  });

  const idxHips = boneMap['Hips'] ?? 0;
  const idxSpine = boneMap['Spine'] ?? 1;
  const idxSpine1 = boneMap['Spine1'] ?? 2;
  const idxSpine2 = boneMap['Spine2'] ?? 3;
  const idxLeftShoulder = boneMap['LeftShoulder'] ?? 9;
  const idxRightShoulder = boneMap['RightShoulder'] ?? 33;
  const idxLeftArm = boneMap['LeftArm'] ?? 10;
  const idxRightArm = boneMap['RightArm'] ?? 34;
  const idxLeftUpLeg = boneMap['LeftUpLeg'] ?? 57;
  const idxRightUpLeg = boneMap['RightUpLeg'] ?? 62;
  const idxLeftLeg = boneMap['LeftLeg'] ?? 58;
  const idxRightLeg = boneMap['RightLeg'] ?? 63;

  // 4. Calculate bone influence weights for every vertex based on anatomical coordinates
  const posAttr = geom.attributes.position;
  const vertexCount = posAttr.count;
  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);

    let b0 = idxHips, w0 = 1.0;
    let b1 = idxSpine, w1 = 0.0;
    let b2 = idxSpine1, w2 = 0.0;
    let b3 = idxSpine2, w3 = 0.0;

    if (y > 1.40) {
      // Shoulders, neck and upper arms
      if (x < -0.10) {
        b0 = idxLeftArm; b1 = idxLeftShoulder; b2 = idxSpine2;
        w0 = 0.55; w1 = 0.30; w2 = 0.15;
      } else if (x > 0.10) {
        b0 = idxRightArm; b1 = idxRightShoulder; b2 = idxSpine2;
        w0 = 0.55; w1 = 0.30; w2 = 0.15;
      } else {
        b0 = idxSpine2; b1 = idxSpine1;
        w0 = 0.85; w1 = 0.15;
      }
    } else if (y > 1.28) {
      // Chest / bust
      b0 = idxSpine2; b1 = idxSpine1;
      const t = Math.max(0, Math.min(1, (y - 1.28) / 0.12));
      w0 = 0.4 + 0.5 * t;
      w1 = 1.0 - w0;
    } else if (y > 1.16) {
      // Mid torso / ribcage
      b0 = idxSpine1; b1 = idxSpine;
      const t = Math.max(0, Math.min(1, (y - 1.16) / 0.12));
      w0 = 0.40 + 0.45 * t;
      w1 = 1.0 - w0;
    } else if (y > 1.04) {
      // Waist & Hips transition
      b0 = idxSpine; b1 = idxHips;
      const t = Math.max(0, Math.min(1, (y - 1.04) / 0.12));
      w0 = 0.30 + 0.50 * t;
      w1 = 1.0 - w0;
    } else {
      // Legs / Skirt flare
      if (category === 'trousers') {
        if (x < 0) {
          b0 = idxLeftUpLeg; b1 = idxLeftLeg;
          const t = Math.max(0, Math.min(1, (y - 0.55) / 0.45));
          w0 = t; w1 = 1.0 - t;
        } else {
          b0 = idxRightUpLeg; b1 = idxRightLeg;
          const t = Math.max(0, Math.min(1, (y - 0.55) / 0.45));
          w0 = t; w1 = 1.0 - t;
        }
      } else {
        // Skirt follows hips and leg stride
        b0 = idxHips;
        if (x < 0) {
          b1 = idxLeftUpLeg;
          w0 = 0.45; w1 = 0.55;
        } else {
          b1 = idxRightUpLeg;
          w0 = 0.45; w1 = 0.55;
        }
      }
    }

    const sum = w0 + w1 + w2 + w3 || 1.0;
    const ptr = i * 4;
    skinIndices[ptr]     = b0;
    skinIndices[ptr + 1] = b1;
    skinIndices[ptr + 2] = b2;
    skinIndices[ptr + 3] = b3;

    skinWeights[ptr]     = w0 / sum;
    skinWeights[ptr + 1] = w1 / sum;
    skinWeights[ptr + 2] = w2 / sum;
    skinWeights[ptr + 3] = w3 / sum;
  }

  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geom.computeVertexNormals();

  const skinnedMesh = new THREE.SkinnedMesh(geom, material);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  return skinnedMesh;
}

/**
 * Loads a GLB from URL (local or remote), extracts its mesh, and rigs it to avatar skeleton
 */
export async function loadAndRigGlbGarment(
  glbUrl,
  avatarSkeleton,
  bindMatrix,
  category = 'dress',
  fallbackMaterial = null,
  scaleConfig = null
) {
  if (!glbUrl) throw new Error('No GLB URL provided');

  let gltf = modelCache.get(glbUrl);
  if (!gltf) {
    gltf = await new Promise((resolve, reject) => {
      gltfLoader.load(glbUrl, resolve, undefined, reject);
    });
    modelCache.set(glbUrl, gltf);
  }

  let extractedMesh = null;
  gltf.scene.traverse((child) => {
    if (!extractedMesh && (child.isMesh || child.isSkinnedMesh)) {
      extractedMesh = child;
    }
  });

  if (!extractedMesh) {
    throw new Error('No mesh found inside GLB file');
  }

  // Determine scaling factors to ensure the garment fits the avatar body with full coverage
  const isFloral = glbUrl.includes('floral');
  const isEthnic = glbUrl.includes('saree') || glbUrl.includes('ethnic');
  const defaultScaleX = isEthnic ? 1.05 : isFloral ? 1.02 : 1.06;
  const defaultScaleY = 1.00;
  const defaultScaleZ = isEthnic ? 1.05 : isFloral ? 1.02 : 1.06;

  const sx = scaleConfig?.scaleX ?? (category === 'dress' ? defaultScaleX : 1.025);
  const sy = scaleConfig?.scaleY ?? (category === 'dress' ? defaultScaleY : 1.005);
  const sz = scaleConfig?.scaleZ ?? (category === 'dress' ? defaultScaleZ : 1.025);

  // If already rigged with existing bone weights (e.g. authentic garment GLB), use directly as a SkinnedMesh
  if (extractedMesh.geometry?.attributes?.skinIndex) {
    const geom = extractedMesh.geometry.clone();
    geom.scale(sx, sy, sz);
    const skinnedMesh = new THREE.SkinnedMesh(
      geom,
      fallbackMaterial || extractedMesh.material
    );
    skinnedMesh.bind(avatarSkeleton, bindMatrix);
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;
    skinnedMesh.frustumCulled = false;
    return skinnedMesh;
  }

  // Fit & auto-rig the static geometry
  const riggedMesh = fitAndRigStaticGarment(
    extractedMesh.geometry,
    fallbackMaterial || extractedMesh.material,
    avatarSkeleton,
    category
  );
  riggedMesh.bind(avatarSkeleton, bindMatrix);
  return riggedMesh;
}

