import mongoose from 'mongoose';
import ClothingItem from '../models/ClothingItem.js';
import OutfitHistory from '../models/OutfitHistory.js';
import { requestOutfitRecommendations } from '../services/aiRecommendationService.js';
import { executeRAGOutfitStylist, executeRAGImageSearch } from '../services/ragService.js';
import { recognizeClothingImage } from '../services/aiRecognitionService.js';

/**
 * @desc    RAG (Retrieval-Augmented Generation) Fashion Stylist Endpoint
 *          Retrieves authentic MongoDB clothing items & generates grounded outfits
 * @route   POST /api/recommendations/rag-outfits
 * @access  Public / Optional Auth (Guest uses seeded wardrobe, Auth user uses personal)
 */
export const getRAGOutfitRecommendations = async (req, res, next) => {
  try {
    const { query, category, color, occasion, style, weather, season, material, preferredColors } = req.body;
    const userId = req.user?._id;

    const result = await executeRAGOutfitStylist({
      userId,
      query: query || '',
      preferences: {
        category,
        color,
        occasion,
        style,
        weather: weather || season,
        season: season || weather,
        material,
        preferredColors
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search Clothing by Uploaded Image or Extracted Image Features
 * @route   POST /api/recommendations/search-by-image
 * @access  Public / Optional Auth
 */
export const searchClothingByImage = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    let features = {};

    if (req.body.category || req.body.color || req.body.dominantColor || req.body.pattern || req.body.name) {
      features = {
        name: req.body.name,
        category: req.body.category,
        dominantColor: req.body.color || req.body.dominantColor,
        pattern: req.body.pattern,
        material: req.body.material,
        occasion: req.body.occasion,
        season: req.body.season,
        aspectRatio: req.body.aspectRatio
      };
    }

    if (req.file) {
      const filename = req.file.filename;
      const relativePath = `/uploads/clothing/${filename}`;
      try {
        const aiResult = await recognizeClothingImage(relativePath);
        if (aiResult?.data) {
          features = {
            name: features.name || aiResult.data.name || aiResult.data.subCategory,
            category: features.category || aiResult.data.category,
            dominantColor: features.dominantColor || aiResult.data.color,
            pattern: features.pattern || aiResult.data.pattern,
            material: features.material || aiResult.data.material,
            occasion: features.occasion || aiResult.data.occasion,
            season: features.season || aiResult.data.season,
            aspectRatio: features.aspectRatio || 1.2
          };
        }
      } catch (err) {
        console.warn('Image analysis fallback during image search:', err.message);
      }
    }

    // Direct MongoDB match check: Check if user has an item in their wardrobe matching this name or category + color
    const queryConditions = [];
    if (features.name && features.name !== 'Detected Garment') {
      const safeName = features.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      queryConditions.push({ name: { $regex: new RegExp(safeName, 'i') } });
    }
    if (features.category && features.dominantColor) {
      queryConditions.push({
        $and: [
          { category: { $regex: new RegExp(features.category, 'i') } },
          { color: { $regex: new RegExp(features.dominantColor, 'i') } }
        ]
      });
    }

    let directWardrobeMatches = [];
    if (queryConditions.length > 0) {
      const filter = { $or: queryConditions };
      if (userId) filter.userId = userId;
      directWardrobeMatches = await ClothingItem.find(filter).lean();
    }

    const result = await executeRAGImageSearch({ features, userId });

    // If direct wardrobe matches exist, merge them at the top of exactMatches
    if (directWardrobeMatches.length > 0) {
      const existingIds = new Set((result.exactMatches || []).map(m => (m._id || m.id).toString()));
      const newExact = [...(result.exactMatches || [])];
      directWardrobeMatches.forEach(item => {
        if (!existingIds.has(item._id.toString())) {
          newExact.unshift(item);
          existingIds.add(item._id.toString());
        }
      });
      result.exactMatches = newExact;
      result.notFound = false;
      result.message = `Found ${newExact.length} exact match${newExact.length > 1 ? 'es' : ''} in your personal wardrobe.`;
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get AI-generated outfit recommendations based on user wardrobe and preferences
 * @route   POST /api/recommendations/outfits
 * @access  Private (Authenticated User)
 */
export const getOutfitRecommendations = async (req, res, next) => {
  try {
    const {
      occasion,
      style,
      weather,
      preferredColors,
      otherPreferences,
      saveToHistory = false,
    } = req.body;

    // 1. Fetch authenticated user's wardrobe items from MongoDB
    const wardrobeItems = await ClothingItem.find({ userId: req.user._id }).lean();

    // 2. Validate empty wardrobe
    if (!wardrobeItems || wardrobeItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your wardrobe is empty. Please add clothing items before requesting recommendations.',
      });
    }

    // 3. Package preferences
    const preferences = {
      occasion: occasion ? String(occasion).trim() : null,
      style: style ? String(style).trim() : null,
      weather: weather ? String(weather).trim() : null,
      preferredColors: Array.isArray(preferredColors)
        ? preferredColors
        : typeof preferredColors === 'string' && preferredColors.trim()
        ? preferredColors.split(',').map((c) => c.trim()).filter(Boolean)
        : [],
      otherPreferences: otherPreferences ? String(otherPreferences).trim() : null,
    };

    // 4. Send wardrobe and preferences to AI Recommendation Service integration layer
    const aiResult = await requestOutfitRecommendations({
      wardrobeItems,
      preferences,
    });

    // 5. Index user's actual items by string ID for fast lookup and strict ownership validation
    const userItemMap = new Map(wardrobeItems.map((item) => [item._id.toString(), item]));

    // 6. Security and ownership validation: Filter and populate recommended clothing items
    const validatedRecommendations = [];

    for (const rec of aiResult.recommendations) {
      // Validate that every recommended clothing item ID exists and belongs to this user
      const validItemIds = [];
      const populatedItems = [];

      for (const id of rec.clothingItemIds) {
        if (mongoose.Types.ObjectId.isValid(id) && userItemMap.has(id.toString())) {
          validItemIds.push(id.toString());
          populatedItems.push(userItemMap.get(id.toString()));
        }
      }

      // If at least one valid user-owned item is present, include the recommendation
      if (validItemIds.length > 0) {
        validatedRecommendations.push({
          outfitName:         rec.outfitName,
          clothingItems:      populatedItems,
          clothingItemIds:    validItemIds,
          confidence:         rec.confidence,
          explanation:        rec.explanation,
          occasion:           rec.occasion          || preferences.occasion,
          style:              rec.style             || preferences.style,
          season:             rec.season            || preferences.weather,
          colorHarmony:       rec.colorHarmony      || null,
          sustainabilityNote: rec.sustainabilityNote || null,
        });
      }
    }

    // 7. Verify recommendations survived validation
    if (validatedRecommendations.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'AI recommendation service returned invalid clothing item references not found in your wardrobe.',
      });
    }

    // 8. Optionally save top recommendation to OutfitHistory if requested
    let historyRecord = null;
    if (Boolean(saveToHistory) && validatedRecommendations.length > 0) {
      const topRec = validatedRecommendations[0];
      historyRecord = await OutfitHistory.create({
        userId: req.user._id,
        clothingItems: topRec.clothingItemIds,
        notes: `AI Recommended: ${topRec.outfitName} (${topRec.explanation})`,
        wornDate: new Date(),
      });
    }

    // 9. Return consistent structured response to frontend
    return res.status(200).json({
      success: true,
      message: 'Outfit recommendations generated successfully',
      data: {
        recommendations: validatedRecommendations,
        preferences,
        isMock:  Boolean(aiResult.isMock),
        isGroq:  Boolean(aiResult.isGroq),
        modelUsed: aiResult.modelUsed || (aiResult.isGroq ? 'llama-3.3-70b-versatile' : 'rule-based'),
        historyId: historyRecord ? historyRecord._id : undefined,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export default {
  getOutfitRecommendations,
  getRAGOutfitRecommendations
};
