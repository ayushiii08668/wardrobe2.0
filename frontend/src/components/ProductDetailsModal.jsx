import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShoppingBag,
  Heart,
  Star,
  Check,
  ShieldCheck,
  Truck,
  RotateCcw
} from 'lucide-react';

export default function ProductDetailsModal({
  product,
  onClose,
  onTryOn,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  isCurrentlyTriedOn = false
}) {
  if (!product) return null;

  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || 'M');
  const [selectedColor, setSelectedColor] = useState(
    product.colors?.[0] || { name: 'Default', hex: product.primaryColor || '#fff' }
  );
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const handleAddToCart = () => {
    onAddToCart({
      ...product,
      selectedSize,
      selectedColor,
      quantity
    });
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2200);
  };

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
          {/* Left Column: Image Preview & Visual Badge */}
          <div className="product-media-column">
            <div className="product-image-container">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="product-image"
                  loading="lazy"
                />
              ) : (
                <div className="product-image-fallback">
                  <Sparkles size={48} className="text-purple-300 animate-pulse" />
                </div>
              )}

              {product.discountPrice && (
                <span className="discount-pill">
                  Save ${product.price - product.discountPrice}
                </span>
              )}

              <span className="category-pill">{product.category.toUpperCase()}</span>
            </div>

            <div className="perks-badge-row">
              <div className="perk-item">
                <Truck size={14} />
                <span>Free Express Delivery</span>
              </div>
              <div className="perk-item">
                <RotateCcw size={14} />
                <span>30-Day Free Returns</span>
              </div>
              <div className="perk-item">
                <ShieldCheck size={14} />
                <span>100% Authentic Maison</span>
              </div>
            </div>
          </div>

          {/* Right Column: Information, Swatches, Sizing & Actions */}
          <div className="product-info-column">
            <div className="product-brand-line">
              <span className="brand-name">{product.brand || 'WardrobeWise Atelier'}</span>
              <div className="rating-pill">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span>{product.rating || 4.9}</span>
                <span className="reviews-count">({product.reviewsCount || 84})</span>
              </div>
            </div>

            <h2 className="product-title">{product.name}</h2>

            <div className="product-pricing">
              {product.discountPrice ? (
                <>
                  <span className="current-price">${product.discountPrice}</span>
                  <span className="original-price">${product.price}</span>
                  <span className="tag-save">
                    {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                  </span>
                </>
              ) : (
                <span className="current-price">${product.price}</span>
              )}
              {product.inStock && (
                <span className="stock-pill">
                  <span className="stock-dot" /> In Stock Ready to Ship
                </span>
              )}
            </div>

            <p className="product-desc">{product.description}</p>

            {/* Colors Swatches */}
            {product.colors && product.colors.length > 0 && (
              <div className="product-option-section">
                <div className="option-label-row">
                  <span className="option-title">Color</span>
                  <span className="option-value">{selectedColor.name}</span>
                </div>
                <div className="color-swatch-list">
                  {product.colors.map((c, i) => {
                    const isSelected = selectedColor.name === c.name;
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

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="product-option-section">
                <div className="option-label-row">
                  <span className="option-title">Size</span>
                  <span className="size-guide-link">Size Guide</span>
                </div>
                <div className="size-badge-list">
                  {product.sizes.map((s) => {
                    const isSelected = selectedSize === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSelectedSize(s)}
                        className={`size-badge-btn ${isSelected ? 'active' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="quantity-row">
              <span className="option-title">Quantity</span>
              <div className="qty-control-box">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="qty-btn"
                >
                  -
                </button>
                <span className="qty-value">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="qty-btn"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="modal-actions-row">
              {/* Virtual Try-On Button */}
              <button
                onClick={() => onTryOn({ ...product, color: selectedColor.hex })}
                className={`try-on-hero-btn ${isCurrentlyTriedOn ? 'active' : ''}`}
              >
                <Sparkles size={18} className="animate-spin-slow" />
                <span>{isCurrentlyTriedOn ? 'Currently Wearing' : 'Try On Avatar (3D)'}</span>
              </button>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                className={`add-cart-hero-btn ${addedSuccess ? 'success' : ''}`}
              >
                <ShoppingBag size={18} />
                <span>{addedSuccess ? 'Added to Bag ✓' : 'Add to Bag'}</span>
              </button>

              {/* Wishlist Button */}
              <button
                onClick={() => onToggleWishlist(product)}
                className={`wishlist-icon-btn ${isWishlisted ? 'favorited' : ''}`}
                title={isWishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
              >
                <Heart size={20} className={isWishlisted ? 'fill-pink-500 text-pink-500' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

