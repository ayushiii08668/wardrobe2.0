import React from 'react';
import Garment3D from './Garment3D.jsx';
import { PRODUCTS } from '../data/products.js';

// Interactive 3D Clothing Displays positioned naturally around the luxury boutique
// Clean, elegant display without any floating text cluttering the room
export default function ClothingDisplays({
  selectedProductId,
  onSelectProduct,
  activeCategory = 'all'
}) {
  // Filter products if a specific category is chosen (or show all if 'all')
  // Exclude shoes from floor display as requested
  const displayedProducts = React.useMemo(() => {
    const nonShoeProducts = PRODUCTS.filter((p) => p.category !== 'shoes');
    if (!activeCategory || activeCategory === 'all') return nonShoeProducts;
    const cat = activeCategory.toLowerCase();
    return nonShoeProducts.filter((p) => {
      const pCat = p.category.toLowerCase();
      if (cat === 'trousers') return pCat === 'trousers' || pCat === 'skirts' || pCat === 'bottom';
      if (cat === 'outerwear') return pCat === 'outerwear' || pCat === 'jacket' || pCat === 'coat';
      if (cat === 'accessories') return pCat === 'accessories' || pCat === 'accessory';
      return pCat === cat;
    });
  }, [activeCategory]);

  return (
    <group name="clothing-displays">
      {displayedProducts.map((product) => {
        const isSelected = selectedProductId === product.id;
        return (
          <Garment3D
            key={product.id}
            product={product}
            position={product.position3D || [0, 2, 0]}
            isSelected={isSelected}
            onSelect={() => onSelectProduct(product)}
          />
        );
      })}

      {/* Tops Display Rail (Back Wall Left) - Champagne Gold & Rose Gold Accents */}
      <group position={[-1.8, 2.7, -1.8]}>
        {/* Suspension rods from ceiling */}
        <mesh position={[-0.9, 1.2, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 2.4, 12]} />
          <meshStandardMaterial color="#f0d5a8" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0.9, 1.2, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 2.4, 12]} />
          <meshStandardMaterial color="#f0d5a8" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Horizontal Brushed Champagne-Gold Clothing Rail */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 2.2, 16]} />
          <meshStandardMaterial color="#f0d5a8" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* Dress Showcase: Calacatta Marble & Illuminated Glass Pedestal */}
      <group position={[2.6, 0.12, 0.4]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <cylinderGeometry args={[0.95, 1.05, 0.24, 32]} />
          <meshStandardMaterial color="#fdfbf8" roughness={0.18} metalness={0.12} />
        </mesh>
        {/* Soft underglow halo */}
        <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.88, 1.08, 32]} />
          <meshBasicMaterial color="#fcd34d" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Shoes & Accessories Display Bench: Frosted Glass & Gold Frame */}
      <group position={[-2.4, 0.18, 1.4]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.035, 0.6]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.1}
            transmission={0.85}
            transparent
            opacity={0.88}
          />
        </mesh>
        {/* Champagne-Gold Frame Legs */}
        {[-0.82, 0.82].map((x, i) => (
          <React.Fragment key={i}>
            <mesh position={[x, 0.16, -0.25]}>
              <cylinderGeometry args={[0.012, 0.012, 0.36, 12]} />
              <meshStandardMaterial color="#f0d5a8" metalness={0.95} roughness={0.15} />
            </mesh>
            <mesh position={[x, 0.16, 0.25]}>
              <cylinderGeometry args={[0.012, 0.012, 0.36, 12]} />
              <meshStandardMaterial color="#f0d5a8" metalness={0.95} roughness={0.15} />
            </mesh>
          </React.Fragment>
        ))}
      </group>
    </group>
  );
}
