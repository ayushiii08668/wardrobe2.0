import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Camera,
  UploadCloud,
  X,
  Check,
  RotateCcw,
  Download,
  Shirt,
  Scissors,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { generateGeminiTryOnApi, analyzeGarmentApi } from '../services/backendService.js';

const SAMPLE_MODELS = [
  { id: 'lady-1', name: 'Female Fashion Model', url: '/fashion_lady.png' },
];

const CATEGORIES = [
  { key: 'tops', label: 'Tops / Shirts', icon: Shirt },
  { key: 'bottoms', label: 'Bottoms / Pants', icon: Scissors },
  { key: 'dresses', label: 'Dresses / Gowns', icon: Sparkles },
  { key: 'outerwear', label: 'Jackets / Coats', icon: Layers },
];

export default function PhotoTryOnModal({
  isOpen,
  onClose,
  backendWardrobe = [],
  uploadedClothes = [],
  showToast,
  authToken,
  onOpenLiveAR,
  initialPersonImage,
  initialGarmentImage,
}) {
  // --- Person Slot State ---
  const [personImage, setPersonImage] = useState(null); // { file, previewUrl, base64 }
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const personFileInputRef = useRef(null);

  // Sync initial data if handed off from Live AR Camera
  useEffect(() => {
    if (initialPersonImage) {
      setPersonImage(initialPersonImage);
    }
  }, [initialPersonImage]);

  useEffect(() => {
    if (initialGarmentImage) {
      setGarmentImage(initialGarmentImage);
      if (initialGarmentImage.itemId) {
        triggerGarmentAnalysis(null, null, initialGarmentImage.itemId);
      }
    }
  }, [initialGarmentImage]);

  // --- Cloth Slot State ---
  const [garmentImage, setGarmentImage] = useState(null); // { file, previewUrl, base64, itemId, name }
  const [selectedCategory, setSelectedCategory] = useState('tops');
  const [garmentAnalysis, setGarmentAnalysis] = useState(null);
  const [isAnalyzingGarment, setIsAnalyzingGarment] = useState(false);
  const [isWardrobePickerOpen, setIsWardrobePickerOpen] = useState(false);
  const clothFileInputRef = useRef(null);

  // --- Generation & Result State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [resultImage, setResultImage] = useState(null);
  const [generationMethod, setGenerationMethod] = useState('');
  const [comparisonMode, setComparisonMode] = useState('split'); // 'split' | 'result' | 'original'
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploadsCollapsed, setIsUploadsCollapsed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // { url, title }

  // Combine wardrobe items
  const allWardrobeItems = React.useMemo(() => {
    const list = [...(backendWardrobe || [])];
    (uploadedClothes || []).forEach((u) => {
      if (!list.some((b) => (b.backendId && b.backendId === u.backendId) || b.id === u.id)) {
        list.push(u);
      }
    });
    return list;
  }, [backendWardrobe, uploadedClothes]);

  // Clean up webcam stream on unmount or close
  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopWebcam();
    }
  }, [isOpen, stopWebcam]);

  // --- Webcam Handler ---
  const startWebcam = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1080 }, height: { ideal: 1440 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setIsWebcamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error('Webcam error:', err);
      setErrorMessage('Could not access camera. Please allow camera permissions or upload a photo.');
    }
  };

  const captureWebcamSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 720;
    canvas.height = videoRef.current.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPersonImage({
      file: null,
      previewUrl: dataUrl,
      base64: dataUrl,
      name: 'Webcam Selfie',
    });
    stopWebcam();
  };

  // --- File Handlers ---
  const handlePersonFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPersonImage({
        file,
        previewUrl,
        base64: ev.target.result,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    stopWebcam();
  };

  const triggerGarmentAnalysis = async (file, base64, itemId) => {
    setIsAnalyzingGarment(true);
    setGarmentAnalysis(null);
    try {
      const res = await analyzeGarmentApi({
        garmentFile: file,
        garmentBase64: base64,
        clothingItemId: itemId,
        token: authToken,
      });
      if (res && res.success && res.analysis) {
        setGarmentAnalysis(res.analysis);
        if (res.analysis.category) {
          setSelectedCategory(res.analysis.category);
        }
      }
    } catch (err) {
      console.warn('Garment visual analysis notice:', err.message);
    } finally {
      setIsAnalyzingGarment(false);
    }
  };

  const handleClothFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setGarmentImage({
        file,
        previewUrl,
        base64: ev.target.result,
        name: file.name,
      });

      // Automatically auto-select category if detected from filename
      const fname = (file.name || '').toLowerCase();
      if (fname.includes('dress') || fname.includes('gown') || fname.includes('frock') || fname.includes('saree') || fname.includes('sundress') || fname.includes('onepiece') || fname.includes('one-piece')) {
        setSelectedCategory('dresses');
      } else if (fname.includes('pant') || fname.includes('trouser') || fname.includes('jean') || fname.includes('skirt') || fname.includes('short')) {
        setSelectedCategory('bottoms');
      } else if (fname.includes('jacket') || fname.includes('coat') || fname.includes('blazer') || fname.includes('hoodie')) {
        setSelectedCategory('outerwear');
      }

      // Trigger Gemini Multimodal Vision analysis immediately
      triggerGarmentAnalysis(file, ev.target.result, null);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSampleModel = (sample) => {
    setPersonImage({
      file: null,
      previewUrl: sample.url,
      imageUrl: sample.url,
      name: sample.name,
    });
    stopWebcam();
  };

  const handleSelectWardrobePiece = (item) => {
    setGarmentImage({
      file: null,
      previewUrl: item.image || item.imageUrl,
      imageUrl: item.image || item.imageUrl,
      itemId: item.backendId || item._id,
      name: item.name,
    });
    // Auto-select category if matching
    const cat = (item.category || '').toLowerCase();
    if (cat.includes('dress') || cat.includes('frock') || cat.includes('saree') || cat.includes('gown')) {
      setSelectedCategory('dresses');
    } else if (cat.includes('trouser') || cat.includes('jean') || cat.includes('bottom') || cat.includes('skirt')) {
      setSelectedCategory('bottoms');
    } else if (cat.includes('jacket') || cat.includes('coat') || cat.includes('outerwear')) {
      setSelectedCategory('outerwear');
    } else {
      setSelectedCategory('tops');
    }
    setIsWardrobePickerOpen(false);
    triggerGarmentAnalysis(null, null, item.backendId || item._id);
  };

  // --- Generation Handler ---
  const handleGenerate = async () => {
    if (!personImage) {
      setErrorMessage('Please upload or capture your photo first.');
      return;
    }
    if (!garmentImage) {
      setErrorMessage('Please upload or select a clothing image to try on.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);
    setResultImage(null);

    // Animated progress sequence
    setGenerationStep('AI Vision analyzing garment silhouette & body landmarks...');
    const t1 = setTimeout(() => {
      setGenerationStep('Aligning neckline, continuous dress skirt & lighting...');
    }, 2500);
    const t2 = setTimeout(() => {
      setGenerationStep('AI Diffusion model synthesizing photorealistic fitting...');
    }, 5500);

    try {
      const data = await generateGeminiTryOnApi({
        personFile: personImage.file,
        personBase64: personImage.base64,
        personImageUrl: personImage.imageUrl,
        garmentFile: garmentImage.file,
        garmentBase64: garmentImage.base64,
        garmentImageUrl: garmentImage.imageUrl,
        clothingItemId: garmentImage.itemId,
        category: garmentAnalysis?.category || selectedCategory,
        garmentDescription: garmentAnalysis?.cleanTitle || garmentAnalysis?.vtonPrompt || garmentImage.name || '',
        token: authToken,
      });

      clearTimeout(t1);
      clearTimeout(t2);

      if (data.success && data.resultUrl) {
        setResultImage(data.resultUrl);
        setGenerationMethod(data.method || 'idm_vton_diffusion_ai');
        setComparisonMode('split');
        setIsUploadsCollapsed(true);
        showToast?.('Virtual try-on photorealistic look generated!', 'success');
      } else {
        throw new Error(data.message || 'Generation returned no result.');
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      console.error('Try-On Generation Error:', err);
      if (err.message && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        setErrorMessage(
          'Backend server is offline at http://localhost:5000. Please start your backend with "npm run dev" in the My-Wardrobe/backend folder to run the AI virtual try-on model.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to synthesize try-on image. Please try again.');
      }
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `wardrobewise_tryon_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="photo-tryon-overlay" onClick={onClose}>
      <div className="photo-tryon-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="photo-tryon-header">
          <div className="photo-tryon-header-title">
            <div className="photo-tryon-badge">
              <Sparkles size={14} className="text-pink-300" />
              <span>Gemini AI Studio</span>
            </div>
            <h2>Dual-Upload AI Virtual Try-On</h2>
            <p>Upload your photo + clothing image to synthesize a photorealistic fitting.</p>
          </div>
          <div className="photo-tryon-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenLiveAR && (
              <button
                type="button"
                onClick={() => {
                  stopWebcam();
                  onOpenLiveAR();
                }}
                className="live-ar-header-switch-btn"
                title="Switch to 60 FPS Real-Time Live Camera Try-On"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(168,85,247,0.25))',
                  border: '1px solid rgba(244,114,182,0.45)',
                  color: '#fdf2f8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Camera size={14} className="text-pink-300" />
                <span>🎥 Switch to Live AR Camera</span>
              </button>
            )}
            <button className="photo-tryon-close-btn" onClick={onClose} title="Close Studio">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="photo-tryon-error-banner">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Content: Split into Upload Stage & Result Stage */}
        <div className="photo-tryon-body">
          {/* Collapsed Uploads Bar when viewing result */}
          {resultImage && isUploadsCollapsed && (
            <div className="uploads-collapsed-bar">
              <div className="collapsed-info">
                <span className="collapsed-pill">👤 Photo: <strong>{personImage?.name || 'Uploaded Photo'}</strong></span>
                <span className="collapsed-pill">👗 Cloth: <strong>{garmentImage?.name || 'Garment'}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadsCollapsed(false)}
                className="collapsed-expand-btn"
              >
                <SlidersHorizontal size={13} />
                <span>Change Photo or Garment</span>
              </button>
            </div>
          )}

          {/* STAGE 1: DUAL UPLOAD PANELS */}
          {(!resultImage || !isUploadsCollapsed) && (
            <>
              <div className="photo-tryon-grid">
            {/* SLOT 1: PERSON PHOTO */}
            <div className="upload-slot-card">
              <div className="slot-header">
                <span className="slot-step">1</span>
                <div>
                  <h3 className="slot-title">Your Photo</h3>
                  <p className="slot-subtitle">Full body or portrait photo of you</p>
                </div>
              </div>

              {isWebcamActive ? (
                <div className="webcam-container">
                  <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
                  <div className="webcam-actions">
                    <button onClick={captureWebcamSnapshot} className="webcam-capture-btn">
                      <Camera size={16} />
                      <span>Take Photo</span>
                    </button>
                    <button onClick={stopWebcam} className="webcam-cancel-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : personImage ? (
                <div className="slot-preview-box">
                  <img src={personImage.previewUrl} alt="Your Photo" className="slot-preview-img" />
                  <div className="slot-preview-overlay">
                    <span className="slot-file-name">{personImage.name || 'Your Photo'}</span>
                    <div className="slot-preview-btns">
                      <button
                        onClick={() => personFileInputRef.current?.click()}
                        className="slot-action-btn"
                        title="Change Photo"
                      >
                        <RefreshCw size={13} />
                        <span>Change</span>
                      </button>
                      <button
                        onClick={() => setPersonImage(null)}
                        className="slot-action-btn danger"
                        title="Remove Photo"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="upload-dropzone"
                  onClick={() => personFileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <UploadCloud size={30} />
                  </div>
                  <p className="dropzone-text">Click or drag &amp; drop your photo</p>
                  <span className="dropzone-hint">Supports JPEG, PNG, WEBP</span>

                  <div className="slot-extra-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={startWebcam} className="slot-pill-btn">
                      <Camera size={13} />
                      <span>Use Webcam</span>
                    </button>
                    {onOpenLiveAR && (
                      <button
                        onClick={() => {
                          stopWebcam();
                          onOpenLiveAR();
                        }}
                        className="slot-pill-btn"
                        style={{
                          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.28), rgba(168, 85, 247, 0.28))',
                          borderColor: 'rgba(244, 114, 182, 0.5)',
                          color: '#fdf2f8',
                        }}
                      >
                        <Sparkles size={13} className="text-pink-300" />
                        <span>🎥 Live AR Camera</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleSelectSampleModel(SAMPLE_MODELS[0])}
                      className="slot-pill-btn secondary"
                    >
                      <span>Try Sample Model</span>
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={personFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handlePersonFileSelect}
              />
            </div>

            {/* SLOT 2: CLOTH PICTURE */}
            <div className="upload-slot-card">
              <div className="slot-header">
                <span className="slot-step">2</span>
                <div>
                  <h3 className="slot-title">Cloth Picture</h3>
                  <p className="slot-subtitle">Garment, dress, shirt, or pants</p>
                </div>
              </div>

              {/* Category Selector Pills */}
              <div className="category-pill-row">
                {CATEGORIES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className={`category-chip ${selectedCategory === key ? 'active' : ''}`}
                  >
                    <Icon size={12} />
                    <span>{label.split('/')[0]}</span>
                  </button>
                ))}
              </div>

              {garmentImage ? (
                <>
                  <div className="slot-preview-box">
                    <img src={garmentImage.previewUrl} alt="Cloth" className="slot-preview-img contain" />
                    <div className="slot-preview-overlay">
                      <span className="slot-file-name">{garmentImage.name || 'Selected Garment'}</span>
                      <div className="slot-preview-btns">
                        <button
                          onClick={() => clothFileInputRef.current?.click()}
                          className="slot-action-btn"
                          title="Change Cloth"
                        >
                          <RefreshCw size={13} />
                          <span>Change</span>
                        </button>
                        <button
                          onClick={() => {
                            setGarmentImage(null);
                            setGarmentAnalysis(null);
                          }}
                          className="slot-action-btn danger"
                          title="Remove Cloth"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Garment Vision Analysis Status */}
                  {isAnalyzingGarment && (
                    <div className="garment-ai-analysis-tag analyzing">
                      <Sparkles size={14} className="spin text-purple-400" />
                      <div>
                        <div style={{ fontWeight: 600, color: '#e9d5ff' }}>Analyzing Cloth with Gemini Vision...</div>
                        <div style={{ fontSize: '11px', opacity: 0.8 }}>Detecting color, length, pattern, fabric &amp; silhouette</div>
                      </div>
                    </div>
                  )}
                  {!isAnalyzingGarment && garmentAnalysis && (
                    <div className="garment-ai-analysis-card">
                      <div className="analysis-card-header">
                        <div className="analysis-header-left">
                          <Sparkles size={13} className="text-purple-400" />
                          <span className="analysis-header-title">{garmentAnalysis.cleanTitle || garmentAnalysis.garmentType}</span>
                        </div>
                        <span className="analysis-type-badge">
                          {garmentAnalysis.isFullBodyFrock || garmentAnalysis.length === 'full-length' || garmentAnalysis.length === 'maxi'
                            ? '✨ Full-Body Frock'
                            : garmentAnalysis.category || 'Cloth'}
                        </span>
                      </div>

                      <div className="analysis-attributes-grid">
                        <div className="attribute-pill">
                          <span className="attr-label">Color:</span>
                          <span
                            className="color-swatch-dot"
                            style={{ backgroundColor: garmentAnalysis.primaryColorHex || '#888' }}
                          />
                          <span className="attr-val">{garmentAnalysis.color || 'Custom'}</span>
                        </div>
                        <div className="attribute-pill">
                          <span className="attr-label">Sleeves:</span>
                          <span className="attr-val highlight-sleeves font-semibold">
                            {garmentAnalysis.isSleeveless || (garmentAnalysis.sleeves || '').toLowerCase().includes('sleeveless')
                              ? '✨ Sleeveless (Bare Arms)'
                              : garmentAnalysis.sleeves || 'Standard'}
                          </span>
                        </div>
                        <div className="attribute-pill">
                          <span className="attr-label">Length:</span>
                          <span className="attr-val highlight-length">
                            {garmentAnalysis.length === 'full-length' || garmentAnalysis.length === 'maxi' || garmentAnalysis.isFullBodyFrock
                              ? 'Full Floor-Length'
                              : garmentAnalysis.length || 'Standard'}
                          </span>
                        </div>
                        <div className="attribute-pill">
                          <span className="attr-label">Pattern:</span>
                          <span className="attr-val">{garmentAnalysis.pattern || 'Solid'}</span>
                        </div>
                        <div className="attribute-pill">
                          <span className="attr-label">Flare:</span>
                          <span className="attr-val">{garmentAnalysis.flare || garmentAnalysis.silhouette || 'Flared A-Line'}</span>
                        </div>
                        {garmentAnalysis.neckline && (
                          <div className="attribute-pill full-width">
                            <span className="attr-label">Neckline:</span>
                            <span className="attr-val">{garmentAnalysis.neckline}</span>
                          </div>
                        )}
                        {garmentAnalysis.designDetails && (
                          <div className="attribute-pill full-width">
                            <span className="attr-label">Design:</span>
                            <span className="attr-val">{garmentAnalysis.designDetails}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="upload-dropzone"
                  onClick={() => clothFileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <Shirt size={30} />
                  </div>
                  <p className="dropzone-text">Click or drag &amp; drop cloth picture</p>
                  <span className="dropzone-hint">White or neutral background works best</span>

                  <div className="slot-extra-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setIsWardrobePickerOpen(true)}
                      className="slot-pill-btn highlight"
                    >
                      <FolderOpen size={13} />
                      <span>Pick From My Wardrobe ({allWardrobeItems.length})</span>
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={clothFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleClothFileSelect}
              />
            </div>
          </div>

              {/* GENERATE ACTION BUTTON & PROGRESS */}
              <div className="photo-tryon-action-row">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !personImage || !garmentImage}
                  className={`tryon-generate-btn ${isGenerating ? 'generating' : ''}`}
                >
                  <Sparkles size={18} className="sparkle-anim" />
                  <span>{isGenerating ? 'Gemini AI Synthesizing...' : 'Generate Virtual Try-On Look'}</span>
                </button>
              </div>
            </>
          )}

          {isGenerating && (
            <div className="tryon-progress-box">
              <div className="progress-spinner" />
              <div className="progress-info">
                <span className="progress-text">{generationStep}</span>
                <span className="progress-subtext">Google Gemini Multimodal Vision &amp; Synthesis</span>
              </div>
            </div>
          )}

          {/* STAGE 2: GENERATED RESULT PREVIEW */}
          {resultImage && !isGenerating && (
            <div className="tryon-result-section">
              <div className="result-header">
                <div className="result-header-left">
                  <div className="result-badge">
                    <Check size={13} />
                    <span>Fitted Look Ready</span>
                  </div>
                  <h3>Try-On Result</h3>
                </div>

                <div className="result-mode-toggle">
                  <button
                    onClick={() => setComparisonMode('split')}
                    className={`mode-btn ${comparisonMode === 'split' ? 'active' : ''}`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setComparisonMode('result')}
                    className={`mode-btn ${comparisonMode === 'result' ? 'active' : ''}`}
                  >
                    Fitted Look Only
                  </button>
                </div>
              </div>

              {/* Display Comparison */}
              <div className={`result-display-stage ${comparisonMode}`}>
                {(comparisonMode === 'split' || comparisonMode === 'original') && (
                  <div
                    className="result-panel original"
                    onClick={() => setLightboxImage({ url: personImage.previewUrl, title: 'Original Uploaded Photo' })}
                    title="Click to view full size"
                  >
                    <span className="panel-tag">Original Photo</span>
                    <button className="panel-expand-btn" title="View Full Size">
                      <Eye size={13} />
                      <span>Full View</span>
                    </button>
                    <img src={personImage.previewUrl} alt="Original User" />
                  </div>
                )}

                <div
                  className="result-panel fitted"
                  onClick={() => setLightboxImage({ url: resultImage, title: 'Gemini AI Fitted Look' })}
                  title="Click to view full size"
                >
                  <span className="panel-tag highlight">Gemini AI Fitted</span>
                  <button className="panel-expand-btn" title="View Full Size">
                    <Eye size={13} />
                    <span>Full View</span>
                  </button>
                  <img src={resultImage} alt="Synthesized Try-On" />
                </div>
              </div>

              {/* Result Actions */}
              <div className="result-action-bar">
                <button onClick={handleDownload} className="result-btn primary">
                  <Download size={15} />
                  <span>Download Look</span>
                </button>
                <button
                  onClick={() => {
                    setGarmentImage(null);
                    setResultImage(null);
                  }}
                  className="result-btn secondary"
                >
                  <RefreshCw size={14} />
                  <span>Try Another Cloth</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* WARDROBE QUICK PICKER MODAL */}
        {isWardrobePickerOpen && (
          <div className="wardrobe-picker-overlay" onClick={() => setIsWardrobePickerOpen(false)}>
            <div className="wardrobe-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="picker-header">
                <h3>Select a Garment from Your Wardrobe</h3>
                <button onClick={() => setIsWardrobePickerOpen(false)} className="picker-close-btn">
                  <X size={16} />
                </button>
              </div>
              <div className="picker-grid">
                {allWardrobeItems.length === 0 ? (
                  <div className="picker-empty">
                    <Shirt size={28} style={{ opacity: 0.4 }} />
                    <p>No saved wardrobe items found. Upload one to try on!</p>
                  </div>
                ) : (
                  allWardrobeItems.map((item) => (
                    <button
                      key={item.id || item.backendId || item._id}
                      onClick={() => handleSelectWardrobePiece(item)}
                      className="picker-item-card"
                    >
                      <img src={item.image || item.imageUrl} alt={item.name} />
                      <div className="picker-item-info">
                        <span className="picker-item-name">{item.name}</span>
                        <span className="picker-item-cat">{item.category}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        {/* Fullscreen Lightbox / Full Body Zoom Modal */}
        {lightboxImage && (
          <div className="tryon-lightbox-overlay" onClick={() => setLightboxImage(null)}>
            <div className="tryon-lightbox-content" onClick={(e) => e.stopPropagation()}>
              <div className="lightbox-header">
                <h4>{lightboxImage.title}</h4>
                <button onClick={() => setLightboxImage(null)} className="lightbox-close-btn" title="Close Fullscreen View">
                  <X size={18} />
                </button>
              </div>
              <div className="lightbox-img-wrapper">
                <img src={lightboxImage.url} alt={lightboxImage.title} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

