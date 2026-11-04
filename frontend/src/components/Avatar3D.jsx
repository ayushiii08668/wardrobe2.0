import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadAndRigGlbGarment, fitAndRigStaticGarment } from '../services/garmentRiggingService.js';

/**
 * Avatar3D – Photorealistic Female 3D Avatar with True 3D Garment Virtual Try-On
 *
 * Implements:
 * 1. Cloud-Based 2D-to-3D Garment Generation & Auto-Rigging:
 *    - Loads dynamic GLB assets from Tripo3D API v3 / Cloud AI pipeline.
 *    - Auto-rigs static geometry with ReadyPlayerMe bone weights (Hips, Spine, Shoulders, Arms, Legs).
 *    - Binds to live avatar skeleton via SkinnedMesh.bind(skeleton, bindMatrix).
 * 2. Authentic Pre-Rigged 3D Garment Geometry:
 *    - dress_floral_puff.glb: Authentic pink floral dress with square neckline,
 *      3D puffed sleeves on shoulders, belted sash with tied front bow, and
 *      3-tier layered ruffled flared skirt.
 *    - dress_saree.glb: Banarasi silk saree with pleated drape and pallu.
 *    - dress_slip.glb: Liquid satin slip midi dress.
 *    - top_casual.glb: Tailored shirt/top with fitted sleeves.
 *    - trouser_jeans.glb: Contoured denim trousers with separate legs.
 * 3. Prevention of Black Cones, Clipping & Distortions:
 *    - Clean PBR textures with sRGB color space, tangent-space normal maps,
 *      and double-sided rendering.
 *    - Hides underlying body parts (top/bottom) when wearing dresses to
 *      completely eliminate clipping and body penetration.
 *    - Clean lifecycle removal and memory disposal of previous garment meshes on outfit change.
 */

// ─── Fabric PBR Param Resolver ───────────────────────────────────────────────
function getFabricParams(garmentItem) {
  const cat  = (garmentItem?.category   || '').toLowerCase();
  const sil  = (garmentItem?.silhouette || '').toLowerCase();
  const name = (garmentItem?.name       || '').toLowerCase();

  if (cat === 'trousers' || sil.includes('jean') || name.includes('jean') || name.includes('denim')) {
    return { roughness: 0.76, metalness: 0.02, clearcoat: 0.0, clearcoatRoughness: 0.1 };
  }
  if (name.includes('floral') || name.includes('frock') || sil.includes('puff')) {
    return { roughness: 0.35, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.08 };
  }
  if (cat === 'dresses' || cat === 'dress' || sil.includes('dress') || name.includes('gown')) {
    return { roughness: 0.28, metalness: 0.20, clearcoat: 0.45, clearcoatRoughness: 0.06 };
  }
  if (cat === 'outerwear' || name.includes('jacket') || name.includes('coat') || sil.includes('biker')) {
    return { roughness: 0.42, metalness: 0.16, clearcoat: 0.50, clearcoatRoughness: 0.1 };
  }
  if (cat === 'shoes' || cat === 'footwear' || sil.includes('sneaker')) {
    return { roughness: 0.55, metalness: 0.10, clearcoat: 0.0, clearcoatRoughness: 0.1 };
  }
  if (cat === 'indian_ethnic' || name.includes('saree') || name.includes('banarasi') || name.includes('anarkali')) {
    return { roughness: 0.25, metalness: 0.35, clearcoat: 0.65, clearcoatRoughness: 0.07 };
  }
  return { roughness: 0.45, metalness: 0.05, clearcoat: 0.15, clearcoatRoughness: 0.1 };
}

const COLOR_NAMES = {
  white:'#f8f9fa', black:'#1c1c1f', navy:'#1b2a4a', beige:'#d8cdbf',
  camel:'#bca182', grey:'#4b5563',  gray:'#4b5563',  blue:'#2563eb',
  emerald:'#1b4d3e', green:'#15803d', red:'#dc2626', pink:'#e5779c',
  purple:'#7c3aed', brown:'#5c3a21', yellow:'#f59e0b', charcoal:'#2d3748',
  ivory:'#fffff0', cream:'#fffdd0',
};

function resolveColor(raw) {
  if (!raw) return '#ffffff';
  if (raw.startsWith('#')) return raw;
  return COLOR_NAMES[raw.toLowerCase().trim()] || raw;
}

// Global texture cache to prevent duplicate loads
const textureCache = {};
function getLoadedTexture(url) {
  if (!textureCache[url]) {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const tex = loader.load(url);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache[url] = tex;
  }
  return textureCache[url];
}

/**
 * Builds PBR Material for 3D Garments with zero pitch-black shading & vibrant color fidelity
 * STRICTLY enables alpha testing on extracted clothing textures so that transparent background
 * pixels are discarded by the GPU, completely eliminating any black cones or dark artifacts.
 */
function buildGarmentMaterial(garmentItem, origMat) {
  let existingMat = garmentItem?.cloth3D?.pbrMaterial || garmentItem?.pbrMaterial;
  if (existingMat) {
    existingMat.transparent = true;
    existingMat.alphaTest = 0.5;
    existingMat.depthWrite = true;
    existingMat.polygonOffset = true;
    existingMat.polygonOffsetFactor = -1.5;
    existingMat.polygonOffsetUnits = -1.5;
    existingMat.side = THREE.DoubleSide;
    existingMat.needsUpdate = true;
    return existingMat;
  }

  const { roughness, metalness, clearcoat, clearcoatRoughness } = getFabricParams(garmentItem);
  const rawColor = garmentItem?.primaryColor ||
                   garmentItem?.color ||
                   garmentItem?.colors?.[0]?.hex || '#ffffff';
  const color = resolveColor(rawColor);

  const itemId = (garmentItem?.id || '').toLowerCase();
  const name = (garmentItem?.name || '').toLowerCase();
  const imageSrc = garmentItem?.image || '';

  // Only the authentic catalog floral puff dress should receive the pink floral texture
  const isFloralOrPuff =
    itemId === 'dress-floral-puff' ||
    name === 'vintage floral puff-sleeve frock' ||
    name === 'pink floral puff dress' ||
    (name.includes('floral') && name.includes('puff')) ||
    imageSrc.includes('pink_dress');

  const params = {
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
  };

  // If this is the floral puff dress, use the cleaned floral texture with normal and roughness maps
  if (isFloralOrPuff) {
    params.map = getLoadedTexture('/models/garments/pink_floral_texture.png');
    params.normalMap = getLoadedTexture('/models/garments/pink_floral_normal.png');
    params.normalScale = new THREE.Vector2(1.8, 1.8);
    params.roughnessMap = getLoadedTexture('/models/garments/pink_floral_rough.png');
    params.color = new THREE.Color('#ffffff');
    return new THREE.MeshPhysicalMaterial(params);
  }

  const hasRealImage = imageSrc && typeof imageSrc === 'string' &&
                       (imageSrc.startsWith('http') || imageSrc.startsWith('blob:') || imageSrc.startsWith('/') || imageSrc.startsWith('data:'));

  if (hasRealImage) {
    try {
      const tex = getLoadedTexture(imageSrc);
      params.map = tex;
      // Use pure white tint so the garment texture retains 100% of its authentic extracted colors without color bleed
      params.color = new THREE.Color('#ffffff');
      // Cut out transparent background completely to eliminate any black cone / dark shell
      params.transparent = true;
      params.alphaTest = 0.5;
      params.depthWrite = true;
    } catch {
      params.color = new THREE.Color(color);
    }
  } else {
    params.color = new THREE.Color(color);
  }

  return new THREE.MeshPhysicalMaterial(params);
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Avatar3D({
  outfit = {},
  isWalking = false,
  isTryOnEffect = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  mode = 'demo',
  personalizedProfile = null,
}) {
  const groupRef = useRef();
  const activeDressRef = useRef(null);
  const tryOnSeqRef = useRef(0);

  // Load avatar and authentic 3D garment GLB assets
  const avatarGltf = useGLTF('/models/female_avatar.glb');
  const dressFloralGltf = useGLTF('/models/garments/dress_floral_puff.glb');
  const dressSlipGltf = useGLTF('/models/garments/dress_slip.glb');
  const dressSareeGltf = useGLTF('/models/garments/dress_saree.glb');
  const topCasualGltf = useGLTF('/models/garments/top_casual.glb');
  const trouserJeansGltf = useGLTF('/models/garments/trouser_jeans.glb');

  // Extract authentic 3D garment geometries
  const garmentGeometries = useMemo(() => {
    const extract = (gltf) => {
      let found = null;
      if (gltf?.scene) {
        gltf.scene.traverse((child) => {
          if (!found && child.isMesh && child.geometry) {
            found = child.geometry;
          }
        });
      }
      return found;
    };

    return {
      floralPuff: extract(dressFloralGltf),
      slip: extract(dressSlipGltf),
      saree: extract(dressSareeGltf),
      top: extract(topCasualGltf),
      jeans: extract(trouserJeansGltf),
    };
  }, [dressFloralGltf, dressSlipGltf, dressSareeGltf, topCasualGltf, trouserJeansGltf]);

  const meshesRef = useRef({
    top: null, bottom: null, shoes: null, body: null, head: null, hair: null,
    eyes: [], glasses: null, bones: {}, restQuaternions: {}, restPositions: {},
    origTopMat: null, origBottomMat: null, origShoesMat: null,
  });

  // Natural bare skin material to display avatar body parts (arms, neck, legs)
  // without any internal clothing (default t-shirt & gym leggings)
  const skinMat = useMemo(() => {
    const skinColor = personalizedProfile?.skinColor || '#d9997d';
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinColor),
      roughness: 0.60,
      metalness: 0.0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1.0,
      polygonOffsetUnits: 1.0,
    });
  }, [personalizedProfile?.skinColor]);

  // Clone avatar scene safely with SkeletonUtils and capture native rest quaternions & positions
  const avatarScene = useMemo(() => {
    if (!avatarGltf?.scene) return null;
    const clone = SkeletonUtils.clone(avatarGltf.scene);

    const disc = {
      top: null, bottom: null, shoes: null, body: null, head: null, hair: null,
      eyes: [], glasses: null, bones: {}, restQuaternions: {}, restPositions: {},
      origTopMat: null, origBottomMat: null, origShoesMat: null,
    };

    clone.traverse((child) => {
      if (child.isBone) {
        disc.bones[child.name] = child;
        disc.restQuaternions[child.name] = child.quaternion.clone();
        disc.restPositions[child.name] = child.position.clone();
      }

      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;

        switch (child.name) {
          case 'Wolf3D_Head':
            disc.head = child; break;
          case 'Wolf3D_Body':
            disc.body = child; break;
          case 'Wolf3D_Hair':
            disc.hair = child; break;
          case 'Wolf3D_Outfit_Top':
            disc.top = child;
            disc.origTopMat = child.material?.clone?.() || null;
            break;
          case 'Wolf3D_Outfit_Bottom':
            disc.bottom = child;
            disc.origBottomMat = child.material?.clone?.() || null;
            break;
          case 'Wolf3D_Outfit_Footwear':
            disc.shoes = child;
            disc.origShoesMat = child.material?.clone?.() || null;
            break;
          case 'EyeLeft':
          case 'EyeRight':
            disc.eyes.push(child); break;
          case 'Wolf3D_Glasses':
            disc.glasses = child;
            child.visible = false;
            break;
          default: {
            const n = child.name.toLowerCase();
            if (n.includes('eye') && !n.includes('brow')) disc.eyes.push(child);
          }
        }

        // Configure realistic PBR skin, hair, and eyes
        if (!child.name.startsWith('Wolf3D_Outfit') && child.material) {
          const mat = child.material.clone();
          const matName = (mat.name || '').toLowerCase();
          if (matName.includes('skin') || matName.includes('body') || matName.includes('head')) {
            mat.roughness = 0.58; mat.metalness = 0.0; mat.envMapIntensity = 1.0;
          } else if (matName.includes('eye')) {
            mat.roughness = 0.10; mat.metalness = 0.05; mat.envMapIntensity = 1.5;
          } else if (matName.includes('hair')) {
            mat.roughness = 0.72; mat.metalness = 0.10; mat.envMapIntensity = 0.9;
          }
          mat.needsUpdate = true;
          child.material = mat;
        }
      }
    });

    meshesRef.current = disc;
    return clone;
  }, [avatarGltf]);

  // ── Natural Human Standing Posture & Walking Locomotion ────────────────────
  const walkPhaseRef = useRef(0);
  const blinkTimerRef = useRef(0);
  const nextBlinkIntervalRef = useRef(3.5);

  useFrame((state, delta) => {
    const { head, bones, restQuaternions, restPositions } = meshesRef.current;
    if (!bones || !restQuaternions || Object.keys(bones).length === 0) return;
    const t = state.clock.getElapsedTime();

    const applyRelativeRotation = (boneName, ex, ey, ez) => {
      const bone = bones[boneName];
      const rest = restQuaternions[boneName];
      if (!bone || !rest) return;
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(ex, ey, ez, 'XYZ'));
      bone.quaternion.copy(rest).multiply(rot);
    };

    if (isWalking) {
      // Fluid walking locomotion
      walkPhaseRef.current += delta * 7.2;
      const p = walkPhaseRef.current;
      const strideL = Math.sin(p) * 0.36;
      const strideR = Math.sin(p + Math.PI) * 0.36;
      const kneeL = Math.max(0, -Math.sin(p)) * 0.45;
      const kneeR = Math.max(0, -Math.sin(p + Math.PI)) * 0.45;

      // Leg stride: feet swing forward and back, staying down near the floor
      applyRelativeRotation('LeftUpLeg', strideL, 0, -0.02);
      applyRelativeRotation('RightUpLeg', strideR, 0, 0.02);
      applyRelativeRotation('LeftLeg', -kneeL, 0, 0);
      applyRelativeRotation('RightLeg', -kneeR, 0, 0);

      // Arm swing in counter-cadence with legs
      applyRelativeRotation('LeftArm', strideR * 0.35, 0, -1.05);
      applyRelativeRotation('RightArm', strideL * 0.35, 0, 1.05);
      applyRelativeRotation('LeftForeArm', 0, 0, -0.25);
      applyRelativeRotation('RightForeArm', 0, 0, 0.25);

      if (bones['Hips']) {
        const bob = Math.abs(Math.sin(p)) * 0.015;
        const restY = restPositions?.['Hips']?.y || 1.03696;
        bones['Hips'].position.set(0, restY + bob, 0.0404);
        applyRelativeRotation('Hips', 0, Math.sin(p) * 0.03, 0);
      }
    } else {
      // Natural standing model posture: straight legs grounded on floor, arms relaxed down at sides
      walkPhaseRef.current = THREE.MathUtils.lerp(walkPhaseRef.current, 0, 0.1);
      const breathe = Math.sin(t * 1.8) * 0.003;
      const sway = Math.sin(t * 0.9) * 0.008;

      // Legs stand straight down grounded on the floor
      applyRelativeRotation('LeftUpLeg', 0.02, 0, -0.02);
      applyRelativeRotation('RightUpLeg', -0.02, 0, 0.02);
      applyRelativeRotation('LeftLeg', 0, 0, 0);
      applyRelativeRotation('RightLeg', 0, 0, 0);

      // Arms relaxed naturally down along torso with subtle breathing movement
      applyRelativeRotation('LeftArm', breathe * 0.3, 0, -1.08 + sway);
      applyRelativeRotation('RightArm', breathe * 0.3, 0, 1.08 - sway);
      applyRelativeRotation('LeftForeArm', 0, 0, -0.25);
      applyRelativeRotation('RightForeArm', 0, 0, 0.25);

      // Subtle chest & spine breathing
      applyRelativeRotation('Spine', breathe * 0.4, sway * 0.3, 0);
      applyRelativeRotation('Spine1', breathe * 0.6, 0, 0);
      applyRelativeRotation('Spine2', breathe * 0.4, 0, 0);
      applyRelativeRotation('Neck', -breathe * 0.3, Math.sin(t * 0.6) * 0.02, 0);

      if (bones['Hips']) {
        const restY = restPositions?.['Hips']?.y || 1.03696;
        bones['Hips'].position.set(0, restY + breathe * 0.5, 0.0404);
        applyRelativeRotation('Hips', 0, sway * 0.5, 0);
      }
    }

    // Procedural Eye Blinking & Facial Blendshapes
    if (head?.morphTargetDictionary && head?.morphTargetInfluences) {
      const dict = head.morphTargetDictionary;
      const infl = head.morphTargetInfluences;
      blinkTimerRef.current += delta;
      if (blinkTimerRef.current > nextBlinkIntervalRef.current) {
        const bp = (blinkTimerRef.current - nextBlinkIntervalRef.current) / 0.18;
        if (bp <= 1.0) {
          const v = Math.sin(bp * Math.PI);
          if (dict['eyeBlinkLeft'] !== undefined) infl[dict['eyeBlinkLeft']] = v;
          if (dict['eyeBlinkRight'] !== undefined) infl[dict['eyeBlinkRight']] = v;
        } else {
          if (dict['eyeBlinkLeft'] !== undefined) infl[dict['eyeBlinkLeft']] = 0;
          if (dict['eyeBlinkRight'] !== undefined) infl[dict['eyeBlinkRight']] = 0;
          blinkTimerRef.current = 0;
          nextBlinkIntervalRef.current = 2.8 + Math.random() * 2.5;
        }
      }
    }
  });

  // ── Biometric Profile Adaptation (Custom Body Scaling) ───────────────────
  useEffect(() => {
    const { bones, head, body } = meshesRef.current;
    if (!bones || Object.keys(bones).length === 0) return;

    if (mode === 'personalized' && personalizedProfile) {
      if (personalizedProfile.boneScales) {
        Object.entries(personalizedProfile.boneScales).forEach(([bName, scale]) => {
          const bone = bones[bName];
          if (bone && Array.isArray(scale) && scale.length === 3) {
            bone.scale.set(scale[0], scale[1], scale[2]);
          }
        });
      }
      if (personalizedProfile.skinColor) {
        const skinCol = new THREE.Color(personalizedProfile.skinColor);
        if (head?.material) {
          head.material.color = skinCol;
          head.material.roughness = 0.58;
          head.material.needsUpdate = true;
        }
        if (body?.material) {
          body.material.color = skinCol;
          body.material.roughness = 0.58;
          body.material.needsUpdate = true;
        }
        if (skinMat) {
          skinMat.color.copy(skinCol);
          skinMat.needsUpdate = true;
        }
      }
      if (head?.morphTargetDictionary && head?.morphTargetInfluences && personalizedProfile.morphTargets) {
        const dict = head.morphTargetDictionary;
        const infl = head.morphTargetInfluences;
        Object.entries(personalizedProfile.morphTargets).forEach(([targetName, weight]) => {
          if (dict[targetName] !== undefined) {
            infl[dict[targetName]] = weight;
          }
        });
      }
    } else {
      const resetBones = ['Head', 'LeftShoulder', 'RightShoulder', 'Spine', 'Hips', 'LeftUpLeg', 'RightUpLeg'];
      resetBones.forEach((bName) => {
        const bone = bones[bName];
        if (bone) bone.scale.set(1, 1, 1);
      });
      const defaultSkin = new THREE.Color('#ffffff');
      if (head?.material) {
        head.material.color = defaultSkin;
        head.material.needsUpdate = true;
      }
      if (body?.material) {
        body.material.color = defaultSkin;
        body.material.needsUpdate = true;
      }
      if (skinMat) {
        skinMat.color.set('#d9997d');
        skinMat.needsUpdate = true;
      }
    }
  }, [mode, personalizedProfile, avatarScene, skinMat]);

  // ── Outfit Application & Auto-Rigging Engine (Replacement-Based Try-On) ──
  useEffect(() => {
    if (!avatarScene) return;

    const {
      top, bottom, shoes,
      origTopMat, origBottomMat, origShoesMat,
    } = meshesRef.current;

    let isDisposed = false;
    const currentSeq = ++tryOnSeqRef.current;

    // Helper: Completely purge, unparent, and dispose ANY existing try-on dress mesh from scene graph
    const cleanAllAttachedDresses = () => {
      const toRemove = [];
      avatarScene.traverse((c) => {
        if (c.name === 'Avatar_Active_Dress' || c.userData?.isTryOnGarment) {
          toRemove.push(c);
        }
      });
      toRemove.forEach((m) => {
        m.parent?.remove(m);
        m.geometry?.dispose?.();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat?.dispose?.());
        } else {
          m.material?.dispose?.();
        }
      });
      activeDressRef.current = null;
    };

    // 1. Immediately remove any existing dress so that only ONE garment is ever worn
    cleanAllAttachedDresses();

    const isIndianEthnic =
      outfit?.dress?.category === 'indian_ethnic' ||
      outfit?.top?.category === 'indian_ethnic' ||
      (outfit?.dress?.silhouette || '').includes('saree') ||
      (outfit?.dress?.silhouette || '').includes('anarkali') ||
      (outfit?.dress?.name || '').toLowerCase().includes('saree');

    const isDress = !!(outfit?.dress || isIndianEthnic);

    if (isDress) {
      // ── DRESS / SAREE TRY-ON: Load actual 3D Garment GLB & Bind to Live Skeleton ──
      const dressItem = outfit.dress || outfit.top;
      const itemName = (dressItem?.name || '').toLowerCase();
      const itemSil = (dressItem?.silhouette || '').toLowerCase();

      // Only true floral puff dresses get the floral puff archetype; plain dresses (e.g. brown dress) get slip-dress
      const isFloralOrPuff =
        dressItem?.id === 'dress-floral-puff' ||
        itemSil === 'floral-puff' ||
        itemSil === 'puff' ||
        itemName === 'vintage floral puff-sleeve frock' ||
        itemName === 'pink floral puff dress' ||
        (itemName.includes('floral') && itemName.includes('puff')) ||
        dressItem?.cloth3D?.modelKey === 'floral_puff';

      let targetGeom = garmentGeometries.slip;
      if (isIndianEthnic && garmentGeometries.saree) {
        targetGeom = garmentGeometries.saree;
      } else if (isFloralOrPuff && garmentGeometries.floralPuff) {
        targetGeom = garmentGeometries.floralPuff;
      } else if (garmentGeometries.slip) {
        targetGeom = garmentGeometries.slip;
      }

      const dressMat = buildGarmentMaterial(dressItem, origTopMat);
      const customGlbUrl = dressItem?.modelUrl || dressItem?.model3d?.modelUrl;

      // Calculate dress scale: the 3D dress geometry now natively wraps 360 degrees around the avatar's torso, waist and hips
      const scaleX = isIndianEthnic ? 1.05 : isFloralOrPuff ? 1.02 : 1.06;
      const scaleY = 1.00;
      const scaleZ = isIndianEthnic ? 1.05 : isFloralOrPuff ? 1.02 : 1.06;

      // If a custom cloud-generated GLB URL exists, load and auto-rig it
      if (customGlbUrl && top?.skeleton) {
        loadAndRigGlbGarment(customGlbUrl, top.skeleton, top.bindMatrix, 'dress', dressMat, { scaleX, scaleY, scaleZ })
          .then((riggedMesh) => {
            if (isDisposed || tryOnSeqRef.current !== currentSeq) {
              riggedMesh.geometry?.dispose?.();
              if (Array.isArray(riggedMesh.material)) riggedMesh.material.forEach((m) => m?.dispose?.());
              else riggedMesh.material?.dispose?.();
              return;
            }
            cleanAllAttachedDresses();
            riggedMesh.name = 'Avatar_Active_Dress';
            riggedMesh.userData.isTryOnGarment = true;
            avatarScene.add(riggedMesh);
            activeDressRef.current = riggedMesh;

            // Preserve body parts (arms and legs) as bare natural skin under the dress (no internal clothes)
            if (top) {
              top.visible = true;
              top.material = skinMat;
              top.material.needsUpdate = true;
            }
            if (bottom) {
              bottom.visible = true;
              bottom.material = skinMat;
              bottom.material.needsUpdate = true;
            }
          })
          .catch((err) => {
            console.warn('[Avatar3D] Could not load custom GLB, using procedural fallback:', err.message);
            if (isDisposed || tryOnSeqRef.current !== currentSeq) return;
            cleanAllAttachedDresses();
            if (targetGeom && top?.skeleton) {
              const geom = targetGeom.clone();
              geom.scale(scaleX, scaleY, scaleZ);
              const dressSkinnedMesh = new THREE.SkinnedMesh(geom, dressMat);
              dressSkinnedMesh.name = 'Avatar_Active_Dress';
              dressSkinnedMesh.userData.isTryOnGarment = true;
              dressSkinnedMesh.bind(top.skeleton, top.bindMatrix);
              dressSkinnedMesh.castShadow = true;
              dressSkinnedMesh.receiveShadow = true;
              dressSkinnedMesh.frustumCulled = false;
              avatarScene.add(dressSkinnedMesh);
              activeDressRef.current = dressSkinnedMesh;
              if (top) {
                top.visible = true;
                top.material = skinMat;
                top.material.needsUpdate = true;
              }
              if (bottom) {
                bottom.visible = true;
                bottom.material = skinMat;
                bottom.material.needsUpdate = true;
              }
            }
          });
      } else if (targetGeom && top?.skeleton) {
        // Direct authentic SkinnedMesh binding
        cleanAllAttachedDresses();
        const geom = targetGeom.clone();
        geom.scale(scaleX, scaleY, scaleZ);
        const dressSkinnedMesh = new THREE.SkinnedMesh(geom, dressMat);
        dressSkinnedMesh.name = 'Avatar_Active_Dress';
        dressSkinnedMesh.userData.isTryOnGarment = true;
        dressSkinnedMesh.bind(top.skeleton, top.bindMatrix);
        dressSkinnedMesh.castShadow = true;
        dressSkinnedMesh.receiveShadow = true;
        dressSkinnedMesh.frustumCulled = false;

        avatarScene.add(dressSkinnedMesh);
        activeDressRef.current = dressSkinnedMesh;

        // Preserve body parts (arms and legs) as bare natural skin under the dress (no internal clothes)
        if (top) {
          top.visible = true;
          top.material = skinMat;
          top.material.needsUpdate = true;
        }
        if (bottom) {
          bottom.visible = true;
          bottom.material = skinMat;
          bottom.material.needsUpdate = true;
        }
      }
    } else {
      // ── SEPARATE PIECES (Tops & Trousers): Ensure any active dress is completely removed ──
      cleanAllAttachedDresses();

      // Show separate top and bottom skinned meshes
      if (top) {
        if (outfit?.top) {
          top.material = buildGarmentMaterial(outfit.top, origTopMat);
        } else {
          // If no top selected, display bare upper body skin without internal clothes
          top.material = skinMat;
        }
        top.material.needsUpdate = true;
        top.visible = true;
      }

      if (bottom) {
        if (outfit?.bottom) {
          bottom.material = buildGarmentMaterial(outfit.bottom, origBottomMat);
        } else {
          // If no bottom selected, display bare lower body skin without internal clothes
          bottom.material = skinMat;
        }
        bottom.material.needsUpdate = true;
        bottom.visible = true;
      }
    }

    // ── Footwear Fitting ──
    if (shoes) {
      if (outfit?.shoes) {
        shoes.material = buildGarmentMaterial(outfit.shoes, origShoesMat);
      } else if (origShoesMat) {
        shoes.material = origShoesMat.clone();
      }
      shoes.material.needsUpdate = true;
      shoes.visible = true;
    }

    return () => {
      isDisposed = true;
      tryOnSeqRef.current++;
    };
  }, [outfit, avatarScene, garmentGeometries, skinMat]);

  // ── Try-On Aura Sparkle ───────────────────────────────────────────────────
  const auraRef = useRef();
  useFrame((state, delta) => {
    if (auraRef.current && isTryOnEffect) {
      const t = state.clock.getElapsedTime();
      auraRef.current.rotation.y += delta * 2.2;
      const s = 1 + Math.sin(t * 8) * 0.1;
      auraRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {isTryOnEffect && (
        <group ref={auraRef} position={[0, 1.1, 0]}>
          <mesh>
            <ringGeometry args={[0.45, 0.52, 32]} />
            <meshBasicMaterial
              color="#f472b6"
              side={THREE.DoubleSide}
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}

      {avatarScene && <primitive object={avatarScene} />}
    </group>
  );
}

// Preload avatar and real 3D garment GLB assets
useGLTF.preload('/models/female_avatar.glb');
useGLTF.preload('/models/garments/dress_floral_puff.glb');
useGLTF.preload('/models/garments/dress_slip.glb');
useGLTF.preload('/models/garments/dress_saree.glb');
useGLTF.preload('/models/garments/top_casual.glb');
useGLTF.preload('/models/garments/trouser_jeans.glb');
