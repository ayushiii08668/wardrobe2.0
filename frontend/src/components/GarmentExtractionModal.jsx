import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Scissors,
  CheckCircle,
  AlertCircle,
  X,
  RotateCcw,
  Shirt,
  Layers,
  Palette,
  Tag,
  Sun,
  Calendar,
  Check,
  Compass
} from 'lucide-react';

export const COLOR_OPTIONS = [
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Navy Blue', hex: '#1e3a8a' },
  { name: 'Black', hex: '#1c1c1f' },
  { name: 'White', hex: '#f8fafc' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Beige', hex: '#d4b79b' },
  { name: 'Brown', hex: '#78350f' },
  { name: 'Purple', hex: '#9333ea' },
  { name: 'Grey', hex: '#6b7280' },
];

export const CATEGORY_OPTIONS = [
  'Frock',
  'Dress',
  'Top',
  'T-Shirt',
  'Shirt',
  'Jeans',
  'Trousers',
  'Jacket',
  'Skirt',
  'Saree',
  'Kurti',
  'Shoes',
  'Accessories'
];

export const PATTERN_OPTIONS = ['Plain', 'Floral', 'Striped', 'Checked', 'Printed'];

export const MATERIAL_OPTIONS = [
  'Cotton',
  'Silk',
  'Chiffon',
  'Denim',
  'Satin',
  'Linen',
  'Wool',
  'Leather',
  'Rayon',
  'Other'
];

export const OCCASION_OPTIONS = [
  'Party',
  'Casual',
  'College',
  'Work',
  'Dinner',
  'Wedding',
  'Festive',
  'Travel'
];

export const SEASON_OPTIONS = [
  'Summer',
  'Winter',
  'Spring',
  'Autumn',
  'Monsoon'
];

export const STYLE_OPTIONS = [
  'Chic',
  'Casual',
  'Elegant',
  'Streetwear',
  'Minimalist',
  'Romantic',
  'Traditional'
];

function findClosestColor(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 'Pink';
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length < 6) return 'Pink';
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  let minDistance = Infinity;
  let bestColor = 'Pink';

  for (const opt of COLOR_OPTIONS) {
    const oHex = opt.hex.replace('#', '');
    const or = parseInt(oHex.substring(0, 2), 16);
    const og = parseInt(oHex.substring(2, 4), 16);
    const ob = parseInt(oHex.substring(4, 6), 16);
    const dist = Math.hypot(r - or, g - og, b - ob);
    if (dist < minDistance) {
      minDistance = dist;
      bestColor = opt.name;
    }
  }
  return bestColor;
}

/**
 * GarmentExtractionModal
 * Gives users an interactive verification checkpoint where they can inspect
 * the extracted garment (with person and background removed) on a transparent
 * checkerboard background, answer/review details (color, category, pattern,
 * material, occasions, season, style) to ground RAG retrieval, and proceed to 3D virtual try-on.
 */
export default function GarmentExtractionModal({
  isOpen,
  onClose,
  stage, // 'extracting' | 'preview' | 'synthesizing' | 'complete' | 'error'
  originalImage,
  extractedImage,
  maskImage,
  geminiData,
  onConfirm3D,
  onRetry,
  errorMessage,
}) {
  const [name, setName] = useState('Pink Tiered Floral Frock');
  const [category, setCategory] = useState('Dress');
  const [subCategory, setSubCategory] = useState('Tiered Frock');
  const [colorName, setColorName] = useState('Pink');
  const [colorHex, setColorHex] = useState('#ec4899');
  const [pattern, setPattern] = useState('Floral');
  const [material, setMaterial] = useState('Chiffon');
  const [occasions, setOccasions] = useState(['Party', 'Casual']);
  const [seasons, setSeasons] = useState(['Summer', 'Spring']);
  const [styles, setStyles] = useState(['Chic', 'Romantic']);

  // Pre-fill form when geminiData arrives or updates
  useEffect(() => {
    if (!geminiData) return;

    if (geminiData.name) {
      setName(geminiData.name);
    }

    if (geminiData.category) {
      const c = geminiData.category.toLowerCase();
      if (c.includes('frock')) setCategory('Frock');
      else if (c.includes('dress')) setCategory('Dress');
      else if (c.includes('jeans')) setCategory('Jeans');
      else if (c.includes('trouser') || c.includes('pant')) setCategory('Trousers');
      else if (c.includes('t-shirt') || c.includes('tee')) setCategory('T-Shirt');
      else if (c.includes('shirt')) setCategory('Shirt');
      else if (c.includes('jacket') || c.includes('coat')) setCategory('Jacket');
      else if (c.includes('skirt')) setCategory('Skirt');
      else if (c.includes('saree')) setCategory('Saree');
      else if (c.includes('kurti')) setCategory('Kurti');
      else if (c.includes('shoe')) setCategory('Shoes');
      else setCategory('Top');
    }

    if (geminiData.primaryColor) {
      setColorHex(geminiData.primaryColor);
      const matched = findClosestColor(geminiData.primaryColor);
      if (matched) setColorName(matched);
    }

    if (geminiData.pattern) {
      const p = geminiData.pattern.toLowerCase();
      if (p.includes('floral')) setPattern('Floral');
      else if (p.includes('strip')) setPattern('Striped');
      else if (p.includes('check')) setPattern('Checked');
      else if (p.includes('print')) setPattern('Printed');
      else setPattern('Plain');
    }

    if (geminiData.fabric) {
      const f = geminiData.fabric.toLowerCase();
      if (f.includes('cotton')) setMaterial('Cotton');
      else if (f.includes('silk')) setMaterial('Silk');
      else if (f.includes('chiffon')) setMaterial('Chiffon');
      else if (f.includes('satin')) setMaterial('Satin');
      else if (f.includes('denim')) setMaterial('Denim');
      else if (f.includes('linen')) setMaterial('Linen');
      else if (f.includes('wool')) setMaterial('Wool');
    }

    if (geminiData.silhouette) {
      const formatted = geminiData.silhouette.replace(/-/g, ' ');
      setSubCategory(formatted.replace(/\b\w/g, (ch) => ch.toUpperCase()));
    }
  }, [geminiData]);

  if (!isOpen) return null;

  const handleColorChange = (hex) => {
    setColorHex(hex);
    const closest = findClosestColor(hex);
    if (closest) setColorName(closest);
  };

  const handleColorNameSelect = (name) => {
    setColorName(name);
    const match = COLOR_OPTIONS.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (match) setColorHex(match.hex);
  };

  const toggleOccasion = (occ) => {
    setOccasions((prev) =>
      prev.includes(occ) ? (prev.length > 1 ? prev.filter((o) => o !== occ) : prev) : [...prev, occ]
    );
  };

  const toggleSeason = (season) => {
    setSeasons((prev) =>
      prev.includes(season) ? (prev.length > 1 ? prev.filter((s) => s !== season) : prev) : [...prev, season]
    );
  };

  const toggleStyle = (st) => {
    setStyles((prev) =>
      prev.includes(st) ? (prev.length > 1 ? prev.filter((s) => s !== st) : prev) : [...prev, st]
    );
  };

  const handleConfirm = () => {
    const details = {
      name: name.trim() || 'Uploaded Clothing Item',
      category,
      subCategory: subCategory.trim() || category,
      color: colorName,
      colorHex,
      primaryColor: colorHex,
      pattern,
      material,
      occasions,
      seasons,
      style: styles,
      tags: [
        ...occasions.map((o) => o.toLowerCase()),
        ...seasons.map((s) => s.toLowerCase()),
        ...styles.map((s) => s.toLowerCase()),
        colorName.toLowerCase(),
        pattern.toLowerCase(),
        material.toLowerCase(),
        category.toLowerCase(),
        'custom',
        'wardrobe',
      ],
    };
    onConfirm3D(details);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 5, 12, 0.85)',
        backdropFilter: 'blur(10px)',
        padding: '1.25rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          backgroundColor: '#13111c',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(168, 85, 247, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.18), rgba(236, 72, 153, 0.18))',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(168, 85, 247, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
              }}
            >
              <Scissors size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Garment Inspection & RAG Metadata Details
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                AI segmentation removes background/person • Fill details below to power RAG stylist answers
              </p>
            </div>
          </div>
          {stage !== 'extracting' && stage !== 'synthesizing' && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.25rem',
                borderRadius: '0.375rem',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Loading / Extracting State */}
          {(stage === 'extracting' || stage === 'synthesizing') && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1rem',
                gap: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  border: '3px solid rgba(168, 85, 247, 0.2)',
                  borderTopColor: '#c084fc',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
                  {stage === 'extracting'
                    ? 'Removing Person & Background…'
                    : 'Synthesizing & Rigging 3D Garment Mesh…'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                  {stage === 'extracting'
                    ? 'Extracting ONLY the clothing item with alpha transparency.'
                    : 'Applying bone weights and binding to avatar skeleton for walking.'}
                </p>
              </div>
            </div>
          )}

          {/* Preview State: Display extracted transparent garment + Questionnaire */}
          {stage === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Top Side-by-Side Images */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                {/* Original Image */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500 }}>
                    Original Uploaded Photo
                  </span>
                  <div
                    style={{
                      height: '190px',
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      backgroundColor: '#1e1b2e',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={originalImage}
                      alt="Original"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  </div>
                </div>

                {/* Extracted Transparent Garment (Checkerboard Pattern) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: '#4ade80',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <CheckCircle size={14} /> Extracted Garment (Alpha Cutout)
                  </span>
                  <div
                    style={{
                      height: '190px',
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      backgroundImage:
                        'linear-gradient(45deg, #1c1926 25%, transparent 25%), linear-gradient(-45deg, #1c1926 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1926 75%), linear-gradient(-45deg, transparent 75%, #1c1926 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: '#0f0e17',
                      border: '2px solid rgba(74, 222, 128, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.6)',
                    }}
                  >
                    <img
                      src={extractedImage}
                      alt="Extracted Garment"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.5))',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* RAG & Wardrobe Questionnaire Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(236, 72, 153, 0.08))',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  borderRadius: '0.85rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={18} style={{ color: '#c084fc' }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9' }}>
                      Wardrobe Details for Style Fusion Stylist
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                      Please review and adjust these questions. The AI Fashion Stylist uses these exact answers to answer questions like <em>"What should I wear to college?"</em> or <em>"Show me my pink party dress"</em>.
                    </span>
                  </div>
                </div>

                {/* Question 1: Item Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    1. Clothing Item Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pink Floral Tiered Frock"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Question 2: Category & SubCategory / Silhouette */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      2. Garment Category (Strict for RAG)
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#1a1727',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat} style={{ backgroundColor: '#1a1727', color: '#ffffff' }}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      3. Sub-Type / Silhouette Style
                    </label>
                    <input
                      type="text"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      placeholder="e.g. Tiered Frock, Slip Dress, Wide Leg"
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Question 3: Primary Color (Hex + Name) & Pattern */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      4. Color (Visual Swatch & Family)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          position: 'relative',
                          width: '38px',
                          height: '38px',
                          borderRadius: '0.5rem',
                          overflow: 'hidden',
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          backgroundColor: colorHex,
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                        title="Click to pick exact color"
                      >
                        <input
                          type="color"
                          value={colorHex.startsWith('#') ? colorHex : '#ec4899'}
                          onChange={(e) => handleColorChange(e.target.value)}
                          style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            opacity: 0,
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                      <select
                        value={colorName}
                        onChange={(e) => handleColorNameSelect(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.8rem',
                          borderRadius: '0.5rem',
                          backgroundColor: '#1a1727',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {COLOR_OPTIONS.map((col) => (
                          <option key={col.name} value={col.name} style={{ backgroundColor: '#1a1727' }}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: '#a78bfa',
                          fontFamily: 'monospace',
                          padding: '0.4rem 0.6rem',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: '0.375rem',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {colorHex}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      5. Pattern Design
                    </label>
                    <select
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#1a1727',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {PATTERN_OPTIONS.map((pat) => (
                        <option key={pat} value={pat} style={{ backgroundColor: '#1a1727' }}>
                          {pat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question 4: Fabric Material */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    6. Fabric / Material
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {MATERIAL_OPTIONS.map((mat) => {
                      const isSelected = material.toLowerCase() === mat.toLowerCase();
                      return (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => setMaterial(mat)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.375rem',
                            border: isSelected ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            color: isSelected ? '#f5d0fe' : '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {mat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question 5: Suitable Occasions (Multi-Select) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    7. Suitable Occasions (Click all that apply)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {OCCASION_OPTIONS.map((occ) => {
                      const isSelected = occasions.includes(occ);
                      return (
                        <button
                          key={occ}
                          type="button"
                          onClick={() => toggleOccasion(occ)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            border: isSelected ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            color: isSelected ? '#fbcfe8' : '#94a3b8',
                            fontSize: '0.78rem',
                            fontWeight: isSelected ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected && <Check size={12} />}
                          {occ}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question 6: Best Seasons & Style Aesthetic */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      8. Weather / Seasons
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {SEASON_OPTIONS.map((seas) => {
                        const isSelected = seasons.includes(seas);
                        return (
                          <button
                            key={seas}
                            type="button"
                            onClick={() => toggleSeason(seas)}
                            style={{
                              padding: '0.3rem 0.65rem',
                              borderRadius: '0.375rem',
                              border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                              color: isSelected ? '#bae6fd' : '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                            }}
                          >
                            {seas}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      9. Style Aesthetic
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {STYLE_OPTIONS.map((st) => {
                        const isSelected = styles.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => toggleStyle(st)}
                            style={{
                              padding: '0.3rem 0.65rem',
                              borderRadius: '0.375rem',
                              border: isSelected ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                              color: isSelected ? '#e9d5ff' : '#94a3b8',
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                            }}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {stage === 'error' && (
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#f87171',
              }}
            >
              <AlertCircle size={24} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                  Segmentation / Extraction Issue
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {errorMessage || 'Unable to isolate clothing item. Please upload a clearer clothing photo.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {stage === 'preview' && (
          <div
            style={{
              padding: '0.85rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Compass size={14} style={{ color: '#c084fc' }} />
              Ready to save to MongoDB & rig to 3D avatar
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} /> Discard & Retry
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.35rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.4)',
                }}
              >
                <Sparkles size={16} /> Save Details to Wardrobe
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onRetry}
              style={{
                padding: '0.625rem 1.25rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Close & Re-upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
