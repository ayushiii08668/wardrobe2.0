import fs from 'fs';
import path from 'path';
import { aiConfig } from '../config/aiConfig.js';
import { CLOTHING_CATEGORIES } from '../models/ClothingItem.js';
import { groqAnalyzeClothingImage } from './groqService.js';

/**
 * Isolated mock prediction provider for offline local testing
 * Clearly flagged so mock data is never mistaken for real AI model inferences.
 *
 * @param {string} filename - Filename of the clothing image
 * @returns {object} Standardized mock AI analysis response
 */
export const getMockAiPrediction = (filename = '') => {
  const lowerName = filename.toLowerCase();

  let category    = 'Dress';
  let subCategory = 'Casual Dress';
  let color       = 'Pink';
  let material    = 'Cotton';
  let pattern     = 'Floral';

  if (lowerName.includes('shirt') || lowerName.includes('top')) {
    category = 'Shirt'; subCategory = 'Oxford Shirt'; color = 'White'; material = 'Cotton'; pattern = 'Striped';
  } else if (lowerName.includes('jean') || lowerName.includes('pant') || lowerName.includes('trouser')) {
    category = 'Jeans'; subCategory = 'Slim Fit Denim'; color = 'Black'; material = 'Denim'; pattern = 'Solid';
  } else if (lowerName.includes('jacket') || lowerName.includes('coat') || lowerName.includes('trench')) {
    category = 'Jacket'; subCategory = 'Casual Jacket'; color = 'Beige'; material = 'Cotton'; pattern = 'Solid';
  } else if (lowerName.includes('dress') || lowerName.includes('frock') || lowerName.includes('pink') || lowerName.includes('floral')) {
    category = 'Dress'; subCategory = 'Floral Dress'; color = 'Pink'; material = 'Chiffon'; pattern = 'Floral';
  } else if (lowerName.includes('shoe') || lowerName.includes('boot') || lowerName.includes('sneaker')) {
    category = 'Shoes'; subCategory = 'Casual Shoes'; color = 'Brown'; material = 'Leather'; pattern = 'Plain';
  }

  return {
    success: true,
    isMock:  true,
    data: {
      category,
      subCategory,
      color,
      secondaryColors: [],
      pattern,
      material,
      season:     ['Autumn', 'Winter'],
      occasion:   ['Casual outing', 'College'],
      style:      ['Casual', 'Streetwear'],
      confidence: 0.70,
      fit:        'Regular Fit',
      neckline:   'Unknown',
      sleeveLength: 'Unknown',
      stylingTip: 'Pair with neutral tones for a balanced look.',
      analyzedBy: 'Mock Fallback',
    },
  };
};

/**
 * Validates and normalizes raw predictions returned by any AI source
 *
 * @param {object} rawData - Raw prediction data
 * @returns {object} Normalized prediction object
 */
export const normalizeAiPrediction = (rawData = {}) => {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Malformed AI recognition payload received.');
  }

  let normalizedCategory = null;
  if (rawData.category && typeof rawData.category === 'string') {
    const matched = CLOTHING_CATEGORIES.find(
      (c) => c.toLowerCase() === rawData.category.trim().toLowerCase()
    );
    normalizedCategory = matched || 'Other';
  }

  let confidence = null;
  if (typeof rawData.confidence === 'number' && !isNaN(rawData.confidence)) {
    confidence = Math.min(1, Math.max(0, rawData.confidence));
  }

  return {
    category:       normalizedCategory,
    subCategory:    rawData.subCategory   ? String(rawData.subCategory).trim()   : null,
    color:          rawData.color         ? String(rawData.color).trim()         : null,
    secondaryColors: Array.isArray(rawData.secondaryColors)
      ? rawData.secondaryColors.map((c) => String(c).trim()).filter(Boolean) : [],
    pattern:        rawData.pattern       ? String(rawData.pattern).trim()       : null,
    material:       rawData.material      ? String(rawData.material).trim()      : null,
    season:         Array.isArray(rawData.season)
      ? rawData.season.map((s) => String(s).trim()).filter(Boolean)   : [],
    occasion:       Array.isArray(rawData.occasion)
      ? rawData.occasion.map((o) => String(o).trim()).filter(Boolean) : [],
    style:          Array.isArray(rawData.style)
      ? rawData.style.map((st) => String(st).trim()).filter(Boolean)  : [],
    fit:            rawData.fit           ? String(rawData.fit).trim()           : null,
    neckline:       rawData.neckline      ? String(rawData.neckline).trim()      : null,
    sleeveLength:   rawData.sleeveLength  ? String(rawData.sleeveLength).trim()  : null,
    confidence,
    stylingTip:     rawData.stylingTip    ? String(rawData.stylingTip).trim()    : null,
    analyzedBy:     rawData.analyzedBy    ? String(rawData.analyzedBy).trim()    : 'Unknown',
  };
};

/**
 * Main entry point: Analyses a clothing image.
 *
 * Priority order:
 *   1. Groq Vision AI  (LLaMA 4 Scout) — highest accuracy
 *   2. OpenCV Python AI service         — fallback if Groq unavailable
 *   3. Mock adapter                     — fallback for offline testing
 *
 * @param {string} relativeImagePath - e.g. /uploads/clothing/abc.jpg
 * @returns {Promise<{success, data, isMock, isGroq}>}
 */
export const recognizeClothingImage = async (relativeImagePath) => {
  if (!relativeImagePath || typeof relativeImagePath !== 'string') {
    const error = new Error('No image path provided for AI analysis.');
    error.statusCode = 400;
    throw error;
  }

  const cleanRelative = relativeImagePath.replace(/^\/?uploads\/clothing\//, '');
  const absolutePath  = path.resolve('uploads', 'clothing', path.basename(cleanRelative));
  const filename      = path.basename(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    const error = new Error('Associated clothing image file was not found on local storage.');
    error.statusCode = 404;
    throw error;
  }

  // ── 1. Try Groq Vision AI ──────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      console.log(`[AI] Using Groq Vision for: ${filename}`);
      const groqResult = await groqAnalyzeClothingImage(absolutePath);
      const normalized = normalizeAiPrediction(groqResult.data);
      return { success: true, isMock: false, isGroq: true, data: normalized };
    } catch (groqErr) {
      console.warn(`[AI] Groq Vision failed (${groqErr.message}). Falling back to OpenCV service.`);
    }
  } else {
    console.warn('[AI] GROQ_API_KEY not set. Skipping Groq Vision, trying OpenCV service.');
  }

  // ── 2. Try OpenCV Python AI service ───────────────────────────────────────
  const targetUrl = `${aiConfig.serviceUrl}${aiConfig.recognitionEndpoint}`;
  try {
    const fileBuffer = fs.readFileSync(absolutePath);
    const ext        = path.extname(filename).toLowerCase();
    const mimeType   = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);

    const response = await fetch(targetUrl, {
      method: 'POST',
      body:   formData,
      signal: AbortSignal.timeout(aiConfig.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`OpenCV service returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json || (!json.category && !json.data)) {
      throw new Error('OpenCV service returned invalid prediction data.');
    }

    const rawData = json.data || {
      category: json.category,
      subCategory: json.category_group,
      color: json.colour?.dominant,
      secondaryColors: json.colour?.secondary ? [json.colour.secondary] : [],
      pattern: json.pattern,
      material: json.material || null,
      season: json.recommended_seasons || [],
      occasion: json.recommended_occasions || [],
      confidence: json.confidence || 0.85,
      stylingTip: 'Pair with complementary wardrobe pieces for an elegant look.',
      analyzedBy: 'FastAPI OpenCV Vision Service'
    };

    const normalizedData = normalizeAiPrediction(rawData);
    console.log(`[AI] OpenCV service succeeded for: ${filename}`);
    return { success: true, isMock: false, isGroq: false, data: normalizedData };

  } catch (opencvErr) {
    const isNetworkError =
      opencvErr.code === 'ECONNREFUSED' ||
      opencvErr.code === 'ENOTFOUND'    ||
      opencvErr.name === 'TimeoutError' ||
      opencvErr.name === 'AbortError'   ||
      opencvErr.message?.includes('fetch failed') ||
      opencvErr.message?.includes('ECONNREFUSED');

    if (isNetworkError || opencvErr.message?.includes('HTTP')) {
      console.warn(`[AI] OpenCV service unreachable (${opencvErr.message}).`);
    }
  }

  // ── 3. Mock fallback ───────────────────────────────────────────────────────
  if (aiConfig.mockFallback) {
    console.warn(`[AI] All AI services unavailable. Using mock adapter for: ${filename}`);
    const mockResult = getMockAiPrediction(filename);
    const normalizedData = normalizeAiPrediction(mockResult.data);
    return { success: true, isMock: true, isGroq: false, data: normalizedData };
  }

  const serviceError = new Error('All AI recognition services are unavailable and mock fallback is disabled.');
  serviceError.statusCode = 503;
  throw serviceError;
};

export default {
  recognizeClothingImage,
  normalizeAiPrediction,
  getMockAiPrediction,
};
