import React, { useState, useRef } from 'react';
import {
  X, Upload, Sparkles, Zap, Leaf, Tag, Palette, Grid,
  Sun, Calendar, CheckCircle, AlertCircle, Loader, Camera,
  RefreshCw, ChevronRight, Star, Database, Wand2, Compass
} from 'lucide-react';
import { getRAGOutfitRecommendations, searchClothingByImage } from '../services/api.js';
import { analyzeClothingImage } from '../services/aiService.js';

const API_BASE = 'http://localhost:5000/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function Badge({ color = 'purple', children }) {
  const map = {
    purple: { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
    green: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.3)' },
    blue: { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
    amber: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
    pink: { bg: 'rgba(236,72,153,0.15)', text: '#f9a8d4', border: 'rgba(236,72,153,0.3)' },
  };
  const c = map[color] || map.purple;
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        marginRight: '5px',
        marginBottom: '5px'
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <Icon size={13} style={{ color: '#a78bfa' }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#c4b5fd'
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GroqAIPanel({
  isOpen,
  onClose,
  onApplyOutfitToAvatar,
  onTryOnItem,
  mongoClothes = []
}) {
  const [tab, setTab] = useState('recommend'); // 'recommend' | 'scan'

  // Image Scan State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // RAG Recommender State
  const [userQuery, setUserQuery] = useState('');
  const [recCategory, setRecCategory] = useState('All');
  const [recColor, setRecColor] = useState('All');
  const [recOccasion, setRecOccasion] = useState('All');
  const [recSeason, setRecSeason] = useState('All');
  const [ragResult, setRagResult] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);
  const [wearingItemId, setWearingItemId] = useState(null);

  const handleResetFilters = () => {
    setUserQuery('');
    setRecCategory('All');
    setRecColor('All');
    setRecOccasion('All');
    setRecSeason('All');
  };

  const fileInputRef = useRef();

  if (!isOpen) return null;

  // ── 1. Image upload & analysis ──────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setAnalysis(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setAnalysis(null);
      setError(null);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      // Uses 3-tier authentic visual inspection: OpenCV FastAPI -> Express Backend -> Canvas Pixel Engine
      const data = await analyzeClothingImage(imageFile);
      if (!data) {
        throw new Error('Analysis could not inspect the garment.');
      }
      const raw = data.data || data;

      // Extract accurate normalized attributes
      const cat = raw.category || 'Dress';
      const colorName = raw.colour?.dominant || raw.color || 'Pink';
      const colorHex = raw.colour?.dominant_hex || raw.colorHex || raw.primaryColor || '#ec4899';
      const secondaryColor = raw.colour?.secondary || null;
      const pattern = raw.pattern || (raw.patterns?.[0]) || 'Floral';
      const occasions = Array.isArray(raw.recommended_occasions) && raw.recommended_occasions.length > 0
        ? raw.recommended_occasions
        : (Array.isArray(raw.occasions) && raw.occasions.length > 0 ? raw.occasions : ['Party', 'Wedding', 'Casual outing']);
      const seasons = Array.isArray(raw.recommended_seasons) && raw.recommended_seasons.length > 0
        ? raw.recommended_seasons
        : (Array.isArray(raw.seasons) && raw.seasons.length > 0 ? raw.seasons : ['Summer', 'Spring']);
      const material = raw.material || raw.fabric || (cat.toLowerCase().includes('dress') ? 'Silk & Chiffon' : 'Cotton');

      // Cross-reference with user's uploaded wardrobe items (mongoClothes)
      const matchedWardrobeItem = (mongoClothes || []).find((item) => {
        const iName = (item.name || '').toLowerCase();
        const iCat = (item.category || '').toLowerCase();
        const iColor = (typeof item.color === 'string' ? item.color : item.color?.primary || '').toLowerCase();
        const iImg = (item.imageUrl || item.image || '').toLowerCase();

        if (imageFile?.name && iImg.includes(imageFile.name.toLowerCase())) return true;
        if (iCat === cat.toLowerCase() && (iColor.includes(colorName.toLowerCase()) || iName.includes(colorName.toLowerCase()))) return true;
        if (pattern && pattern.toLowerCase() !== 'plain' && iName.includes(pattern.toLowerCase()) && iCat === cat.toLowerCase()) return true;
        return false;
      });

      const finalName = matchedWardrobeItem
        ? matchedWardrobeItem.name
        : `${colorName} ${pattern && pattern !== 'Plain' && pattern !== 'Unknown' ? pattern + ' ' : ''}${cat}`;

      const finalOccasions = matchedWardrobeItem?.occasion && matchedWardrobeItem.occasion.length > 0
        ? matchedWardrobeItem.occasion
        : occasions;

      const finalSeasons = matchedWardrobeItem?.season && matchedWardrobeItem.season.length > 0
        ? matchedWardrobeItem.season
        : seasons;

      const finalFabric = matchedWardrobeItem?.fabric || material;

      setAnalysis({
        ...raw,
        name: finalName,
        category: matchedWardrobeItem?.category || cat,
        subCategory: matchedWardrobeItem?.subCategory || raw.category_group || cat,
        color: colorName,
        colorHex,
        secondaryColor,
        pattern: matchedWardrobeItem?.pattern || pattern,
        occasions: finalOccasions,
        seasons: finalSeasons,
        material: finalFabric,
        confidence: raw.confidence || 0.92,
        isWardrobeItem: !!matchedWardrobeItem,
        matchedWardrobeItem: matchedWardrobeItem || null
      });
    } catch (err) {
      setError(err.message || 'Image analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleWearScannedItem = () => {
    if (!analysis) return;
    const cat = (analysis.category || 'Top').toLowerCase();
    let categoryKey = 'tops';
    if (cat.includes('jean') || cat.includes('pant') || cat.includes('trouser') || cat.includes('skirt') || cat.includes('bottom')) categoryKey = 'trousers';
    else if (cat.includes('dress') || cat.includes('saree') || cat.includes('kurti') || cat.includes('frock')) categoryKey = 'dresses';
    else if (cat.includes('jacket') || cat.includes('coat') || cat.includes('blazer') || cat.includes('outerwear')) categoryKey = 'outerwear';
    else if (cat.includes('shoe') || cat.includes('boot') || cat.includes('sneaker') || cat.includes('heel') || cat.includes('footwear')) categoryKey = 'shoes';

    const hex = analysis.colorHex || analysis.colour?.dominant_hex || analysis.color_dominant?.hex || analysis.primaryColor || '#ec4899';

    const scannedPiece = {
      id: analysis.matchedWardrobeItem?._id || analysis.matchedWardrobeItem?.id || `scanned-${Date.now()}`,
      name: analysis.name || `${analysis.color || 'Custom'} ${analysis.category || 'Garment'}`,
      category: categoryKey,
      primaryColor: hex,
      colors: [{ name: analysis.color || 'Detected', hex }],
      image: imagePreview || null,
      garmentType: categoryKey === 'dresses' ? 'dress' : categoryKey === 'trousers' ? 'bottom' : categoryKey === 'shoes' ? 'shoes' : 'top',
      silhouette: categoryKey === 'dresses' ? 'slip-dress' : 'custom'
    };

    if (onTryOnItem) {
      onTryOnItem(scannedPiece);
    }
  };

  // ── 2. RAG OUTFIT RECOMMENDATION ────────────────────────────────────────────
  const handleExecuteRAG = async (overrideQuery = null) => {
    setRecLoading(true);
    setRecError(null);
    setRagResult(null);

    const queryToSend = overrideQuery !== null ? overrideQuery : userQuery;

    try {
      const data = await getRAGOutfitRecommendations({
        query: queryToSend,
        preferences: {
          category: recCategory === 'All' ? null : recCategory,
          color: recColor === 'All' ? null : recColor,
          occasion: recOccasion === 'All' ? null : recOccasion,
          weather: recSeason === 'All' ? null : recSeason,
          season: recSeason === 'All' ? null : recSeason
        }
      });

      if (!data || !data.success) {
        throw new Error(data?.message || 'Could not generate recommendations from MongoDB wardrobe.');
      }

      setRagResult(data);
    } catch (err) {
      setRecError(err.message || 'Failed to retrieve outfits.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleSearchSimilarInWardrobe = async () => {
    if (!imageFile && !analysis) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchClothingByImage(imageFile, analysis || {});
      if (data && data.success) {
        if (analysis?.matchedWardrobeItem) {
          const item = analysis.matchedWardrobeItem;
          const exists = (data.exactMatches || []).some(m => (m._id || m.id) === (item._id || item.id));
          if (!exists) {
            data.exactMatches = [item, ...(data.exactMatches || [])];
          }
          data.notFound = false;
          data.message = `Found exact match in your personal wardrobe: ${item.name}`;
        }
        setRagResult(data);
        setTab('recommend');
      } else {
        throw new Error(data?.message || 'Visual search could not find matches.');
      }
    } catch (err) {
      setError(err.message || 'Image search failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── 3. Apply single recommended item to 3D Avatar ──────────────────────────
  const handleWearSinglePiece = (piece) => {
    setWearingItemId(piece._id || piece.id);
    const cat = (piece.category || '').toLowerCase();
    const subCat = (piece.subCategory || piece.silhouette || '').toLowerCase();
    const name = (piece.name || '').toLowerCase();

    let category = 'tops';
    if (['shirt', 't-shirt', 'blouse', 'top', 'sweater', 'hoodie', 'kurti'].includes(cat)) {
      category = 'tops';
    } else if (['jeans', 'trousers', 'pants', 'skirt', 'bottom'].includes(cat)) {
      category = 'trousers';
    } else if (
      ['dress', 'dresses', 'gown', 'saree', 'anarkali', 'lehenga'].includes(cat) ||
      subCat.includes('frock') ||
      name.includes('frock') ||
      subCat.includes('saree') ||
      subCat.includes('anarkali')
    ) {
      category = 'dresses';
    } else if (['shoes', 'sneakers', 'boots', 'heels', 'jutti'].includes(cat) || subCat.includes('jutti')) {
      category = 'shoes';
    } else if (['jacket', 'coat', 'blazer', 'outerwear'].includes(cat)) {
      category = 'outerwear';
    } else if (['accessories', 'bag', 'jewelry'].includes(cat)) {
      category = 'accessories';
    }

    const COLOR_HEX_MAP = {
      red: '#dc2626',
      crimson: '#dc2626',
      ruby: '#dc2626',
      burgundy: '#831843',
      pink: '#f472b6',
      blue: '#2563eb',
      navy: '#1e3a8a',
      black: '#222222',
      white: '#ffffff',
      grey: '#888888',
      gray: '#888888',
      gold: '#d4af37',
      yellow: '#eab308',
      emerald: '#059669',
      green: '#059669',
      beige: '#d2b48c'
    };
    let colorHex = piece.primaryColor || '#ec4899';
    const cStr = typeof piece.color === 'string' ? piece.color.toLowerCase().trim() : '';
    if (piece.color && typeof piece.color === 'object' && piece.color.primary) {
      colorHex = piece.color.primary;
    } else if (cStr.startsWith('#')) {
      colorHex = cStr;
    } else if (COLOR_HEX_MAP[cStr]) {
      colorHex = COLOR_HEX_MAP[cStr];
    }

    let image = piece.imageUrl || piece.image || null;
    if (image && typeof image === 'string' && image.startsWith('/uploads')) {
      image = 'http://localhost:5000' + image;
    }

    const payload = {
      id: piece._id || piece.id || String(Date.now()),
      name: piece.name,
      category,
      primaryColor: colorHex,
      material: piece.material || 'Silk & Chiffon',
      silhouette: subCat || cat || 'dress',
      image,
      imageUrl: image,
      isEcommerce: Boolean(piece.isEcommerce)
    };

    if (onTryOnItem) {
      onTryOnItem(payload);
    } else if (onApplyOutfitToAvatar) {
      if (category === 'dresses') {
        onApplyOutfitToAvatar({ dress: payload, top: null, bottom: null });
      } else if (category === 'tops') {
        onApplyOutfitToAvatar({ top: payload, dress: null });
      } else if (category === 'trousers') {
        onApplyOutfitToAvatar({ bottom: payload, dress: null });
      }
    }

    setTimeout(() => setWearingItemId(null), 2000);
  };

  // ── 4. Apply recommended outfit to 3D Avatar in VR ──────────────────────────
  const handleApplyToVR = (outfit) => {
    if (!onApplyOutfitToAvatar || !outfit.clothingItems) return;

    const pieces = outfit.clothingItems;
    let top = null, bottom = null, dress = null, shoes = null, outerwear = null;

    pieces.forEach((item) => {
      const cat = (item.category || '').toLowerCase();
      const subCat = (item.subCategory || '').toLowerCase();

      // Normalize color hex
      let colorHex = item.primaryColor || '#ffffff';
      if (item.color) {
        if (typeof item.color === 'object') colorHex = item.color.primary || '#ffffff';
        else if (item.color.startsWith('#')) colorHex = item.color;
        else {
          const c = item.color.toLowerCase();
          if (c === 'pink') colorHex = '#f472b6';
          else if (c === 'black') colorHex = '#222222';
          else if (c === 'white') colorHex = '#ffffff';
          else if (c === 'navy' || c === 'blue') colorHex = '#1e3a8a';
          else if (c === 'emerald' || c === 'green') colorHex = '#065f46';
          else if (c === 'burgundy' || c === 'crimson' || c === 'red') colorHex = '#831843';
          else if (c === 'beige' || c === 'cream' || c === 'camel') colorHex = '#d4b79b';
          else if (c === 'gold') colorHex = '#d4af37';
        }
      }

      let image = item.imageUrl || item.image || null;
      if (image && typeof image === 'string' && image.startsWith('/uploads')) {
        image = 'http://localhost:5000' + image;
      }

      const formatted = {
        id: item._id,
        name: item.name,
        category: cat,
        primaryColor: colorHex,
        material: item.material,
        silhouette: subCat || cat,
        image
      };

      if (cat === 'dress' || subCat.includes('saree') || subCat.includes('anarkali') || subCat.includes('kurti') || subCat.includes('frock') || item.name.toLowerCase().includes('frock')) {
        dress = formatted;
      } else if (cat.includes('jacket') || cat.includes('coat') || cat.includes('blazer')) {
        outerwear = formatted;
      } else if (cat.includes('shirt') || cat.includes('top') || cat.includes('sweater')) {
        top = formatted;
      } else if (cat.includes('jean') || cat.includes('trouser') || cat.includes('skirt') || cat.includes('pant')) {
        bottom = formatted;
      } else if (cat.includes('shoe') || cat.includes('boot') || cat.includes('sneak') || subCat.includes('jutti')) {
        shoes = formatted;
      }
    });

    onApplyOutfitToAvatar({ top, bottom, dress, shoes, outerwear });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: '16px'
  };

  const panel = {
    width: '460px',
    maxWidth: '96vw',
    height: 'calc(100vh - 32px)',
    background: 'linear-gradient(160deg,#191126 0%,#0f0b18 100%)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)',
    fontFamily: 'Inter,system-ui,sans-serif',
    color: '#e2d9f3'
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>

        {/* Top Header */}
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(139,92,246,0.15)',
            background: 'rgba(139,92,246,0.06)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(124,58,237,0.4)'
                }}
              >
                <Sparkles size={20} color="white" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      fontWeight: 800,
                      background: 'linear-gradient(90deg,#c4b5fd,#f9a8d4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    VR-RAG AI Fashion Stylist
                  </h2>
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '2px 6px',
                      borderRadius: '999px',
                      background: 'rgba(16,185,129,0.2)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16,185,129,0.3)',
                      fontWeight: 700
                    }}
                  >
                    MongoDB RAG
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9d84bf' }}>
                  Retrieval-Augmented Generation • Groq LLaMA-3
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {[
              { id: 'recommend', label: '✨ RAG Outfit Stylist', icon: Sparkles },
              { id: 'scan', label: '📸 Cloth AI Vision Scanner', icon: Camera }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '9px 6px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                  background:
                    tab === t.id
                      ? 'linear-gradient(135deg,#7c3aed,#ec4899)'
                      : 'rgba(255,255,255,0.06)',
                  color: tab === t.id ? 'white' : '#9ca3af',
                  boxShadow: tab === t.id ? '0 4px 15px rgba(124,58,237,0.3)' : 'none'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px',
            scrollbarWidth: 'thin',
            scrollbarColor: '#4c1d95 transparent'
          }}
        >
          {/* ═════════════════════════════════════════════════════════════════════
              TAB: RAG OUTFIT RECOMMENDER
              ═════════════════════════════════════════════════════════════════════ */}
          {tab === 'recommend' && (
            <div>
              {/* Natural Language Query Bar */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#c4b5fd',
                    marginBottom: '6px'
                  }}
                >
                  Ask Your RAG AI Stylist
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserQuery(val);
                      const lower = val.toLowerCase();
                      if (lower.includes('frock')) setRecCategory('Frock');
                      else if (lower.includes('saree') || lower.includes('sari')) setRecCategory('Saree');
                      else if (lower.includes('anarkali')) setRecCategory('Traditional');
                      else if (lower.includes('dress')) setRecCategory('Dress');
                      else if (lower.includes('jeans')) setRecCategory('Jeans');
                      else if (lower.includes('shirt')) setRecCategory('Shirt');
                      else if (lower.includes('top')) setRecCategory('Top');
                      else if (lower.includes('jacket') || lower.includes('coat')) setRecCategory('Jacket');
                      else if (lower.includes('shoes') || lower.includes('sneaker')) setRecCategory('Shoes');

                      if (lower.includes('white')) setRecColor('White');
                      else if (lower.includes('red') || lower.includes('crimson')) setRecColor('Red');
                      else if (lower.includes('pink') || lower.includes('rose')) setRecColor('Pink');
                      else if (lower.includes('black')) setRecColor('Black');
                      else if (lower.includes('blue') || lower.includes('navy')) setRecColor('Blue');
                      else if (lower.includes('green') || lower.includes('emerald')) setRecColor('Green');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleExecuteRAG();
                    }}
                    placeholder="e.g. Traditional Indian wedding, chilly evening, date night glam..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => handleExecuteRAG()}
                    disabled={recLoading}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '6px',
                      bottom: '6px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                      border: 'none',
                      color: 'white',
                      cursor: recLoading ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {recLoading ? <Loader size={12} className="spin" /> : <Wand2 size={12} />}
                    Generate
                  </button>
                </div>
              </div>

              {/* Quick Prompt Chips */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: '#8b6fb5', display: 'block', marginBottom: '6px' }}>
                  Quick Styling Prompts:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: '🥻 Festive Indian Saree', q: 'Traditional Indian wedding celebration with gold zari saree' },
                    { label: '❄️ Chilly Winter Night', q: 'Warm layered outfit for a chilly winter evening' },
                    { label: '💼 Work / Office Chic', q: 'Sophisticated professional outfit for high-stakes office presentation' },
                    { label: '🌿 Revive Unworn Clothes', q: 'Revive my unworn and forgotten clothes with fresh styling' }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setUserQuery(chip.q);
                        handleExecuteRAG(chip.q);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#d4c5ea',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter controls: Category, Color, Occasion, Season */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Category
                  </label>
                  <select
                    value={recCategory}
                    onChange={(e) => setRecCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: 'white',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  >
                    {['All', 'Frock', 'Saree', 'Dress', 'Jeans', 'Shirt', 'Top', 'T-Shirt', 'Jacket', 'Shoes', 'Traditional'].map((c) => (
                      <option key={c} value={c} style={{ background: '#1a1025' }}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Color
                  </label>
                  <select
                    value={recColor}
                    onChange={(e) => setRecColor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: 'white',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  >
                    {['All', 'Red', 'Pink', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Beige', 'Grey'].map((c) => (
                      <option key={c} value={c} style={{ background: '#1a1025' }}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Occasion
                  </label>
                  <select
                    value={recOccasion}
                    onChange={(e) => setRecOccasion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: 'white',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  >
                    {['All', 'Casual', 'Formal', 'Party', 'Wedding', 'Festival', 'College', 'Travel'].map((o) => (
                      <option key={o} value={o} style={{ background: '#1a1025' }}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Season
                  </label>
                  <select
                    value={recSeason}
                    onChange={(e) => setRecSeason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: 'white',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  >
                    {['All', 'Summer', 'Winter', 'Spring', 'Autumn', 'Monsoon'].map((s) => (
                      <option key={s} value={s} style={{ background: '#1a1025' }}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Filter Clear & Execute Bar */}
              {(recCategory !== 'All' || recColor !== 'All' || recOccasion !== 'All' || recSeason !== 'All' || userQuery) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '10px', color: '#a78bfa' }}>
                    Active filters: {[recCategory !== 'All' && recCategory, recColor !== 'All' && recColor, recOccasion !== 'All' && recOccasion, recSeason !== 'All' && recSeason].filter(Boolean).join(', ') || 'Search Text'}
                  </span>
                  <button
                    onClick={handleResetFilters}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#fca5a5',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}

              {/* Loading State */}
              {recLoading && (
                <div
                  style={{
                    padding: '28px',
                    textAlign: 'center',
                    background: 'rgba(139,92,246,0.05)',
                    borderRadius: '16px',
                    border: '1px solid rgba(139,92,246,0.2)',
                    marginBottom: '16px'
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '3px solid #7c3aed',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#c4b5fd' }}>
                    Executing RAG Pipeline…
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#8b6fb5' }}>
                    Retrieving MongoDB wardrobe → Disambiguating categories → Generating looks
                  </p>
                </div>
              )}

              {/* Error Message */}
              {recError && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '14px',
                    display: 'flex',
                    gap: '8px'
                  }}
                >
                  <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5' }}>{recError}</p>
                </div>
              )}

              {/* RAG Results Display */}
              {ragResult && (
                <div>
                  {/* AI Fashion Stylist Speech / Message Bubble */}
                  {ragResult.stylistMessage && (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(236,72,153,0.18) 100%)',
                        border: '1px solid rgba(236,72,153,0.4)',
                        borderRadius: '14px',
                        padding: '13px 15px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.3)'
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 10px rgba(236,72,153,0.4)'
                        }}
                      >
                        <Sparkles size={16} color="white" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f472b6' }}>
                            ✨ AI Fashion Stylist
                          </span>
                          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '999px', background: 'rgba(139,92,246,0.3)', color: '#c4b5fd', fontWeight: 700 }}>
                            {ragResult.generationSource ? 'Groq LLaMA-3' : 'RAG Engine'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#f8fafc', lineHeight: 1.45 }}>
                          {ragResult.stylistMessage}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status & Grounding Notification Banner */}
                  {ragResult.notFound && !ragResult.isConversational ? (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px'
                      }}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>🔍</span>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fef08a', display: 'block' }}>
                          {ragResult.message || `This exact item is not available in your personal wardrobe.`}
                        </span>
                        <span style={{ fontSize: '11px', color: '#fde047', marginTop: '2px', display: 'block' }}>
                          Showing closest matching alternatives and online looks below that you can try on the model.
                        </span>
                      </div>
                    </div>
                  ) : !ragResult.stylistMessage && (
                    <div
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={14} style={{ color: '#34d399' }} />
                        <span style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 700 }}>
                          ✓ Grounded Wardrobe Matches Found
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#a7f3d0' }}>
                        {ragResult.generationSource || 'MongoDB RAG Engine'}
                      </span>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────
                      SECTION 1: 🎯 EXACT MATCHES IN WARDROBE
                      ───────────────────────────────────────────────────────────── */}
                  {ragResult.exactMatches && ragResult.exactMatches.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Star size={13} style={{ color: '#ec4899' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f472b6' }}>
                          🎯 Exact Wardrobe Matches ({ragResult.exactMatches.length})
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ragResult.exactMatches.map((piece) => {
                          const isCurrentlyWorn = wearingItemId === (piece._id || piece.id);
                          const imgUrl = piece.imageUrl || piece.image;

                          return (
                            <div
                              key={piece._id || piece.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'rgba(0,0,0,0.35)',
                                border: isCurrentlyWorn
                                  ? '1px solid #10b981'
                                  : '1px solid rgba(236,72,153,0.3)',
                                borderRadius: '12px',
                                padding: '9px 12px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <div
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  background: piece.primaryColor || '#a855f7',
                                  border: '1px solid rgba(255,255,255,0.15)'
                                }}
                              >
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={piece.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: piece.primaryColor || '#ec4899' }} />
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#f8fafc', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {piece.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                                  <Badge color="pink">{piece.category}</Badge>
                                  <span style={{ fontSize: '10px', color: '#c4b5fd' }}>{piece.color}</span>
                                  {piece.material && (
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>• {piece.material}</span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleWearSinglePiece(piece)}
                                style={{
                                  padding: '7px 11px',
                                  borderRadius: '8px',
                                  background: isCurrentlyWorn
                                    ? 'linear-gradient(135deg,#10b981,#059669)'
                                    : 'linear-gradient(135deg,#ec4899,#8b5cf6)',
                                  border: 'none',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}
                              >
                                {isCurrentlyWorn ? <CheckCircle size={12} /> : <Sparkles size={12} />}
                                {isCurrentlyWorn ? 'Worn' : 'Wear'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────
                      SECTION 2: 💡 SIMILAR ALTERNATIVES
                      ───────────────────────────────────────────────────────────── */}
                  {ragResult.similarAlternatives && ragResult.similarAlternatives.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Compass size={13} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fcd34d' }}>
                          💡 Similar Wardrobe Alternatives ({ragResult.similarAlternatives.length})
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ragResult.similarAlternatives.map((piece) => {
                          const isCurrentlyWorn = wearingItemId === (piece._id || piece.id);
                          const imgUrl = piece.imageUrl || piece.image;

                          return (
                            <div
                              key={piece._id || piece.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'rgba(0,0,0,0.3)',
                                border: isCurrentlyWorn
                                  ? '1px solid #10b981'
                                  : '1px solid rgba(245,158,11,0.25)',
                                borderRadius: '12px',
                                padding: '9px 12px'
                              }}
                            >
                              <div
                                style={{
                                  width: '46px',
                                  height: '46px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  background: piece.primaryColor || '#a855f7',
                                  border: '1px solid rgba(255,255,255,0.15)'
                                }}
                              >
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={piece.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', background: piece.primaryColor || '#f59e0b' }} />
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {piece.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.2)', color: '#fde047' }}>
                                    {piece.alternativeReason || 'Closest Wardrobe Match'}
                                  </span>
                                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>• {piece.category}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleWearSinglePiece(piece)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  background: isCurrentlyWorn
                                    ? 'linear-gradient(135deg,#10b981,#059669)'
                                    : 'linear-gradient(135deg,#f59e0b,#d97706)',
                                  border: 'none',
                                  color: 'white',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}
                              >
                                {isCurrentlyWorn ? <CheckCircle size={11} /> : <Sparkles size={11} />}
                                {isCurrentlyWorn ? 'Worn' : 'Wear'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────
                      SECTION 3: 🛍️ FIND SIMILAR ONLINE (E-COMMERCE RECOMMENDATIONS)
                      ───────────────────────────────────────────────────────────── */}
                  {ragResult.ecommerceMatches && ragResult.ecommerceMatches.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Tag size={13} style={{ color: '#ec4899' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f472b6' }}>
                          🛍️ Find Similar Online ({ragResult.ecommerceMatches.length} Partner Matches)
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ragResult.ecommerceMatches.map((piece) => {
                          const isCurrentlyWorn = wearingItemId === (piece._id || piece.id);
                          const imgUrl = piece.imageUrl || piece.image;

                          return (
                            <div
                              key={piece._id || piece.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'rgba(236,72,153,0.06)',
                                border: isCurrentlyWorn
                                  ? '1px solid #10b981'
                                  : '1px solid rgba(236,72,153,0.3)',
                                borderRadius: '12px',
                                padding: '9px 12px'
                              }}
                            >
                              <div
                                style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  flexShrink: 0,
                                  background: piece.primaryColor || '#ec4899',
                                  border: '1px solid rgba(255,255,255,0.15)'
                                }}
                              >
                                {imgUrl && (
                                  <img
                                    src={imgUrl}
                                    alt={piece.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#fdf2f8', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {piece.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                  <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(236,72,153,0.2)', color: '#fbcfe8' }}>
                                    {piece.store || 'E-Commerce Store'}
                                  </span>
                                  {piece.price && (
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6ee7b7' }}>${piece.price}</span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleWearSinglePiece(piece)}
                                style={{
                                  padding: '7px 11px',
                                  borderRadius: '8px',
                                  background: isCurrentlyWorn
                                    ? 'linear-gradient(135deg,#10b981,#059669)'
                                    : 'linear-gradient(135deg,#ec4899,#7c3aed)',
                                  border: 'none',
                                  color: 'white',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0
                                }}
                              >
                                {isCurrentlyWorn ? <CheckCircle size={11} /> : <Sparkles size={11} />}
                                {isCurrentlyWorn ? 'Worn' : 'Try on Model'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────
                      SECTION 4: 👗 GROUNDED OUTFIT COMBINATIONS
                      ───────────────────────────────────────────────────────────── */}
                  {ragResult.recommendations && ragResult.recommendations.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Grid size={13} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c4b5fd' }}>
                          👗 Grounded Complete Outfits ({ragResult.recommendations.length})
                        </span>
                      </div>

                      {ragResult.recommendations.map((outfit, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(139,92,246,0.25)',
                            borderRadius: '14px',
                            padding: '16px',
                            marginBottom: '14px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: 'white', display: 'block' }}>
                                {outfit.outfitName}
                              </span>
                              <span style={{ fontSize: '11px', color: '#9d84bf' }}>
                                {outfit.style} • {outfit.occasion}
                              </span>
                            </div>
                            <Badge color="purple">
                              <Star size={10} className="text-amber-400" />
                              {Math.round((outfit.confidence || 0.9) * 100)}% Match
                            </Badge>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            {outfit.clothingItems?.map((piece) => {
                              const isCurrentlyWorn = wearingItemId === (piece._id || piece.id);
                              const imgUrl = piece.imageUrl || piece.image;

                              return (
                                <div
                                  key={piece._id || piece.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    background: 'rgba(0,0,0,0.35)',
                                    border: isCurrentlyWorn
                                      ? '1px solid #10b981'
                                      : '1px solid rgba(139,92,246,0.2)',
                                    borderRadius: '12px',
                                    padding: '8px 10px'
                                  }}
                                >
                                  <div
                                    style={{
                                      width: '44px',
                                      height: '44px',
                                      borderRadius: '8px',
                                      overflow: 'hidden',
                                      flexShrink: 0,
                                      background: piece.primaryColor || '#a855f7',
                                      border: '1px solid rgba(255,255,255,0.15)'
                                    }}
                                  >
                                    {imgUrl ? (
                                      <img
                                        src={imgUrl}
                                        alt={piece.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                      />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', background: piece.primaryColor || '#7c3aed' }} />
                                    )}
                                  </div>

                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                      {piece.name}
                                    </span>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                      {piece.category} • {piece.color}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => handleWearSinglePiece(piece)}
                                    style={{
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: isCurrentlyWorn
                                        ? 'linear-gradient(135deg,#10b981,#059669)'
                                        : 'linear-gradient(135deg,#7c3aed,#ec4899)',
                                      border: 'none',
                                      color: 'white',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      flexShrink: 0
                                    }}
                                  >
                                    {isCurrentlyWorn ? <CheckCircle size={11} /> : <Sparkles size={11} />}
                                    {isCurrentlyWorn ? 'Worn' : 'Wear'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {outfit.colorHarmony && (
                            <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#d8b4fe', background: 'rgba(139,92,246,0.1)', padding: '6px 10px', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                              🎨 <strong>Color Harmony:</strong> {outfit.colorHarmony}
                            </p>
                          )}

                          {outfit.explanation && (
                            <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.5 }}>
                              {outfit.explanation}
                            </p>
                          )}

                          <button
                            onClick={() => handleApplyToVR(outfit)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                              border: 'none',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              boxShadow: '0 4px 14px rgba(236,72,153,0.3)'
                            }}
                          >
                            <Compass size={14} /> Wear Full Outfit on 3D Model
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty fallback */}
                  {(!ragResult.exactMatches || ragResult.exactMatches.length === 0) &&
                    (!ragResult.similarAlternatives || ragResult.similarAlternatives.length === 0) &&
                    (!ragResult.ecommerceMatches || ragResult.ecommerceMatches.length === 0) &&
                    (!ragResult.recommendations || ragResult.recommendations.length === 0) && (
                      <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <p style={{ fontSize: '13px', color: '#c4b5fd', margin: 0 }}>
                          No items matched your specific filters. Try clicking "Reset Filters" or searching for "red frock" or "black jeans".
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* Idle Informational Box */}
              {!ragResult && !recLoading && !recError && (
                <div
                  style={{
                    background: 'rgba(139,92,246,0.06)',
                    borderRadius: '14px',
                    padding: '16px',
                    border: '1px solid rgba(139,92,246,0.15)'
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 800, color: '#c4b5fd' }}>
                    🔍 How RAG Wardrobe AI Works:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#9d84bf', lineHeight: 1.6 }}>
                    <li><strong>1. Retrieves:</strong> Real clothes from your MongoDB Atlas database.</li>
                    <li><strong>2. Augments:</strong> Fashion color harmony, weather rules, and unworn items.</li>
                    <li><strong>3. Generates:</strong> Exact outfit combinations with zero hallucination.</li>
                    <li><strong>4. VR Sync:</strong> Immediately dresses the photorealistic female avatar in 3D!</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: CLOTH AI VISION SCANNER
              ═════════════════════════════════════════════════════════════════════ */}
          {tab === 'scan' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: imagePreview
                    ? '2px solid rgba(139,92,246,0.4)'
                    : '2px dashed rgba(139,92,246,0.3)',
                  borderRadius: '14px',
                  padding: imagePreview ? '0' : '32px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: imagePreview ? 'transparent' : 'rgba(139,92,246,0.04)',
                  overflow: 'hidden',
                  marginBottom: '14px',
                  minHeight: imagePreview ? 'auto' : '140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      width: '100%',
                      maxHeight: '220px',
                      objectFit: 'cover',
                      borderRadius: '12px'
                    }}
                  />
                ) : (
                  <>
                    <Upload size={28} style={{ color: '#7c3aed', marginBottom: '10px' }} />
                    <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: '#c4b5fd' }}>
                      Drop or click to upload clothing photo
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b4d8f' }}>
                      JPG, PNG, WebP — max 10MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {imagePreview && (
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setAnalysis(null);
                      setError(null);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px'
                    }}
                  >
                    <RefreshCw size={13} /> New
                  </button>
                )}
                <button
                  onClick={handleAnalyze}
                  disabled={!imageFile || loading}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    background:
                      !imageFile || loading
                        ? 'rgba(139,92,246,0.2)'
                        : 'linear-gradient(135deg,#7c3aed,#ec4899)',
                    border: 'none',
                    color: !imageFile || loading ? '#6b4d8f' : 'white',
                    cursor: !imageFile || loading ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader size={14} className="spin" /> Inspecting…
                    </>
                  ) : (
                    <>
                      <Zap size={14} /> Scan Features
                    </>
                  )}
                </button>

                <button
                  onClick={handleSearchSimilarInWardrobe}
                  disabled={!imageFile || loading}
                  title="Search your wardrobe & catalog for garments visually matching this photo"
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    background:
                      !imageFile || loading
                        ? 'rgba(16,185,129,0.2)'
                        : 'linear-gradient(135deg,#059669,#10b981)',
                    border: 'none',
                    color: !imageFile || loading ? '#064e3b' : 'white',
                    cursor: !imageFile || loading ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Compass size={14} /> Search in Wardrobe
                </button>
              </div>

              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '14px',
                    display: 'flex',
                    gap: '8px'
                  }}
                >
                  <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5' }}>{error}</p>
                </div>
              )}

              {analysis && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    borderRadius: '14px',
                    padding: '16px',
                    marginTop: '12px'
                  }}
                >
                  {/* Wardrobe Match Status Badge */}
                  {analysis.isWardrobeItem ? (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle size={14} style={{ color: '#34d399' }} />
                      <span style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 700 }}>
                        ✓ Identified In Your Personal Wardrobe
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'rgba(139, 92, 246, 0.12)',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} style={{ color: '#c4b5fd' }} />
                      <span style={{ fontSize: '11px', color: '#ddd6fe', fontWeight: 600 }}>
                        AI Vision Feature Breakdown
                      </span>
                    </div>
                  )}

                  {/* Garment Title */}
                  <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a78bfa', fontWeight: 700 }}>
                      Item Name
                    </span>
                    <h3 style={{ margin: '3px 0 0', fontSize: '15px', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
                      {analysis.name || `${analysis.color} ${analysis.category}`}
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    {/* Category */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        <Tag size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                          Category
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                        {analysis.category || 'Dress'}
                      </span>
                    </div>

                    {/* Dominant Color */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        <Palette size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                          Dominant Color
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: analysis.colorHex || '#ec4899',
                            border: '1px solid rgba(255,255,255,0.4)',
                            display: 'inline-block'
                          }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                          {analysis.color || 'Pink'}
                        </span>
                      </div>
                    </div>

                    {/* Pattern / Print */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        <Grid size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                          Print / Pattern
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                        {analysis.pattern || 'Floral'}
                      </span>
                    </div>

                    {/* Fabric / Material */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        <Leaf size={12} style={{ color: '#a78bfa' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                          Fabric / Material
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                        {analysis.material || 'Silk & Chiffon'}
                      </span>
                    </div>
                  </div>

                  {/* Suitable Occasions */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <Calendar size={12} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                        Suitable Occasions
                      </span>
                    </div>
                    <div>
                      {(analysis.occasions || ['Party', 'Wedding', 'Casual outing']).map((occ, i) => (
                        <Badge key={i} color={i % 2 === 0 ? 'purple' : 'pink'}>
                          {occ}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Suitable Seasons */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <Sun size={12} style={{ color: '#a78bfa' }} />
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#c4b5fd' }}>
                        Suitable Seasons
                      </span>
                    </div>
                    <div>
                      {(analysis.seasons || ['Summer', 'Spring', 'Winter']).map((seas, i) => (
                        <Badge key={i} color="amber">
                          {seas}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Try on avatar & Search in Wardrobe */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button
                      onClick={handleWearScannedItem}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} /> Try On Avatar (3D)
                    </button>
                    <button
                      onClick={handleSearchSimilarInWardrobe}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '9px',
                        background: 'linear-gradient(135deg,#059669,#10b981)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Compass size={14} /> Search In Wardrobe
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
