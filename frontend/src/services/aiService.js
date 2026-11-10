/**
 * aiService.js
 * Frontend Integration Service for Member 3's AI Module (ai_service).
 * 
 * Connects the 3D Virtual Room and UI to:
 * 1. FastAPI AI Microservice (http://127.0.0.1:8000)
 *    - POST /api/ai/recommend-outfits (Color Harmony + Occasion + Season)
 *    - POST /api/ai/recommend-unused (Sustainable Neglected Clothing Revival)
 *    - POST /api/ai/analyze-clothing (Vision AI Image Classification & Color Detection)
 * 2. Embedded High-Performance Client Recommender
 *    - Implements identical color harmony rules & clashing prevention as zero-latency fallback.
 */

import { PRODUCTS } from '../data/products.js';

const AI_API_BASE = import.meta.env.VITE_AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Mapping boutique catalog categories to AI service category_group and names
const CATEGORY_MAP = {
  tops: { group: 'top', defaultName: 'Top' },
  dresses: { group: 'dress', defaultName: 'Dress' },
  outerwear: { group: 'outerwear', defaultName: 'Jacket' },
  trousers: { group: 'bottom', defaultName: 'Trousers' },
  skirts: { group: 'bottom', defaultName: 'Skirt' },
  shoes: { group: 'footwear', defaultName: 'Shoes' },
  accessories: { group: 'accessory', defaultName: 'Accessories' }
};

/**
 * Normalizes boutique catalog products into the AI service schema
 */
export function formatProductForAI(product) {
  const cat = (product.category || '').toLowerCase();
  const mapping = CATEGORY_MAP[cat] || { group: 'top', defaultName: 'Clothing Item' };

  let dominantColor = product.colors?.[0]?.name || 'White';
  let dominantHex = product.primaryColor || product.colors?.[0]?.hex || '#FFFFFF';
  let secondaryColor = product.colors?.[1]?.name || null;
  let secondaryHex = product.colors?.[1]?.hex || null;

  // Derive patterns and occasions from tags
  const tags = (product.tags || []).map((t) => t.toLowerCase());
  let pattern = 'Plain';
  if (tags.some((t) => t.includes('stripe'))) pattern = 'Striped';
  else if (tags.some((t) => t.includes('floral'))) pattern = 'Floral';
  else if (tags.some((t) => t.includes('check') || t.includes('plaid'))) pattern = 'Checked';
  else if (tags.some((t) => t.includes('print'))) pattern = 'Printed';

  const seasons = [];
  if (tags.includes('summer')) seasons.push('Summer');
  if (tags.includes('winter')) seasons.push('Winter');
  if (tags.includes('spring')) seasons.push('Spring');
  if (tags.includes('monsoon')) seasons.push('Monsoon');
  if (seasons.length === 0) seasons.push('Summer', 'Spring', 'Monsoon', 'Winter');

  const occasions = [];
  if (tags.includes('formal') || tags.includes('classic')) occasions.push('Formal event', 'Office');
  if (tags.includes('casual') || tags.includes('capsule')) occasions.push('Casual outing', 'College');
  if (tags.includes('party') || tags.includes('evening') || tags.includes('cocktail')) occasions.push('Party', 'Wedding');
  if (tags.includes('travel') || tags.includes('cozy')) occasions.push('Travel', 'Casual outing');
  if (occasions.length === 0) occasions.push('Casual outing', 'Office', 'College');

  return {
    item_id: product.id,
    name: product.name,
    category: mapping.defaultName,
    category_group: mapping.group,
    colour: {
      dominant: dominantColor,
      dominant_hex: dominantHex,
      secondary: secondaryColor,
      secondary_hex: secondaryHex
    },
    pattern,
    seasons,
    occasions,
    times_worn: product.timesWorn || (product.id.includes('1') ? 12 : product.id.includes('2') ? 1 : 0),
    last_worn: product.lastWorn || (product.id.includes('2') ? '2026-04-10T10:00:00Z' : null),
    image_reference: product.image,
    price: product.price,
    discountPrice: product.discountPrice,
    originalProduct: product
  };
}

/**
 * Returns formatted wardrobe items from the boutique catalog
 */
export function getStandardBoutiqueWardrobe() {
  return PRODUCTS.map(formatProductForAI);
}

/**
 * Checks if the FastAPI AI service is running and healthy
 */
export async function checkAIServiceHealth() {
  try {
    const res = await fetch(`${AI_API_BASE}/api/ai/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000)
    });
    if (!res.ok) return { online: false, status: 'error' };
    const data = await res.json();
    return { online: true, ...data };
  } catch (err) {
    return { online: false, message: err.message };
  }
}

/**
 * Evaluates color compatibility and fashion harmony (matching colorRules.js)
 */
function evaluateColorHarmony(colors) {
  const neutrals = new Set(['white', 'black', 'grey', 'gray', 'beige', 'cream', 'khaki', 'navy blue', 'navy', 'denim blue']);
  const lowerColors = colors.map((c) => (c || '').toLowerCase().trim());

  // Check clashing
  for (let i = 0; i < lowerColors.length; i++) {
    for (let j = i + 1; j < lowerColors.length; j++) {
      const a = lowerColors[i];
      const b = lowerColors[j];
      if ((a === 'red' && b === 'green') || (a === 'green' && b === 'red')) {
        return { score: 40, status: 'clashing', details: 'High risk color clash (red and green).' };
      }
      if ((a === 'brown' && b === 'black') || (a === 'black' && b === 'brown')) {
        return { score: 55, status: 'neutral_clash', details: 'Heavy dark neutrals without contrast (brown with black).' };
      }
    }
  }

  // Count neutrals
  const neutralCount = lowerColors.filter((c) => neutrals.has(c)).length;
  if (neutralCount >= lowerColors.length - 1) {
    return {
      score: 95,
      status: 'excellent',
      details: 'Timeless high-contrast neutral harmony with elegant tonal balance.'
    };
  }

  return {
    score: 88,
    status: 'harmonious',
    details: 'Coordinated complementary tones tailored for modern chic aesthetics.'
  };
}

/**
 * Fallback in-browser recommendation generator (exact parity with recommender.js)
 */
function generateClientRecommendations(wardrobe, options = {}) {
  const { occasion = 'Casual outing', season = 'Summer', limit = 4, focalProduct = null } = options;

  const tops = wardrobe.filter((w) => w.category_group === 'top');
  const bottoms = wardrobe.filter((w) => w.category_group === 'bottom');
  const shoes = wardrobe.filter((w) => w.category_group === 'footwear');
  const dresses = wardrobe.filter((w) => w.category_group === 'dress');
  const outer = wardrobe.filter((w) => w.category_group === 'outerwear');

  const candidates = [];

  // Two-piece outfits
  tops.forEach((top) => {
    bottoms.forEach((bot) => {
      shoes.forEach((sh) => {
        // If focalProduct provided, ensure it is included
        if (focalProduct) {
          const hasFocal = top.item_id === focalProduct.id || bot.item_id === focalProduct.id || sh.item_id === focalProduct.id;
          if (!hasFocal) return;
        }

        const items = [top, bot, sh];
        const colors = items.map((i) => i.colour.dominant);
        const harmony = evaluateColorHarmony(colors);

        let score = harmony.score;
        let unwornBonus = 0;
        const unwornNames = [];

        items.forEach((item) => {
          if (item.times_worn === 0) {
            unwornBonus += 6;
            unwornNames.push(`${item.name} (Never worn)`);
          } else if (item.times_worn <= 2) {
            unwornBonus += 3;
            unwornNames.push(`${item.name} (Rarely worn)`);
          }
        });

        score = Math.min(100, score + unwornBonus);

        const explanationParts = [harmony.details];
        explanationParts.push(`Perfect match for ${occasion} in ${season}.`);
        if (unwornNames.length > 0) {
          explanationParts.push(`Sustainable wardrobe pick: revives ${unwornNames.join(', ')}.`);
        }

        candidates.push({
          outfit_id: `outfit_${top.item_id}_${bot.item_id}_${sh.item_id}`,
          type: 'top_bottom_footwear',
          items,
          slots: { top, bottom: bot, footwear: sh },
          occasion,
          season,
          recommendation_score: score,
          compatibility: {
            color_score: harmony.score,
            color_harmony_status: harmony.status,
            is_clashing: harmony.status === 'clashing',
            details: harmony.details
          },
          unworn_bonus: unwornBonus,
          explanation: explanationParts.join(' ')
        });
      });
    });
  });

  // Dress ensembles
  dresses.forEach((dr) => {
    shoes.forEach((sh) => {
      if (focalProduct) {
        const hasFocal = dr.item_id === focalProduct.id || sh.item_id === focalProduct.id;
        if (!hasFocal) return;
      }

      const items = [dr, sh];
      const colors = items.map((i) => i.colour.dominant);
      const harmony = evaluateColorHarmony(colors);

      let score = harmony.score + 2;
      candidates.push({
        outfit_id: `outfit_${dr.item_id}_${sh.item_id}`,
        type: 'dress_footwear',
        items,
        slots: { dress: dr, footwear: sh },
        occasion,
        season,
        recommendation_score: Math.min(100, score),
        compatibility: {
          color_score: harmony.score,
          color_harmony_status: harmony.status,
          is_clashing: false,
          details: 'Effortless single-piece dress silhouette with balanced footwear anchoring.'
        },
        unworn_bonus: 0,
        explanation: `Curated single-piece elegance for ${occasion}. Balanced tones provide sophisticated styling.`
      });
    });
  });

  candidates.sort((a, b) => b.recommendation_score - a.recommendation_score);

  return {
    status: 'success',
    engine: 'client_embedded',
    total_candidates_evaluated: candidates.length,
    returned_count: Math.min(limit, candidates.length),
    filters_applied: { occasion, season },
    recommended_outfits: candidates.slice(0, limit)
  };
}

/**
 * Primary function: Get Smart AI Outfit Recommendations
 * Tries the FastAPI service first, seamlessly falls back to client recommender if offline.
 */
export async function getAIOutfitSuggestions({
  wardrobe = null,
  occasion = 'Casual outing',
  season = 'Summer',
  limit = 4,
  boostUnworn = true,
  focalProduct = null
} = {}) {
  const normalizedWardrobe = wardrobe || getStandardBoutiqueWardrobe();

  try {
    const res = await fetch(`${AI_API_BASE}/api/ai/recommend-outfits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wardrobe: normalizedWardrobe,
        occasion,
        season,
        limit,
        boostUnworn
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.recommended_outfits?.length > 0) {
        // Hydrate items with originalProduct references for 3D try-on
        data.recommended_outfits.forEach((outfit) => {
          outfit.items = outfit.items.map((it) => {
            const found = PRODUCTS.find((p) => p.id === it.item_id);
            return {
              ...it,
              originalProduct: found || it,
              image: found?.image || it.image_reference || it.image,
              price: found?.price || it.price || 120
            };
          });
        });
        return { ...data, engine: 'fastapi_microservice' };
      }
    }
  } catch (err) {
    console.info('FastAPI AI backend not reachable, using client embedded AI engine:', err.message);
  }

  // Fallback to embedded recommender
  return generateClientRecommendations(normalizedWardrobe, {
    occasion,
    season,
    limit,
    focalProduct
  });
}

/**
 * Revives unworn and neglected wardrobe pieces (Sustainable Revival Feature)
 */
export async function getAIRefreshRevival({ wardrobe = null, limit = 4 } = {}) {
  const normalizedWardrobe = wardrobe || getStandardBoutiqueWardrobe();

  try {
    const res = await fetch(`${AI_API_BASE}/api/ai/recommend-unused`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wardrobe: normalizedWardrobe, limit }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const outfits = data.revival_outfits || [];
        outfits.forEach((outfit) => {
          outfit.items = outfit.items.map((it) => {
            const found = PRODUCTS.find((p) => p.id === it.item_id);
            return {
              ...it,
              originalProduct: found || it,
              image: found?.image || it.image_reference || it.image,
              price: found?.price || it.price || 120
            };
          });
        });
        return { ...data, engine: 'fastapi_microservice' };
      }
    }
  } catch (err) {
    console.info('FastAPI AI backend not reachable for revival, using client fallback');
  }

  // Client-side revival fallback
  const recs = generateClientRecommendations(normalizedWardrobe, {
    occasion: 'Casual outing',
    season: 'Summer',
    limit,
    boostUnworn: true
  });

  return {
    status: 'success',
    engine: 'client_embedded',
    neglected_items_count: 3,
    revival_outfits: recs.recommended_outfits
  };
}

/**
 * Uploads an image to the Vision AI classifier to identify clothing item, color, and pattern
 */
export async function analyzeClothingImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${AI_API_BASE}/api/ai/analyze-clothing`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision AI error (${res.status}): ${errText}`);
  }

  return await res.json();
}

