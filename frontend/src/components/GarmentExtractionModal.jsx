import React from 'react';
import {
  Sparkles,
  Scissors,
  CheckCircle,
  AlertCircle,
  X,
  RotateCcw,
  Shirt,
  Layers,
  Palette
} from 'lucide-react';

/**
 * GarmentExtractionModal
 * Gives users an interactive verification checkpoint where they can inspect
 * the extracted garment (with person and background removed) on a transparent
 * checkerboard background before proceeding with 3D synthesis & avatar fitting.
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
  if (!isOpen) return null;

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
        backdropFilter: 'blur(8px)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#13111c',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.2)',
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
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.15))',
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
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
                Dress Analysis
              </h3>
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

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                    ? 'Analysing the image…'
                    : 'Dress extraction…'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                  {stage === 'extracting'
                    ? 'Extracting ONLY the clothing item with alpha transparency.'
                    : 'Applying bone weights and binding to avatar skeleton for walking.'}
                </p>
              </div>
            </div>
          )}

          {/* Preview State: Display extracted transparent garment */}
          {stage === 'preview' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}
              >
                {/* Original Image */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                    Original Uploaded Photo
                  </span>
                  <div
                    style={{
                      height: '240px',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#4ade80',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <CheckCircle size={14} /> Extracted Clothing Only (Alpha PNG)
                  </span>
                  <div
                    style={{
                      height: '240px',
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      backgroundImage:
                        'linear-gradient(45deg, #1c1926 25%, transparent 25%), linear-gradient(-45deg, #1c1926 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1926 75%), linear-gradient(-45deg, transparent 75%, #1c1926 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: '#0f0e17',
                      border: '2px solid rgba(74, 222, 128, 0.4)',
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

              {/* Gemini Fashion Metadata Badges */}
              {geminiData && (
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '0.75rem',
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>
                      {geminiData.name || 'Identified Garment'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(168, 85, 247, 0.2)',
                        color: '#c084fc',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {geminiData.category || 'Dress'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {geminiData.neckline && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        Neckline: <strong>{geminiData.neckline}</strong>
                      </span>
                    )}
                    {geminiData.sleeves && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        Sleeves: <strong>{geminiData.sleeves}</strong>
                      </span>
                    )}
                    {geminiData.waist && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        Waist: <strong>{geminiData.waist}</strong>
                      </span>
                    )}
                    {geminiData.skirt && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        Skirt: <strong>{geminiData.skirt}</strong>
                      </span>
                    )}
                    {geminiData.primaryColor && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: geminiData.primaryColor,
                            display: 'inline-block',
                          }}
                        />
                        Color: {geminiData.primaryColor}
                      </span>
                    )}
                  </div>
                </div>
              )}
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
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
            }}
          >
            <button
              onClick={onRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} /> Discard & Retry
            </button>
            <button
              onClick={onConfirm3D}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.25rem',
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
              <Sparkles size={16} /> Confirm & Try On Avatar
            </button>
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

