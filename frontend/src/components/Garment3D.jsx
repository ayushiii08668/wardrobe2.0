import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Procedural detailed 3D Garment Mesh generator with cloth drape and realistic fabric materials
function ClothMesh({ silhouette, color, roughness = 0.55, metalness = 0.05 }) {
  const meshGroup = useMemo(() => {
    const group = new THREE.Group();
    const primaryMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness,
      side: THREE.DoubleSide
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f0d5a8'),
      metalness: 0.95,
      roughness: 0.18
    });

    // Add champagne gold luxury hanger
    const hangerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.44, 16), goldMat);
    hangerArm.rotation.z = Math.PI / 2;
    hangerArm.position.y = 0.45;
    group.add(hangerArm);

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 8, 24, Math.PI), goldMat);
    hook.position.set(0, 0.5, 0);
    hook.rotation.y = Math.PI / 2;
    group.add(hook);

    if (silhouette === 'crop-tank') {
      // Fitted silk crop tank with curved scoop neckline & double straps
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.17, 0.38, 32, 1, true), primaryMat);
      body.position.set(0, 0.18, 0);
      group.add(body);

      const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), primaryMat);
      leftStrap.position.set(-0.11, 0.38, 0);
      group.add(leftStrap);

      const rightStrap = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), primaryMat);
      rightStrap.position.set(0.11, 0.38, 0);
      group.add(rightStrap);
    } else if (silhouette === 'sweater') {
      // Soft knit cashmere pullover with natural draped body, drop-shoulders and ribbed collar
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.52, 32), primaryMat);
      body.position.set(0, 0.18, 0);
      body.scale.set(1.1, 1, 0.65);
      group.add(body);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 16, 32), primaryMat);
      collar.position.set(0, 0.45, 0);
      collar.rotation.x = Math.PI / 2;
      group.add(collar);

      const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.44, 24), primaryMat);
      leftSleeve.position.set(-0.26, 0.16, 0);
      leftSleeve.rotation.z = 0.25;
      group.add(leftSleeve);

      const rightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.44, 24), primaryMat);
      rightSleeve.position.set(0.26, 0.16, 0);
      rightSleeve.rotation.z = -0.25;
      group.add(rightSleeve);
    } else if (silhouette === 'floral-puff') {
      // Romantic floral dress with square neck, 3D puff sleeves, front waist bow & 3 ruffled tiers
      const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.165, 0.28, 24), primaryMat);
      bodice.position.set(0, 0.28, 0);
      bodice.scale.set(1, 1, 0.75);
      group.add(bodice);

      // Left puff sleeve
      const leftPuff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), primaryMat);
      leftPuff.position.set(-0.22, 0.34, 0);
      leftPuff.scale.set(1.2, 1.1, 1);
      group.add(leftPuff);

      // Right puff sleeve
      const rightPuff = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), primaryMat);
      rightPuff.position.set(0.22, 0.34, 0);
      rightPuff.scale.set(1.2, 1.1, 1);
      group.add(rightPuff);

      // Front waist tied bow
      const bowKnot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.02), goldMat);
      bowKnot.position.set(0, 0.14, 0.11);
      group.add(bowKnot);

      // Tier 1 flounce
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.18, 24, 1, true), primaryMat);
      tier1.position.set(0, 0.05, 0);
      group.add(tier1);

      // Tier 2 flounce
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.30, 0.20, 24, 1, true), primaryMat);
      tier2.position.set(0, -0.13, 0);
      group.add(tier2);

      // Tier 3 flounce
      const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.22, 24, 1, true), primaryMat);
      tier3.position.set(0, -0.32, 0);
      group.add(tier3);
    } else if (silhouette === 'slip-dress' || silhouette === 'mini-dress') {
      // Liquid satin slip dress with flaring hemline
      const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.34, 32), primaryMat);
      bodice.position.set(0, 0.28, 0);
      bodice.scale.set(1, 1, 0.7);
      group.add(bodice);

      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.36, 0.72, 32, 1, true), primaryMat);
      skirt.position.set(0, -0.22, 0);
      skirt.scale.set(1, 1, 0.85);
      group.add(skirt);
    } else if (silhouette === 'trench' || silhouette === 'biker') {
      // Structured jacket with lapels and sleeves
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.65, 0.18), primaryMat);
      body.position.set(0, 0.12, 0);
      group.add(body);

      const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.02), goldMat);
      lapelL.position.set(-0.08, 0.32, 0.095);
      lapelL.rotation.z = -0.15;
      group.add(lapelL);

      const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.02), goldMat);
      lapelR.position.set(0.08, 0.32, 0.095);
      lapelR.rotation.z = 0.15;
      group.add(lapelR);
    } else if (silhouette === 'wide-jeans' || silhouette === 'slacks') {
      // High-rise jeans with contoured legs
      const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.18, 24), primaryMat);
      waist.position.set(0, 0.32, 0);
      waist.scale.set(1, 1, 0.7);
      group.add(waist);

      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.75, 24), primaryMat);
      leftLeg.position.set(-0.11, -0.12, 0);
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.75, 24), primaryMat);
      rightLeg.position.set(0.11, -0.12, 0);
      group.add(rightLeg);
    } else if (silhouette === 'handbag') {
      // Luxury structured quilted bag with metal hardware
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.16), primaryMat);
      body.position.set(0, 0.13, 0);
      group.add(body);

      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.015), primaryMat);
      flap.position.set(0, 0.18, 0.082);
      group.add(flap);

      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.015), goldMat);
      clasp.position.set(0, 0.11, 0.092);
      group.add(clasp);

      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 12, 32, Math.PI), goldMat);
      strap.position.set(0, 0.29, 0);
      group.add(strap);
    } else {
      const fallback = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 32), primaryMat);
      fallback.position.set(0, 0.18, 0);
      group.add(fallback);
    }

    group.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    return group;
  }, [silhouette, color, roughness, metalness]);

  return <primitive object={meshGroup} />;
}

// 3D Realistic Garment Component
export default function Garment3D({
  product,
  position = [0, 0, 0],
  isSelected = false,
  onSelect = () => {}
}) {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const randomOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  // Soft floating ambient movement
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * 1.5 + randomOffset) * 0.03;
    groupRef.current.rotation.y = Math.sin(t * 0.7 + randomOffset) * 0.06;
  });

  const primaryCol = product.primaryColor || '#ffffff';

  // If shoe product, do not render in 3D boutique room scene
  const isShoe = product.category === 'shoes' || product.silhouette === 'sneakers' || product.silhouette === 'stilettos' || product.silhouette === 'sandals';
  if (isShoe) return null;
  const shoeGltf = null;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(product);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Selection Glow Ring on Base */}
      <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.26, 0.34, 32]} />
        <meshBasicMaterial
          color={isSelected ? '#f472b6' : hovered ? '#fcd34d' : '#e5c89f'}
          transparent
          opacity={isSelected ? 0.85 : hovered ? 0.6 : 0.2}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Spotlight for selected or hovered item */}
      {(hovered || isSelected) && (
        <pointLight
          position={[0, 0.2, 0.4]}
          intensity={isSelected ? 1.6 : 0.8}
          color={isSelected ? '#f472b6' : '#fff3d6'}
          distance={2.4}
        />
      )}

      {/* Render 3D Model: Realistic Shoe GLTF or Realistic Drapery Cloth Mesh */}
      {isShoe && shoeGltf?.scene ? (
        <group position={[0, -0.2, 0]} scale={[1.8, 1.8, 1.8]}>
          <primitive object={shoeGltf.scene.clone(true)} />
        </group>
      ) : (
        <ClothMesh
          silhouette={product.silhouette}
          color={primaryCol}
          roughness={product.silhouette?.includes('satin') ? 0.25 : 0.55}
          metalness={product.silhouette?.includes('satin') ? 0.2 : 0.05}
        />
      )}
    </group>
  );
}

useGLTF.preload('/models/shoe_luxury.glb');
