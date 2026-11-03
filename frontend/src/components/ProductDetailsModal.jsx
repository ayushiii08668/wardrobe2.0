import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Heart,
  Check,
  Tag,
  Layers,
  Palette,
  Sun,
  Calendar,
  Compass
} from 'lucide-react';

/**
 * ProductDetailsModal
 * Clean Digital Wardrobe Garment Inspector for Virtual Try-On.
 * Displays only authentic clothing information, fabric, pattern, occasions,
 * and 3D avatar fitting controls (no e-commerce pricing, sizes, cart, or quantity).
 */
export default function ProductDetailsModal({
  product,
  onClose,
  onTryOn,
  onToggleWishlist,
  isWishlisted = false,
  isCurrentlyTriedOn = false
}) {
  if (!product) return null;

  const [selectedColor, setSelectedColor] = useState(
    product.colors?.[0] || { name: product.colorName || 'Default', hex: product.primaryColor || '#fff' }
  );

  const categoryName = (product.category || 'Garment').toUpperCase();
  const subCategoryName = product.subCategory || product.silhouette;

  return (
    <div className="product-modal-backdrop" onClick={onClose}>
      <div className="product-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <div className="product-modal-grid">
          {/* Left Column: Image Preview & Visual Details */}
          <div className="product-media-column">
            <div className="product-image-container">
              {product.image || product.extractedImage ? (
                <img
                  src={product.image || product.extractedImage}
                  alt={product.name}
                  className="product-image"
                  style={{
                    backgroundColor: '#13111c',
                    objectFit: 'contain',
                    padding: '12px'
                  }}
                  loading="lazy"
                />
              ) : (
                <div className="product-image-fallback">
                  <Sparkles size={48} className="text-purple-300 animate-pulse" />
                </div>
              )}

              <span className="category-pill">{categoryName}</span>
            </div>

            {/* Wardrobe Attributes Card */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '11.5px',
                color: '#cbd5e1'
              }}
            >
              {product.material && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} style={{ color: '#c084fc' }} />
                  <span>Fabric: <strong style={{ color: '#ffffff' }}>{product.material}</strong></span>
                </div>
              )}
              {product.pattern && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={13} style={{ color: '#38bdf8' }} />
                  <span>Pattern: <strong style={{ color: '#ffffff' }}>{product.pattern}</strong></span>
                </div>
              )}
              {product.occasion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} style={{ color: '#ec4899' }} />
                  <span>
                    Occasion:{' '}
                    <strong style={{ color: '#ffffff' }}>
                      {Array.isArray(product.occasion) ? product.occasion.join(', ') : product.occasion}
                    </strong>
                  </span>
                </div>
              )}
              {product.season && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sun size={13} style={{ color: '#facc15' }} />
                  <span>
                    Season:{' '}
                    <strong style={{ color: '#ffffff' }}>
                      {Array.isArray(product.season) ? product.season.join(', ') : product.season}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Garment Information & Try-On Action */}
          <div className="product-info-column" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Brand / Closet Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="brand-name-label">
                {product.brand || 'Personal Wardrobe'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '999px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Sparkles size={11} /> 3D Virtual Try-On
              </span>
            </div>

            {/* Title & SubCategory */}
            <div>
              <h2 className="product-title" style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700 }}>
                {product.name}
              </h2>
              {subCategoryName && (
                <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500 }}>
                  Style / Cut: {subCategoryName}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="product-desc" style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#94a3b8' }}>
                {product.description}
              </p>
            )}

            {/* Color Swatch */}
            {product.colors && product.colors.length > 0 && (
              <div className="product-option-section">
                <div className="option-label-row">
                  <span className="option-title">Color Hue</span>
                  <span className="option-value">{selectedColor.name}</span>
                </div>
                <div className="color-swatch-list">
                  {product.colors.map((c, i) => {
                    const isSelected = selectedColor.name === c.name || selectedColor.hex === c.hex;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedColor(c)}
                        className={`color-swatch-btn ${isSelected ? 'active' : ''}`}
                        title={c.name}
                      >
                        <span
                          className="color-circle"
                          style={{ backgroundColor: c.hex }}
                        />
                        {isSelected && <Check size={12} className="swatch-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags / Style Chips */}
            {product.tags && product.tags.length > 0 && (
              <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#94a3b8',
                    marginBottom: '6px'
                  }}
                >
                  Wardrobe Tags
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {product.tags.slice(0, 8).map((t, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1'
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons: 3D Try-On & Favorite */}
            <div className="modal-actions-row" style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
              {/* Virtual Try-On Button */}
              <button
                onClick={() => onTryOn({ ...product, color: selectedColor.hex })}
                className={`try-on-hero-btn ${isCurrentlyTriedOn ? 'active' : ''}`}
                style={{
                  flex: 1,
                  height: '46px',
                  borderRadius: '12px',
                  background: isCurrentlyTriedOn
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: isCurrentlyTriedOn
                    ? '0 6px 20px rgba(16, 185, 129, 0.35)'
                    : '0 6px 20px rgba(168, 85, 247, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isCurrentlyTriedOn ? (
                  <>
                    <Check size={18} />
                    <span>Currently Wearing on Avatar</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Try On Avatar (3D)</span>
                  </>
                )}
              </button>

              {/* Wishlist / Favorite Button */}
              {onToggleWishlist && (
                <button
                  onClick={() => onToggleWishlist(product)}
                  className={`wishlist-icon-btn ${isWishlisted ? 'favorited' : ''}`}
                  title={isWishlisted ? 'Remove from Favorites' : 'Save to Favorites'}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: isWishlisted ? '#ec4899' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Heart size={20} className={isWishlisted ? 'fill-pink-500 text-pink-500' : ''} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
