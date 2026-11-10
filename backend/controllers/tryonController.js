import path from 'path';
import { generateGeminiTryOn, analyzeGarmentWithGeminiVision, resolveImagePayload } from '../services/geminiTryOnService.js';
import ClothingItem from '../models/ClothingItem.js';

/**
 * Controller to handle dual-upload Virtual Try-On generation via Google Gemini
 * Accepts person image + garment image (as files, base64 strings, or wardrobe item IDs)
 */
export const handleGenerateTryOn = async (req, res, next) => {
  try {
    let personInput = null;
    let garmentInput = null;
    let category = req.body.category || 'tops';
    let garmentDescription = req.body.garmentDescription || '';

    // 1. Resolve Person Image Input
    if (req.files && req.files['personImage'] && req.files['personImage'][0]) {
      personInput = req.files['personImage'][0].buffer || req.files['personImage'][0].path;
    } else if (req.body.personImageBase64) {
      personInput = req.body.personImageBase64;
    } else if (req.body.personImageUrl) {
      personInput = req.body.personImageUrl;
    }

    // 2. Resolve Garment Image Input
    if (req.files && req.files['garmentImage'] && req.files['garmentImage'][0]) {
      garmentInput = req.files['garmentImage'][0].buffer || req.files['garmentImage'][0].path;
      if (!garmentDescription && req.files['garmentImage'][0].originalname) {
        garmentDescription = req.files['garmentImage'][0].originalname;
      }
    } else if (req.body.garmentImageBase64) {
      garmentInput = req.body.garmentImageBase64;
    } else if (req.body.garmentImageUrl) {
      garmentInput = req.body.garmentImageUrl;
    }

    // Auto-detect category if user left default 'tops' but gave a dress or pants
    const hint = (garmentDescription + ' ' + (req.body.clothingItemId || '')).toLowerCase();
    if (category === 'tops') {
      if (hint.includes('dress') || hint.includes('gown') || hint.includes('frock') || hint.includes('sundress') || hint.includes('saree')) {
        category = 'dresses';
      } else if (hint.includes('pant') || hint.includes('trouser') || hint.includes('jean') || hint.includes('skirt') || hint.includes('short')) {
        category = 'bottoms';
      }
    }

    if (req.body.clothingItemId) {
      // Find item in MongoDB
      try {
        const item = await ClothingItem.findById(req.body.clothingItemId);
        if (item) {
          if (!garmentInput && item.imageUrl) {
            garmentInput = item.imageUrl;
          }
          if (!garmentDescription && item.name) {
            garmentDescription = `${item.name} (${item.category || category})`;
          }
        }
      } catch (err) {
        console.warn('[tryonController] Could not find clothing item by ID:', err.message);
      }
    }

    if (!personInput) {
      return res.status(400).json({
        success: false,
        message: 'Person image is required (upload file as "personImage" or provide "personImageBase64").',
      });
    }

    if (!garmentInput) {
      return res.status(400).json({
        success: false,
        message: 'Garment image is required (upload file as "garmentImage" or provide "garmentImageBase64" or "clothingItemId").',
      });
    }

    console.log(`[tryonController] Generating try-on for category: "${category}"...`);

    const result = await generateGeminiTryOn({
      personInput,
      garmentInput,
      category,
      garmentDescription,
    });

    return res.status(200).json({
      success: true,
      message: 'Virtual try-on look generated successfully with Gemini AI!',
      ...result,
    });
  } catch (error) {
    console.error('[tryonController] Error generating try-on:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate virtual try-on image.',
    });
  }
};

/**
 * Endpoint to analyze garment before try-on using Gemini Vision
 */
export const handleAnalyzeGarment = async (req, res, next) => {
  try {
    let garmentBuffer = null;
    let mimeType = 'image/png';

    if (req.file) {
      garmentBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/png';
    } else if (req.body.garmentBase64) {
      const match = req.body.garmentBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        garmentBuffer = Buffer.from(match[2], 'base64');
      } else {
        garmentBuffer = Buffer.from(req.body.garmentBase64, 'base64');
      }
    } else if (req.body.clothingItemId) {
      const item = await ClothingItem.findById(req.body.clothingItemId);
      if (item && item.imageUrl) {
        // Resolve image
        const img = await resolveImagePayload(item.imageUrl);
        garmentBuffer = img.buffer;
        mimeType = img.mimeType;
      }
    }

    if (!garmentBuffer) {
      return res.status(400).json({ success: false, message: 'Garment image is required for analysis.' });
    }

    const analysis = await analyzeGarmentWithGeminiVision(garmentBuffer, mimeType);
    return res.status(200).json({
      success: true,
      analysis: analysis || {
        category: 'dresses',
        cleanTitle: 'Garment',
        isSingleSkirt: true,
      },
    });
  } catch (error) {
    console.error('[tryonController] Error analyzing garment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  handleGenerateTryOn,
  handleAnalyzeGarment,
};

