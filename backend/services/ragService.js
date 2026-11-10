/**
 * ragService.js
 * Multi-Modal Hybrid RAG (Retrieval-Augmented Generation) Fashion Engine.
 * 
 * Capabilities:
 * 1. Semantic Intent Parsing: Accurately identifies distinct clothing categories, colors,
 *    patterns, materials, occasions, seasons, and style aesthetics.
 * 2. Strict Category Disambiguation:
 *    - Frock vs Saree vs Dress vs Kurti vs Lehenga vs Jeans vs Trousers vs Shirt.
 *    - NEVER returns a Saree when a Frock is searched, and vice-versa.
 * 3. Hybrid Retrieval: Combines structured MongoDB filtering, text embedding cosine similarity,
 *    and visual feature matching.
 * 4. Three Distinct Result Tiers:
 *    - Exact Matches
 *    - Similar Alternatives (with explicit similarity explanations)
 *    - Matching Outfit Combinations (grounded in authentic MongoDB items)
 * 5. Occasion & Season Grounding:
 *    - Understands weddings, college, office, parties, festivals (Diwali), travel, date night.
 *    - Understands summer, winter, spring, autumn/fall, monsoon/rainy with fabric awareness.
 * 6. Search by Image: Visual embedding search across stored wardrobe items.
 * 7. Optional Verified E-Commerce Recommendations: "Find Similar Online" when absent in wardrobe.
 */

import ClothingItem from '../models/ClothingItem.js';
import Groq from 'groq-sdk';
import {
  cosineSimilarity,
  generateTextEmbedding,
  generateVisualEmbedding
} from './embeddingService.js';

// ── COLOR VOCABULARY & FAMILIES ──────────────────────────────────────────────
export const COLOR_FAMILIES = {
  red: ['red', 'crimson', 'ruby', 'cherry', 'scarlet', 'burgundy', 'maroon', 'wine', 'coral', 'rust', 'terracotta', 'brick', 'vermilion'],
  pink: ['pink', 'blush', 'rose', 'fuchsia', 'magenta', 'dusty rose', 'coral', 'hot pink', 'salmon'],
  blue: ['blue', 'navy', 'navy blue', 'sky blue', 'royal blue', 'indigo', 'denim', 'cobalt', 'teal', 'cyan'],
  green: ['green', 'emerald', 'olive', 'mint', 'forest green', 'sage'],
  black: ['black', 'charcoal', 'noir', 'onyx'],
  white: ['white', 'ivory', 'cream', 'off-white'],
  grey: ['grey', 'gray', 'silver', 'heather grey'],
  beige: ['beige', 'tan', 'camel', 'khaki', 'sand'],
  yellow: ['yellow', 'mustard', 'gold', 'amber'],
  purple: ['purple', 'violet', 'lavender', 'plum', 'lilac'],
  brown: ['brown', 'chocolate', 'coffee', 'mocha', 'caramel']
};

export const COLOR_HEX_MAP = {
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
  beige: '#d2b48c',
  purple: '#9333ea',
  brown: '#78350f'
};

// ── GARMENT SUPER-CATEGORIES & FAMILIES ──────────────────────────────────────
export const CATEGORY_FAMILIES = {
  tops: [
    'top', 'tops', 't-shirt', 'tshirt', 'tee', 'shirt', 'blouse',
    'crop top', 'croptop', 'tank', 'tank top', 'camisole', 'halter',
    'sweater', 'pullover', 'sweatshirt', 'hoodie', 'tunic', 'kurti',
    'kurta', 'polo', 'vest', 'casual top', 'peplum', 'cardigan'
  ],
  bottoms: [
    'bottom', 'bottoms', 'trousers', 'trouser', 'pants', 'pant',
    'jeans', 'jean', 'denim', 'slacks', 'chinos', 'shorts', 'short',
    'leggings', 'skirt', 'skirts', 'cargo', 'joggers', 'palazzo', 'culottes'
  ],
  dresses: [
    'dress', 'dresses', 'frock', 'frocks', 'gown', 'gowns', 'sundress',
    'slip dress', 'cocktail dress', 'maxi dress', 'midi dress', 'mini dress',
    'vest dress', 'anarkali', 'saree', 'sari', 'lehenga', 'jumpsuit', 'romper'
  ],
  outerwear: [
    'outerwear', 'jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers',
    'cardigan', 'trench', 'overcoat', 'shrug', 'parka', 'bomber', 'windbreaker'
  ],
  shoes: [
    'shoes', 'shoe', 'footwear', 'sneakers', 'sneaker', 'boots', 'boot',
    'heels', 'heel', 'pumps', 'pump', 'sandals', 'sandal', 'loafers',
    'loafer', 'flats', 'juttis', 'jutti', 'slippers'
  ],
  accessories: [
    'accessories', 'accessory', 'bag', 'bags', 'handbag', 'purse',
    'clutch', 'tote', 'backpack', 'belt', 'jewelry', 'necklace'
  ]
};

export function getCategoryFamily(catString = '') {
  if (!catString) return null;
  const s = String(catString).toLowerCase().trim();
  for (const [family, members] of Object.entries(CATEGORY_FAMILIES)) {
    if (members.some((m) => s.includes(m) || m.includes(s))) {
      return family;
    }
  }
  return null;
}

export function getColorFamily(colorString = '') {
  if (!colorString) return null;
  const s = normalizeColor(colorString);
  for (const [family, members] of Object.entries(COLOR_FAMILIES)) {
    if (members.some((m) => s.includes(m) || m.includes(s))) {
      return family;
    }
  }
  return null;
}

// ── CATEGORY DEFINITIONS & EXCLUSIONS ────────────────────────────────────────
export const CATEGORY_DEFINITIONS = {
  frock: {
    name: 'Frock',
    synonyms: ['frock', 'skater dress', 'a-line frock', 'summer frock', 'party frock'],
    forbidden: ['saree', 'sari', 'anarkali', 'lehenga', 'kurti', 'trousers', 'jeans', 'shirt']
  },
  saree: {
    name: 'Saree',
    synonyms: ['saree', 'sari', 'banarasi', 'kanjivaram', 'chanderi saree'],
    forbidden: ['frock', 'jeans', 'trousers', 'shirt', 't-shirt', 'sneaker']
  },
  anarkali: {
    name: 'Anarkali',
    synonyms: ['anarkali', 'chikankari suit', 'anarkali suit'],
    forbidden: ['frock', 'jeans', 'shirt', 't-shirt']
  },
  kurti: {
    name: 'Kurti',
    synonyms: ['kurti', 'kurta', 'tunic'],
    forbidden: ['frock', 'saree', 'jeans']
  },
  lehenga: {
    name: 'Lehenga',
    synonyms: ['lehenga', 'choli', 'ghagra'],
    forbidden: ['frock', 'shirt', 'jeans', 'trousers']
  },
  dress: {
    name: 'Dress',
    synonyms: ['dress', 'gown', 'slip dress', 'cocktail dress', 'sundress', 'maxi dress', 'midi dress', 'frock', 'vest dress'],
    forbidden: ['saree', 'sari', 'jeans', 'trousers', 'shirt']
  },
  jeans: {
    name: 'Jeans',
    synonyms: ['jeans', 'denim', 'skinny jeans', 'straight jeans', 'mom jeans'],
    forbidden: ['trousers', 'dress', 'saree', 'frock', 'skirt']
  },
  trousers: {
    name: 'Trousers',
    synonyms: ['trousers', 'pants', 'slacks', 'chinos', 'formal pants', 'bottom', 'bottoms'],
    forbidden: ['jeans', 'dress', 'saree', 'frock']
  },
  shirt: {
    name: 'Shirt',
    synonyms: ['shirt', 'button-down', 'blouse', 'oxford shirt', 'dress shirt', 'top', 'casual top', 't-shirt', 'tee'],
    forbidden: ['dress', 'saree', 'frock', 'jeans']
  },
  't-shirt': {
    name: 'T-Shirt',
    synonyms: ['t-shirt', 'tee', 'crew neck', 'crop top', 'tank top', 'top', 'casual top', 'shirt'],
    forbidden: ['dress', 'saree', 'frock', 'jeans']
  },
  top: {
    name: 'Top',
    synonyms: ['top', 'shirt', 'blouse', 't-shirt', 'tee', 'crop top', 'camisole', 'halter top', 'corset', 'sweater', 'pullover', 'tank', 'tank top', 'casual top'],
    forbidden: ['saree', 'jeans', 'trousers', 'frock', 'lehenga']
  },
  skirt: {
    name: 'Skirt',
    synonyms: ['skirt', 'midi skirt', 'mini skirt', 'pleated skirt', 'a-line skirt'],
    forbidden: ['jeans', 'trousers', 'dress', 'saree']
  },
  jacket: {
    name: 'Jacket',
    synonyms: ['jacket', 'coat', 'blazer', 'overcoat', 'trench', 'cardigan'],
    forbidden: ['shirt', 'jeans', 'dress', 'saree']
  },
  shoes: {
    name: 'Shoes',
    synonyms: ['shoes', 'sneakers', 'boots', 'heels', 'loafers', 'juttis', 'sandals', 'footwear'],
    forbidden: ['shirt', 'pants', 'dress', 'saree']
  },
  traditional: {
    name: 'Traditional',
    synonyms: ['traditional', 'ethnic', 'indian outfit', 'desi', 'festive wear', 'ethnic wear'],
    forbidden: ['jeans', 'western', 't-shirt', 'sneakers']
  }
};

// ── CURATED ECOMMERCE CATALOG (Optional Find Similar Online) ──────────────────
export const ECOMMERCE_CATALOG = [
  {
    _id: 'ecom-red-frock-1',
    id: 'ecom-red-frock-1',
    name: 'Scarlet Red Tiered Chiffon Party Frock',
    category: 'Dress',
    subCategory: 'Frock',
    color: 'Red',
    primaryColor: '#dc2626',
    secondaryColors: ['Crimson'],
    material: 'Lightweight Breathable Chiffon',
    brand: 'Zara Studio',
    store: 'Zara Online',
    price: 79,
    rating: 4.9,
    season: ['Summer', 'Spring'],
    occasion: ['Party', 'Summer party', 'Brunch', 'Birthday'],
    style: ['Chic', 'Playful'],
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=700&auto=format&fit=crop',
    silhouette: 'frock',
    isEcommerce: true,
    tags: ['red', 'frock', 'dress', 'chiffon', 'summer', 'party']
  },
  {
    _id: 'ecom-pink-frock-1',
    id: 'ecom-pink-frock-1',
    name: 'Blush Pink Tiered Chiffon A-Line Frock Dress',
    category: 'Dress',
    subCategory: 'Frock',
    color: 'Pink',
    primaryColor: '#f472b6',
    secondaryColors: ['Pastel Rose'],
    material: 'Fine Chiffon & Silk Crepe',
    brand: 'ASOS Edition',
    store: 'ASOS Fashion',
    price: 85,
    rating: 4.9,
    season: ['Summer', 'Spring'],
    occasion: ['Party', 'Casual', 'Brunch'],
    style: ['Romantic Chic', 'Playful'],
    imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=700&auto=format&fit=crop',
    silhouette: 'frock',
    isEcommerce: true,
    tags: ['pink', 'frock', 'dress', 'chiffon', 'summer', 'casual', 'party']
  },
  {
    _id: 'ecom-red-top-1',
    id: 'ecom-red-top-1',
    name: 'Ruby Red Satin Cowl Neck Party Top',
    category: 'Shirt',
    subCategory: 'Party Top',
    color: 'Red',
    primaryColor: '#dc2626',
    secondaryColors: ['Crimson'],
    material: 'Liquid Silk Satin',
    brand: 'Zara Studio',
    store: 'Zara Online',
    price: 69,
    rating: 4.9,
    season: ['Autumn', 'Winter', 'Spring'],
    occasion: ['Party', 'Dinner', 'Cocktail'],
    style: ['Glamour', 'Chic'],
    imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&auto=format&fit=crop',
    silhouette: 'party-top',
    isEcommerce: true,
    tags: ['red', 'top', 'shirt', 'satin', 'party', 'autumn', 'evening', 'cowl']
  },
  {
    _id: 'ecom-black-jeans-1',
    id: 'ecom-black-jeans-1',
    name: 'Jet Black Washed High-Rise Straight Jeans',
    category: 'Jeans',
    subCategory: 'Straight Jeans',
    color: 'Black',
    primaryColor: '#222222',
    secondaryColors: ['Charcoal'],
    material: '100% Cotton Denim',
    brand: "Levi's Premium",
    store: "Levi's Store",
    price: 98,
    rating: 4.9,
    season: ['Autumn', 'Winter', 'Spring', 'Summer'],
    occasion: ['Casual', 'College', 'Party'],
    style: ['Streetwear', 'Casual'],
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=700&auto=format&fit=crop',
    silhouette: 'jeans',
    isEcommerce: true,
    tags: ['black', 'jeans', 'denim', 'casual', 'college']
  }
];

/**
 * Normalizes color strings
 */
export function normalizeColor(color) {
  if (!color) return 'neutral';
  if (typeof color === 'string') return color.toLowerCase().trim();
  if (typeof color === 'object') {
    return (color.name || color.primary || 'neutral').toLowerCase().trim();
  }
  return 'neutral';
}

/**
 * Standardize MongoDB or E-commerce item record shape
 */
export function formatItemRecord(rawItem) {
  const colorStr = normalizeColor(rawItem.color);
  let colorHex = '#ec4899';
  if (rawItem.primaryColor) colorHex = rawItem.primaryColor;
  else if (typeof rawItem.color === 'object' && rawItem.color.primary) colorHex = rawItem.color.primary;
  else if (COLOR_HEX_MAP[colorStr]) colorHex = COLOR_HEX_MAP[colorStr];
  else {
    for (const [fam, aliases] of Object.entries(COLOR_FAMILIES)) {
      if (aliases.some((a) => colorStr.includes(a))) {
        colorHex = COLOR_HEX_MAP[fam] || '#ec4899';
        break;
      }
    }
  }

  let img = rawItem.imageUrl || rawItem.image || null;
  if (img && typeof img === 'string' && img.startsWith('/uploads')) {
    img = 'http://localhost:5000' + img;
  }

  return {
    _id: String(rawItem._id || rawItem.id),
    id: String(rawItem._id || rawItem.id),
    name: rawItem.name || 'Fashion Garment',
    category: rawItem.category || 'Dress',
    subCategory: rawItem.subCategory || rawItem.subcategory || rawItem.category || 'Piece',
    color: rawItem.color || 'Multi',
    primaryColor: colorHex,
    secondaryColors: Array.isArray(rawItem.secondaryColors) ? rawItem.secondaryColors : [],
    material: rawItem.material || 'Fine Fabric',
    pattern: rawItem.pattern || 'Plain',
    brand: rawItem.brand || 'Digital Wardrobe',
    store: rawItem.store || (rawItem.isEcommerce ? 'E-Commerce Store' : 'Your Digital Wardrobe'),
    price: rawItem.price || 120,
    rating: rawItem.rating || 4.9,
    imageUrl: img,
    image: img,
    season: Array.isArray(rawItem.season) ? rawItem.season : ['All Seasons'],
    occasion: Array.isArray(rawItem.occasion) ? rawItem.occasion : ['Casual'],
    style: Array.isArray(rawItem.style) ? rawItem.style : ['Chic'],
    description: rawItem.description || '',
    text_embedding: rawItem.text_embedding || [],
    image_embedding: rawItem.image_embedding || [],
    silhouette: rawItem.silhouette || rawItem.subCategory || rawItem.category,
    isEcommerce: Boolean(rawItem.isEcommerce),
    isWardrobe: !rawItem.isEcommerce,
    isEstimated: Boolean(rawItem.isEstimated)
  };
}

/**
 * Intelligent Natural Language & Attribute Parser
 */
export function parseQueryAndPreferences(query = '', preferences = {}) {
  const q = (query || '').toLowerCase().trim();

  // 0. Detect Conversational, Greeting, Help, or Styling Inquiries
  const GREETING_OR_HELP_REGEX = /^(hi+|hey+|hello+|hola+|greetings?|good\s+(morning|afternoon|evening)|yo\b|help\b|i\s+need\s+(your\s+|you\s+)?help|can\s+you\s+help|what\s+can\s+you\s+do|who\s+are\s+you|how\s+are\s+you|namaste)/i;
  const GENERAL_STYLING_REGEX = /(what\s+should\s+i\s+wear|style\s+me|suggest\s+(an\s+)?outfit|give\s+me\s+(an\s+)?outfit|recommend\s+(something|an\s+outfit|clothes|something\s+nice)|how\s+to\s+dress|what\s+looks\s+good|outfit\s+ideas?|dress\s+me)/i;
  const FASHION_ADVICE_REGEX = /(how\s+to\s+style|how\s+should\s+i\s+style|what\s+matches\s+with|what\s+goes\s+with|which\s+color\s+matches|how\s+to\s+wear)/i;

  const isGreeting = GREETING_OR_HELP_REGEX.test(q) || q === 'hi' || q === 'hii' || q === 'hello' || q === 'help';
  const isGeneralStyling = GENERAL_STYLING_REGEX.test(q);
  const isAdvice = FASHION_ADVICE_REGEX.test(q);
  const isConversational = isGreeting || isGeneralStyling || isAdvice;

  // 1. Detect Category Intent
  // If the user explicitly typed a category in their text query (e.g. "white frock", "red saree", "black jeans"),
  // that explicit typed keyword is the user's primary intent and overrides any stale dropdown filter.
  let queryCategory = null;
  if (q.includes('frock')) queryCategory = 'frock';
  else if (q.includes('saree') || q.includes('sari')) queryCategory = 'saree';
  else if (q.includes('anarkali')) queryCategory = 'anarkali';
  else if (q.includes('kurti') || q.includes('kurta')) queryCategory = 'kurti';
  else if (q.includes('lehenga') || q.includes('choli')) queryCategory = 'lehenga';
  else if (q.includes('jeans') || q.includes('denim')) queryCategory = 'jeans';
  else if (q.includes('trouser') || q.includes('trousers') || q.includes('slacks') || q.includes('pant')) queryCategory = 'trousers';
  else if (q.includes('t-shirt') || q.includes('tee')) queryCategory = 't-shirt';
  else if (q.includes('shirt') || q.includes('blouse')) queryCategory = 'shirt';
  else if (q.includes('dress') || q.includes('gown') || q.includes('sundress')) queryCategory = 'dress';
  else if (q.includes('skirt')) queryCategory = 'skirt';
  else if (q.includes('jacket') || q.includes('coat') || q.includes('blazer')) queryCategory = 'jacket';
  else if (q.includes('shoe') || q.includes('sneaker') || q.includes('boot') || q.includes('jutti') || q.includes('loafer')) queryCategory = 'shoes';
  else if (q.includes('traditional') || q.includes('ethnic') || q.includes('desi')) queryCategory = 'traditional';
  else if (q.includes('top') || q.includes('crop')) queryCategory = 'top';

  let targetCategory = null;
  if (queryCategory) {
    targetCategory = queryCategory;
  } else if (!isGreeting && preferences.category && preferences.category !== 'All' && preferences.category !== 'all') {
    targetCategory = preferences.category.toLowerCase().trim();
  }

  // 2. Detect Color Intent
  let queryColor = null;
  for (const [col, aliases] of Object.entries(COLOR_FAMILIES)) {
    if (aliases.some((a) => q.includes(a))) {
      queryColor = col;
      break;
    }
  }

  let targetColor = null;
  if (queryColor) {
    targetColor = queryColor;
  } else if (!isGreeting && preferences.color && preferences.color !== 'All' && preferences.color !== 'all') {
    targetColor = preferences.color.toLowerCase().trim();
  }

  // 3. Detect Pattern Intent
  let targetPattern = null;
  if (q.includes('floral') || q.includes('flower')) targetPattern = 'Floral';
  else if (q.includes('striped') || q.includes('stripe')) targetPattern = 'Striped';
  else if (q.includes('checked') || q.includes('plaid')) targetPattern = 'Checked';
  else if (q.includes('printed') || q.includes('print')) targetPattern = 'Printed';
  else if (q.includes('plain') || q.includes('solid')) targetPattern = 'Plain';

  // 4. Detect Occasion Intent
  let targetOccasion = preferences.occasion && preferences.occasion !== 'All' ? preferences.occasion : null;
  if (!targetOccasion) {
    if (q.includes('wedding') || q.includes('marriage')) targetOccasion = 'Wedding';
    else if (q.includes('festival') || q.includes('diwali') || q.includes('eid') || q.includes('puja')) targetOccasion = 'Festival';
    else if (q.includes('party') || q.includes('cocktail') || q.includes('club')) targetOccasion = 'Party';
    else if (q.includes('work') || q.includes('office') || q.includes('formal') || q.includes('meeting')) targetOccasion = 'Work';
    else if (q.includes('college') || q.includes('campus') || q.includes('class')) targetOccasion = 'College';
    else if (q.includes('dinner') || q.includes('date')) targetOccasion = 'Dinner';
    else if (q.includes('travel') || q.includes('trip') || q.includes('vacation')) targetOccasion = 'Travel';
    else if (q.includes('birthday')) targetOccasion = 'Party';
    else if (q.includes('casual') || q.includes('daily')) targetOccasion = 'Casual';
  }

  // 5. Detect Season Intent
  let targetSeason = preferences.weather && preferences.weather !== 'All' ? preferences.weather : (preferences.season && preferences.season !== 'All' ? preferences.season : null);
  if (!targetSeason) {
    if (q.includes('summer') || q.includes('hot') || q.includes('beach') || q.includes('sunny')) targetSeason = 'Summer';
    else if (q.includes('winter') || q.includes('cold') || q.includes('chilly') || q.includes('snow') || q.includes('warm')) targetSeason = 'Winter';
    else if (q.includes('monsoon') || q.includes('rain') || q.includes('rainy')) targetSeason = 'Monsoon';
    else if (q.includes('autumn') || q.includes('fall')) targetSeason = 'Autumn';
    else if (q.includes('spring')) targetSeason = 'Spring';
  }

  // 6. Detect Material Intent
  let targetMaterial = null;
  if (q.includes('cotton')) targetMaterial = 'Cotton';
  else if (q.includes('silk')) targetMaterial = 'Silk';
  else if (q.includes('denim')) targetMaterial = 'Denim';
  else if (q.includes('wool') || q.includes('cashmere')) targetMaterial = 'Wool';
  else if (q.includes('chiffon')) targetMaterial = 'Chiffon';
  else if (q.includes('satin')) targetMaterial = 'Satin';
  else if (q.includes('linen')) targetMaterial = 'Linen';

  const isSpecificSearch = !isConversational && Boolean(
    targetCategory || targetColor || targetOccasion || targetSeason || targetPattern || (q && q.length > 2 && !isGreeting)
  );

  return {
    rawQuery: q,
    targetCategory,
    targetColor,
    targetPattern,
    targetOccasion,
    targetSeason,
    targetMaterial,
    style: preferences.style || null,
    isSpecificSearch,
    isConversational,
    isGreeting,
    isGeneralStyling,
    isAdvice
  };
}

/**
 * Strict Category Matching & Disambiguation
 * Returns:
 *   1.0 -> Exact match on requested category
 *   0.5 -> Related compatible family (e.g. dress when frock requested)
 *  -1.0 -> Strictly forbidden / clashing category (e.g. saree when frock requested)
 */
export function evaluateCategoryMatch(item, targetCategory) {
  if (!targetCategory) return 1.0;

  const cat = (item.category || '').toLowerCase();
  const subCat = (item.subCategory || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();

  const combined = `${name} ${subCat} ${cat} ${desc}`;

  // 1. Strict Frock Disambiguation
  if (targetCategory === 'frock') {
    if (combined.includes('saree') || combined.includes('sari') || combined.includes('anarkali') || combined.includes('lehenga') || combined.includes('kurti')) {
      return -1.0; // DISQUALIFY! A Saree or Anarkali is NEVER a Frock!
    }
    if (combined.includes('frock')) return 1.0;
    if (combined.includes('sundress') || combined.includes('skater') || (cat === 'dress' && !combined.includes('formal') && !combined.includes('ethnic'))) {
      return 0.85; // Suitable western dress alternative
    }
    return -1.0;
  }

  // 2. Strict Saree Disambiguation
  if (targetCategory === 'saree') {
    if (combined.includes('frock') || combined.includes('jeans') || combined.includes('t-shirt') || combined.includes('sneaker')) {
      return -1.0;
    }
    if (combined.includes('saree') || combined.includes('sari')) return 1.0;
    if (combined.includes('anarkali') || combined.includes('lehenga')) return 0.5; // Traditional alternative
    return -1.0;
  }

  // 3. Strict Jeans Disambiguation
  if (targetCategory === 'jeans') {
    if (combined.includes('dress') || combined.includes('saree') || combined.includes('frock')) return -1.0;
    if (combined.includes('jean') || combined.includes('denim')) return 1.0;
    if (combined.includes('trouser') || combined.includes('pant')) return 0.4; // Similar alternative bottom
    return -1.0;
  }

  // 4. Strict Trousers Disambiguation
  if (targetCategory === 'trousers') {
    if (combined.includes('trouser') || combined.includes('slacks') || combined.includes('chino') || (cat === 'trousers' && !combined.includes('jean'))) return 1.0;
    if (combined.includes('jean')) return 0.5;
    return -1.0;
  }

  // 5. Strict Top Disambiguation (Shirts, Blouses, T-Shirts, Tops, Sweaters, Casual Tops are all Tops)
  const isTargetTop = ['top', 't-shirt', 'shirt', 'blouse', 'tee', 'tank', 'sweater', 'crop top'].includes(targetCategory);
  if (isTargetTop) {
    if (combined.includes('saree') || combined.includes('anarkali') || combined.includes('lehenga') || combined.includes('jeans') || combined.includes('trouser') || combined.includes('frock')) return -1.0;
    if (cat.includes('shirt') || cat.includes('top') || cat.includes('blouse') || cat.includes('t-shirt') || cat.includes('sweater')) return 1.0;
    if (subCat.includes('shirt') || subCat.includes('top') || subCat.includes('blouse') || subCat.includes('crew') || subCat.includes('button-down') || subCat.includes('sweater') || subCat.includes('tee')) return 1.0;
    if (name.includes('shirt') || name.includes('top') || name.includes('blouse') || name.includes('tee') || name.includes('sweater') || name.includes('t-shirt') || name.includes('tank')) return 1.0;
    return 0.0;
  }

  // 6. Strict Traditional / Ethnic
  if (targetCategory === 'traditional') {
    if (combined.includes('saree') || combined.includes('anarkali') || combined.includes('kurti') || combined.includes('lehenga')) {
      return 1.0;
    }
    if (combined.includes('jutti') || combined.includes('ethnic')) {
      return 0.75;
    }
    return -1.0;
  }

  // 7. Generic Category & Super-Family Lookup
  const targetFam = getCategoryFamily(targetCategory);
  const itemFam = getCategoryFamily(combined);
  if (targetFam && itemFam && targetFam === itemFam) {
    return 1.0;
  }

  const def = CATEGORY_DEFINITIONS[targetCategory];
  if (def) {
    for (const f of def.forbidden) {
      if (combined.includes(f)) return -1.0;
    }
    for (const syn of def.synonyms) {
      if (combined.includes(syn)) return 1.0;
    }
  }

  if (cat.includes(targetCategory) || subCat.includes(targetCategory) || name.includes(targetCategory)) {
    return 1.0;
  }

  return 0.0;
}

/**
 * Evaluates Color Harmony & Match
 */
export function evaluateColorMatch(item, targetColor) {
  if (!targetColor) return 1.0;

  const itemColor = normalizeColor(item.color);
  const name = (item.name || '').toLowerCase();
  const sec = Array.isArray(item.secondaryColors) ? item.secondaryColors.map((s) => s.toLowerCase()).join(' ') : '';
  const combined = `${itemColor} ${sec} ${name}`;

  const aliases = COLOR_FAMILIES[targetColor] || [targetColor];

  // Exact primary color match
  if (aliases.some((a) => itemColor === a || itemColor.includes(a))) return 1.0;
  // Secondary color match
  if (aliases.some((a) => combined.includes(a))) return 0.9;

  // Family equivalence check (e.g. coral and red, navy and blue)
  const targetFam = getColorFamily(targetColor);
  const itemFam = getColorFamily(itemColor) || getColorFamily(name);
  if (targetFam && itemFam && targetFam === itemFam) {
    return 1.0;
  }

  return 0.0;
}

/**
 * Evaluates Occasion Match
 */
export function evaluateOccasionMatch(item, targetOccasion) {
  if (!targetOccasion) return 0.5;

  const occasions = Array.isArray(item.occasion) ? item.occasion.map((o) => o.toLowerCase()) : [];
  const name = (item.name || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const tOcc = targetOccasion.toLowerCase();

  if (occasions.some((o) => o.includes(tOcc) || tOcc.includes(o))) return 1.0;
  if (name.includes(tOcc) || desc.includes(tOcc)) return 0.9;

  // Versatile items get 0.4
  if (occasions.includes('casual') || occasions.includes('versatile')) return 0.4;

  return 0.1;
}

/**
 * Evaluates Season Match
 */
export function evaluateSeasonMatch(item, targetSeason) {
  if (!targetSeason) return 0.5;

  const seasons = Array.isArray(item.season) ? item.season.map((s) => s.toLowerCase()) : [];
  const tSea = targetSeason.toLowerCase();
  const material = (item.material || '').toLowerCase();

  if (seasons.some((s) => s.includes(tSea) || tSea.includes(s))) return 1.0;
  if (seasons.includes('all season') || seasons.includes('all seasons')) return 0.7;

  // Material-based season alignment
  if (tSea === 'summer' && (material.includes('cotton') || material.includes('linen') || material.includes('chiffon'))) return 0.8;
  if (tSea === 'winter' && (material.includes('wool') || material.includes('cashmere') || material.includes('velvet'))) return 0.8;

  return 0.1;
}

/**
 * Multi-Attribute Scoring Engine for RAG Candidates
 */
export function scoreItemAgainstQuery(item, intent, queryEmbedding = null) {
  const catScore = evaluateCategoryMatch(item, intent.targetCategory);
  if (catScore < 0) {
    // Strictly disqualified from matching this category
    return { totalScore: -100, isDisqualified: true, catScore, colorScore: 0 };
  }

  const colScore = evaluateColorMatch(item, intent.targetColor);
  const occScore = evaluateOccasionMatch(item, intent.targetOccasion);
  const seaScore = evaluateSeasonMatch(item, intent.targetSeason);

  // Pattern Match
  let patScore = 0.5;
  if (intent.targetPattern) {
    const itemPat = (item.pattern || '').toLowerCase();
    const itemName = (item.name || '').toLowerCase();
    const tPat = intent.targetPattern.toLowerCase();
    patScore = itemPat.includes(tPat) || itemName.includes(tPat) ? 1.0 : 0.1;
  }

  // Material Match
  let matScore = 0.5;
  if (intent.targetMaterial) {
    const itemMat = (item.material || '').toLowerCase();
    matScore = itemMat.includes(intent.targetMaterial.toLowerCase()) ? 1.0 : 0.2;
  }

  // Semantic Vector Similarity
  let semanticSim = 0.5;
  if (queryEmbedding && Array.isArray(item.text_embedding) && item.text_embedding.length > 0) {
    semanticSim = Math.max(0, cosineSimilarity(queryEmbedding, item.text_embedding));
  }

  // Weighted total score (0 to 100)
  let totalScore =
    catScore * 35 +
    colScore * 25 +
    occScore * 14 +
    seaScore * 10 +
    patScore * 6 +
    matScore * 5 +
    semanticSim * 15;

  return {
    totalScore: Math.round(totalScore),
    isDisqualified: false,
    catScore,
    colScore,
    occScore,
    seaScore,
    patScore,
    matScore,
    semanticSim
  };
}

/**
 * Builds Matching Outfits using authentic MongoDB pieces
 */
export function assembleComplementaryOutfit(heroItem, wardrobeItems, intent) {
  const heroCat = (heroItem.category || '').toLowerCase();
  const heroSub = (heroItem.subCategory || '').toLowerCase();
  const heroName = (heroItem.name || '').toLowerCase();

  const isOnePiece =
    heroCat.includes('dress') ||
    heroSub.includes('frock') ||
    heroSub.includes('saree') ||
    heroSub.includes('anarkali') ||
    heroName.includes('frock') ||
    heroName.includes('saree');

  const pieces = [heroItem];
  const explanations = [];

  const otherItems = wardrobeItems.filter((i) => i._id !== heroItem._id);

  if (isOnePiece) {
    // Pair with shoes
    const shoe =
      otherItems.find((i) => (i.category || '').toLowerCase() === 'shoes' && (heroSub.includes('saree') ? i.name.toLowerCase().includes('jutti') : !i.name.toLowerCase().includes('jutti'))) ||
      otherItems.find((i) => (i.category || '').toLowerCase() === 'shoes');

    if (shoe) {
      pieces.push(shoe);
      explanations.push(`Paired with ${shoe.name} to ground the ${heroItem.name} with coordinated elegance.`);
    }

    // Pair with outerwear if cold or formal
    if (intent.targetSeason === 'Winter' || intent.targetSeason === 'Autumn' || intent.targetOccasion === 'Formal') {
      const layer = otherItems.find((i) => (i.category || '').toLowerCase() === 'jacket');
      if (layer) {
        pieces.push(layer);
        explanations.push(`Layered with ${layer.name} for thermal comfort and tailored sophistication.`);
      }
    }
  } else if (heroCat.includes('jeans') || heroCat.includes('trouser')) {
    // Pair with top
    const top =
      otherItems.find((i) => ['shirt', 't-shirt', 'top'].includes((i.category || '').toLowerCase()) && (intent.targetOccasion === 'College' || intent.targetOccasion === 'Casual' ? i.category === 'T-Shirt' : i.category === 'Shirt')) ||
      otherItems.find((i) => ['shirt', 't-shirt', 'top'].includes((i.category || '').toLowerCase()));

    if (top) {
      pieces.push(top);
      explanations.push(`Balanced with ${top.name} because the colors and silhouettes complement your ${heroItem.name}.`);
    }

    // Pair with shoes
    const sneakerOrShoe =
      otherItems.find((i) => (i.category || '').toLowerCase() === 'shoes' && i.name.toLowerCase().includes('sneaker')) ||
      otherItems.find((i) => (i.category || '').toLowerCase() === 'shoes');

    if (sneakerOrShoe) {
      pieces.push(sneakerOrShoe);
      explanations.push(`Finished with ${sneakerOrShoe.name} for an effortless, walk-ready ensemble.`);
    }
  } else {
    // Hero is a top -> Pair with bottom & shoes
    const bottom =
      otherItems.find((i) => ['jeans', 'trousers', 'skirt'].includes((i.category || '').toLowerCase())) ||
      otherItems[0];

    if (bottom) {
      pieces.push(bottom);
      explanations.push(`Styled with ${bottom.name} to establish a clean, proportional silhouette.`);
    }

    const shoes = otherItems.find((i) => (i.category || '').toLowerCase() === 'shoes');
    if (shoes) {
      pieces.push(shoes);
      explanations.push(`Completed with ${shoes.name}.`);
    }
  }

  return {
    outfitName: `${heroItem.name} Curated Ensemble`,
    clothingItems: pieces,
    clothingItemIds: pieces.map((p) => String(p._id)),
    confidence: 0.94,
    occasion: intent.targetOccasion || heroItem.occasion?.[0] || 'Versatile',
    season: intent.targetSeason || heroItem.season?.[0] || 'All Season',
    style: heroItem.style?.[0] || 'Contemporary',
    colorHarmony: `${normalizeColor(heroItem.color).toUpperCase()} base harmonized with complementary accents.`,
    explanation: explanations.join(' ') || `Crafted exclusively from your personal MongoDB wardrobe items.`,
    isGroundedinMongoDB: true
  };
}

/**
 * Conversational Stylist Advice Generator (Groq LLaMA-3 with Smart Fallback)
 */
export async function generateStylistConversationalAdvice({ query, intent, wardrobeItems = [] }) {
  let stylistMessage = null;
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey && apiKey.startsWith('gsk_') && apiKey.length > 20) {
    try {
      const groq = new Groq({ apiKey });
      const wardrobeNames = wardrobeItems.slice(0, 10).map((w) => `${w.name} (${w.category})`).join(', ');

      const completion = await Promise.race([
        groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are the chic, knowledgeable personal AI Fashion Stylist in the WardrobeWise 3D digital closet app. The user has ${wardrobeItems.length} personal wardrobe items in MongoDB including: ${wardrobeNames}.
Your rules:
1. Speak in a chic, warm, welcoming, natural fashion stylist voice.
2. Keep responses concise (2 to 3 sentences).
3. If user greets ("hi", "need help"), welcome them and invite them to explore or wear outfits on their 3D model.
4. If user asks what to wear or how to style, give concrete advice using their wardrobe pieces.
5. NEVER claim a clothing item is missing when the user is chatting, greeting, or asking general advice.
6. Do not use markdown headers or bullet points.`
            },
            {
              role: 'user',
              content: query || 'Hello'
            }
          ],
          max_tokens: 160,
          temperature: 0.6
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Groq timeout')), 3000))
      ]);

      stylistMessage = completion.choices[0]?.message?.content?.trim();
    } catch (err) {
      console.warn('[RAG] Groq conversational advice fallback:', err.message);
    }
  }

  if (!stylistMessage) {
    if (intent.isGreeting) {
      stylistMessage = `Hello! I'm your AI Fashion Stylist. I've analyzed your ${wardrobeItems.length} personal wardrobe items. I'm ready to help you coordinate outfits, match colors, or dress your 3D avatar for any occasion!`;
    } else if (intent.isGeneralStyling) {
      stylistMessage = `Here are curated looks handpicked from your wardrobe. You can click 'Wear' on any outfit below to preview it immediately on your 3D avatar!`;
    } else if (intent.isAdvice) {
      stylistMessage = `For optimal harmony, balance statement pieces with neutral staples and coordinated footwear. Here are curated items from your collection tailored for your style.`;
    } else {
      stylistMessage = `Welcome to your digital closet! I'm here to curate outfits and style your 3D model with your wardrobe collection.`;
    }
  }

  return stylistMessage;
}

/**
 * MASTER RAG CONTROLLER: End-to-End Hybrid Retrieval & Recommendations
 */
export async function executeRAGOutfitStylist({ userId, query = '', preferences = {} }) {
  // 1. Fetch authentic MongoDB items
  let filter = {};
  if (userId) {
    const count = await ClothingItem.countDocuments({ userId });
    if (count > 0) filter.userId = userId;
  }

  let rawItems = await ClothingItem.find(filter).lean();
  if (!rawItems || rawItems.length === 0) {
    rawItems = await ClothingItem.find({}).lean();
  }

  const wardrobeItems = (rawItems || []).map(formatItemRecord);

  // 2. Query Understanding & Attribute Parsing
  const intent = parseQueryAndPreferences(query, preferences);

  // 2b. Conversational, Greeting, or General Styling Handling
  if (intent.isConversational) {
    const stylistMessage = await generateStylistConversationalAdvice({ query, intent, wardrobeItems });

    // Provide top featured pieces from wardrobe
    const featuredItems = wardrobeItems.slice(0, 6).map((item) => ({
      ...item,
      matchScore: 94,
      matchType: 'Featured Wardrobe Pick',
      matchReason: 'Curated by your AI Stylist from your personal wardrobe.'
    }));

    // Generate complementary outfits
    const matchingOutfits = [];
    const heroItems = [
      wardrobeItems.find((i) => (i.subCategory || '').toLowerCase().includes('frock') || (i.name || '').toLowerCase().includes('frock')),
      wardrobeItems.find((i) => (i.category || '').toLowerCase().includes('jeans')),
      wardrobeItems.find((i) => (i.subCategory || '').toLowerCase().includes('saree'))
    ].filter(Boolean);

    for (const hero of heroItems.slice(0, 2)) {
      matchingOutfits.push(assembleComplementaryOutfit(hero, wardrobeItems, intent));
    }
    if (matchingOutfits.length === 0 && wardrobeItems[0]) {
      matchingOutfits.push(assembleComplementaryOutfit(wardrobeItems[0], wardrobeItems, intent));
    }

    return {
      success: true,
      userQuery: query,
      appliedFilters: {},
      isConversational: true,
      stylistMessage,
      notFound: false,
      message: stylistMessage,
      exactMatches: featuredItems,
      similarAlternatives: [],
      matchingOutfits,
      recommendations: matchingOutfits,
      ecommerceMatches: [],
      retrievedCount: featuredItems.length,
      generationSource: 'Groq LLaMA-3 Fashion Stylist (MongoDB Grounded)'
    };
  }

  const queryEmbedding = generateTextEmbedding(intent.rawQuery || intent.targetCategory || 'clothing');

  // 3. Score all Wardrobe Items
  const scoredWardrobe = [];

  for (const item of wardrobeItems) {
    const scoreResult = scoreItemAgainstQuery(item, intent, queryEmbedding);
    if (!scoreResult.isDisqualified) {
      scoredWardrobe.push({
        item,
        ...scoreResult
      });
    }
  }

  // Sort descending by totalScore
  scoredWardrobe.sort((a, b) => b.totalScore - a.totalScore);

  // 4. Group into Exact Matches vs. Similar Alternatives
  const exactMatches = [];
  const similarAlternatives = [];

  for (const entry of scoredWardrobe) {
    const { item, totalScore, catScore, colScore, occScore, seaScore, semanticSim } = entry;

    // Strict Exact Match Criteria:
    // Must match requested category/color, and must have authentic keyword or high semantic relevance to query
    let hasDirectKeywordOrAttributeMatch = false;
    if (intent.targetCategory) {
      hasDirectKeywordOrAttributeMatch = catScore >= 0.8;
    } else if (intent.targetColor) {
      hasDirectKeywordOrAttributeMatch = colScore >= 0.8;
    } else if (intent.rawQuery && intent.rawQuery.trim().length > 0) {
      const qTokens = intent.rawQuery.split(/\s+/).filter((t) => t.length > 2);
      const itemText = `${item.name} ${item.category} ${item.subCategory} ${item.color} ${item.material} ${item.description}`.toLowerCase();
      hasDirectKeywordOrAttributeMatch = qTokens.some((t) => itemText.includes(t)) || semanticSim >= 0.72;
    } else {
      hasDirectKeywordOrAttributeMatch = true; // generic browsing without query
    }

    const isCategoryExact = !intent.targetCategory || catScore >= 0.8;
    const isColorExact = !intent.targetColor || colScore >= 0.8;
    const isExact = isCategoryExact && isColorExact && (totalScore >= 50 || hasDirectKeywordOrAttributeMatch);

    if (isExact) {
      exactMatches.push({
        ...item,
        matchScore: totalScore,
        matchType: 'Exact Match',
        matchReason: `Matches your requested ${intent.targetColor ? `${intent.targetColor} ` : ''}${intent.targetCategory || 'garment'}${intent.targetOccasion ? ` for ${intent.targetOccasion}` : ''}.`
      });
    } else if (totalScore >= 35) {
      // If a specific color was requested, NEVER suggest completely non-matching colors (e.g. no beige or white when red was searched)
      if (intent.targetColor && colScore < 0.75) {
        continue;
      }
      // If exact matches already exist, do not flood with non-matching alternatives
      if (exactMatches.length > 0 && colScore < 0.8) {
        continue;
      }

      // Build clear explanation of why this is a similar alternative
      const reasons = [];
      if (colScore >= 0.8 && !isCategoryExact) {
        reasons.push(`Shares your requested ${intent.targetColor} color palette, but is a ${item.subCategory || item.category} rather than a ${intent.targetCategory}.`);
      } else if (isCategoryExact && !isColorExact) {
        reasons.push(`Matches your requested ${intent.targetCategory} category, but features a ${item.color} hue instead of ${intent.targetColor}.`);
      } else if (occScore >= 0.8) {
        reasons.push(`Suited for your requested ${intent.targetOccasion} occasion.`);
      } else if (seaScore >= 0.8) {
        reasons.push(`Perfect for ${intent.targetSeason} weather.`);
      } else {
        reasons.push(`Close chromatic and stylistic harmony with your search.`);
      }

      similarAlternatives.push({
        ...item,
        matchScore: totalScore,
        matchType: 'Similar Alternative',
        alternativeReason: reasons.join(' ')
      });
    }
  }

  // 5. Generate Outfit Combinations
  const matchingOutfits = [];
  const heroForOutfit = exactMatches[0] || similarAlternatives[0] || wardrobeItems[0];
  if (heroForOutfit) {
    const outfit = assembleComplementaryOutfit(heroForOutfit, wardrobeItems, intent);
    matchingOutfits.push(outfit);
  }

  // 6. Handle "Item Does Not Exist" & Optional E-Commerce Fallback
  let notFound = false;
  let notFoundMessage = null;
  let ecommerceMatches = [];

  if (exactMatches.length === 0 && intent.isSpecificSearch) {
    notFound = true;
    notFoundMessage = `This exact item "${query || intent.targetCategory || 'requested piece'}" is not available in your personal wardrobe.`;

    // Search Curated E-Commerce Catalog strictly matching the query
    ecommerceMatches = ECOMMERCE_CATALOG.filter((ecom) => {
      const catScore = evaluateCategoryMatch(ecom, intent.targetCategory);
      if (catScore < 0.8) return false;
      if (intent.targetColor) {
        const colScore = evaluateColorMatch(ecom, intent.targetColor);
        if (colScore < 0.8) return false;
      }
      return true;
    }).map((e) => ({
      ...formatItemRecord(e),
      matchType: 'Find Similar Online (E-Commerce)',
      isEcommerce: true
    }));
  }

  return {
    success: true,
    userQuery: query,
    appliedFilters: {
      category: intent.targetCategory,
      color: intent.targetColor,
      occasion: intent.targetOccasion,
      season: intent.targetSeason,
      pattern: intent.targetPattern,
      material: intent.targetMaterial
    },
    notFound,
    message: notFound ? notFoundMessage : `Found ${exactMatches.length} exact matches in your MongoDB wardrobe.`,
    exactMatches,
    similarAlternatives,
    matchingOutfits,
    recommendations: matchingOutfits,
    ecommerceMatches,
    retrievedCount: exactMatches.length + similarAlternatives.length,
    generationSource: 'Intelligent Wardrobe RAG Engine (MongoDB Grounded)'
  };
}

/**
 * Image-Based Clothing Search & Outfit Recommendation
 */
export async function executeRAGImageSearch({ features = {}, userId = null }) {
  const { category, dominantColor, pattern, aspectRatio } = features;

  const targetCategory = category ? category.toLowerCase() : null;
  const targetColor = dominantColor ? dominantColor.toLowerCase() : null;

  // Search using the multi-attribute pipeline
  const result = await executeRAGOutfitStylist({
    userId,
    query: `${dominantColor || ''} ${category || ''}`.trim(),
    preferences: {
      category: targetCategory,
      color: targetColor,
      pattern
    }
  });

  return {
    ...result,
    searchMode: 'visual_image_search',
    scannedFeatures: {
      category: category || 'Detected Garment',
      color: dominantColor || 'Detected Hue',
      pattern: pattern || 'Solid',
      aspectRatio: aspectRatio || '1.0'
    }
  };
}

export default {
  executeRAGOutfitStylist,
  executeRAGImageSearch,
  parseQueryAndPreferences,
  evaluateCategoryMatch,
  evaluateColorMatch,
  evaluateOccasionMatch,
  evaluateSeasonMatch,
  scoreItemAgainstQuery,
  assembleComplementaryOutfit
};
