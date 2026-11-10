import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Sparkles,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

export default function LiveExtensionModal({
  isOpen,
  onClose,
  backendWardrobe = [],
  uploadedClothes = [],
  showToast
}) {
  const [selectedGarment, setSelectedGarment] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [extensionId, setExtensionId] = useState('hnhhndbjigjpkmabmpceogcanonfjhpk');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Combine and deduplicate clothes from backend and uploads
  const allGarments = React.useMemo(() => {
    const combined = [...uploadedClothes, ...backendWardrobe];
    const seen = new Set();
    return combined.filter((item) => {
      const id = item.id || item._id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [backendWardrobe, uploadedClothes]);

  // Filter garments by selected category
  const filteredGarments = React.useMemo(() => {
    if (activeCategory === 'all') return allGarments;
    return allGarments.filter((g) => {
      const cat = (g.category || '').toLowerCase();
      if (activeCategory === 'dresses') return cat.includes('dress') || cat.includes('gown');
      if (activeCategory === 'tops') return cat.includes('top') || cat.includes('shirt') || cat.includes('t-shirt') || cat.includes('jacket');
      if (activeCategory === 'bottoms') return cat.includes('bottom') || cat.includes('pant') || cat.includes('jeans') || cat.includes('skirt');
      return true;
    });
  }, [allGarments, activeCategory]);

  // Set default selected garment when list loads
  useEffect(() => {
    if (filteredGarments.length > 0 && !selectedGarment) {
      setSelectedGarment(filteredGarments[0]);
    }
  }, [filteredGarments, selectedGarment]);

  // Check for Chrome Extension presence via custom event handshake
  useEffect(() => {
    if (!isOpen) return;

    const handleExtensionReady = (e) => {
      setIsExtensionInstalled(true);
    };

    window.addEventListener('WARDROBEWISE_EXTENSION_READY', handleExtensionReady);
    // Ping extension
    window.dispatchEvent(new CustomEvent('WARDROBEWISE_PING_EXTENSION'));

    return () => {
      window.removeEventListener('WARDROBEWISE_EXTENSION_READY', handleExtensionReady);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const garmentImgUrl = selectedGarment?.imageUrl || selectedGarment?.image || '';
  const garmentName = selectedGarment?.name || selectedGarment?.title || 'Selected Garment';
  const garmentCategory = selectedGarment?.category || 'top';

  const handleLaunchTryOn = () => {
    if (!selectedGarment) {
      showToast?.('Please select a clothing item first', 'warn');
      return;
    }

    setIsLaunching(true);

    // Dispatch event to the Try-On Anywear Chrome Extension content script
    const tryOnPayload = {
      id: selectedGarment.id || selectedGarment._id,
      name: garmentName,
      imageUrl: garmentImgUrl,
      category: garmentCategory,
      timestamp: Date.now()
    };

    window.dispatchEvent(new CustomEvent('WARDROBEWISE_LIVE_TRYON', { detail: tryOnPayload }));

    // Send a message via window postMessage as well for maximum compatibility
    window.postMessage({ type: 'WARDROBEWISE_LIVE_TRYON', payload: tryOnPayload }, '*');

    // Directly open the Chrome extension room tab
    const roomUrl = `chrome-extension://${extensionId || 'hnhhndbjigjpkmabmpceogcanonfjhpk'}/tabs/room.html`;
    try {
      window.open(roomUrl, '_blank');
    } catch (err) {
      console.warn('Could not open tab directly:', err);
    }

    setTimeout(() => {
      setIsLaunching(false);
      showToast?.(`Opening Live Try-On Room for "${garmentName}"!`, 'success');
    }, 600);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(5, 5, 12, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.25s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          background: 'linear-gradient(145deg, rgba(24, 20, 36, 0.95), rgba(12, 10, 20, 0.98))',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)'
              }}
            >
              <Camera size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                  Decart AI Live Video Try-On
                </h2>
                <span
                  style={{
                    background: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    color: '#f472b6',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase'
                  }}
                >
                  30 FPS WebRTC
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Generative real-time video diffusion powered by Chrome Extension & Decart AI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px 28px', display: 'flex', gap: '24px' }}>
          {/* Left Column: Selected Garment & Launch */}
          <div style={{ flex: '1 1 52%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                background: 'rgba(15, 12, 24, 0.6)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px'
              }}
            >
              {garmentImgUrl ? (
                <div style={{ position: 'relative', width: '180px', height: '220px', borderRadius: '12px', overflow: 'hidden' }}>
                  <img
                    src={garmentImgUrl}
                    alt={garmentName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))'
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '180px',
                    height: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}
                >
                  <Layers size={40} />
                </div>
              )}

              <div style={{ marginTop: '14px', textAlign: 'center', width: '100%' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600 }}>{garmentName}</h3>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#a855f7',
                    background: 'rgba(168, 85, 247, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    textTransform: 'capitalize'
                  }}
                >
                  {garmentCategory}
                </span>
              </div>
            </div>

            {/* Launch Action */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleLaunchTryOn}
                disabled={isLaunching || !selectedGarment}
                style={{
                  flex: 1,
                  padding: '13px 16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isLaunching ? 'wait' : 'pointer',
                  boxShadow: '0 8px 20px -4px rgba(236, 72, 153, 0.4)',
                  transition: 'all 0.2s',
                  opacity: selectedGarment ? 1 : 0.6
                }}
              >
                <Zap size={16} />
                <span>{isLaunching ? 'Opening Stream...' : 'Launch Live Try-On'}</span>
              </button>

              <button
                onClick={() => window.open(`chrome-extension://${extensionId}/tabs/room.html`, '_blank')}
                style={{
                  padding: '13px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
                title="Open Live Fitting Room in new tab"
              >
                <ExternalLink size={15} />
                <span>Open Room</span>
              </button>
            </div>

            {/* Right click tip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '12px',
                color: '#94a3b8'
              }}
            >
              <Info size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span>
                Tip: You can also <strong>right-click</strong> any dress in your closet and select{' '}
                <strong style={{ color: '#ec4899' }}>"Try this on me"</strong> to open it immediately!
              </span>
            </div>
          </div>

          {/* Right Column: Garment Selector & Setup Guide */}
          <div style={{ flex: '1 1 48%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'dresses', label: 'Dresses' },
                { id: 'tops', label: 'Tops' },
                { id: 'bottoms', label: 'Bottoms' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: activeCategory === tab.id ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: activeCategory === tab.id ? '#c084fc' : '#94a3b8',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Garment Carousel Grid */}
            <div
              style={{
                maxHeight: '230px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                paddingRight: '4px'
              }}
            >
              {filteredGarments.map((item) => {
                const isSelected = (selectedGarment?.id || selectedGarment?._id) === (item.id || item._id);
                const img = item.imageUrl || item.image;
                return (
                  <div
                    key={item.id || item._id}
                    onClick={() => setSelectedGarment(item)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <img
                      src={img}
                      alt={item.name}
                      style={{
                        width: '100%',
                        height: '70px',
                        objectFit: 'contain',
                        borderRadius: '6px'
                      }}
                    />
                    <span
                      style={{
                        fontSize: '11px',
                        color: isSelected ? '#fdf2f8' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '85px',
                        textAlign: 'center'
                      }}
                    >
                      {item.name || 'Garment'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Extension Setup Guide Collapsible */}
            <div
              style={{
                marginTop: 'auto',
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
                onClick={() => setShowInstallGuide(!showInstallGuide)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={15} color="#c084fc" />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    Extension Setup & Instructions
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#a855f7' }}>
                  {showInstallGuide ? 'Hide' : 'Show Guide'}
                </span>
              </div>

              {showInstallGuide && (
                <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.5 }}>
                  <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>
                      Open <code>chrome://extensions</code> in Google Chrome.
                    </li>
                    <li>Toggle <strong>Developer mode</strong> in top-right corner.</li>
                    <li>
                      Click <strong>Load unpacked</strong> and select folder:<br />
                      <code style={{ fontSize: '10.5px', color: '#f472b6' }}>
                        My-Wardrobe/Livetryon/try-on/build/chrome-mv3-prod
                      </code>
                    </li>
                    <li>Enter your Decart AI key once into the extension.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

