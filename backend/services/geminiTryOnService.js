import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { Client } from '@gradio/client';
import { getGeminiConfig } from './geminiService.js';

// Ensure tryon output directory exists
const TRYON_UPLOAD_DIR = path.resolve('uploads', 'tryon');
if (!fs.existsSync(TRYON_UPLOAD_DIR)) {
  fs.mkdirSync(TRYON_UPLOAD_DIR, { recursive: true });
}

/**
 * Converts image file path, URL, data URI, or Buffer to { buffer, base64, mimeType }
 * Automatically resolves localhost /uploads/ URLs and relative public paths to disk.
 */
export async function resolveImagePayload(input, fallbackMime = 'image/jpeg') {
  let buffer;
  let mimeType = fallbackMime;

  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('data:image/')) {
      const match = input.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(input, 'base64');
      }
    } else {
      let pathname = input;
      if (input.startsWith('http://') || input.startsWith('https://')) {
        try {
          const parsed = new URL(input);
          pathname = parsed.pathname;
        } catch {
          pathname = input;
        }
      }

      // Check candidate locations across local workspace
      const candidates = [
        path.resolve(input),
        path.resolve('.' + pathname),
        path.resolve(pathname.replace(/^\//, '')),
        path.resolve('uploads', pathname.replace(/^\/uploads\/?/, '')),
        path.resolve('backend', 'uploads', pathname.replace(/^\/uploads\/?/, '')),
        path.resolve('frontend', 'public', pathname.replace(/^\//, '')),
        path.resolve('..', 'backend', 'uploads', pathname.replace(/^\/uploads\/?/, '')),
        path.resolve('..', 'frontend', 'public', pathname.replace(/^\//, '')),
        path.resolve('My-Wardrobe', 'backend', 'uploads', pathname.replace(/^\/uploads\/?/, '')),
        path.resolve('My-Wardrobe', 'frontend', 'public', pathname.replace(/^\//, '')),
      ];

      let foundPath = null;
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          foundPath = c;
          break;
        }
      }

      if (foundPath) {
        buffer = fs.readFileSync(foundPath);
        const ext = path.extname(foundPath).toLowerCase();
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';
        else mimeType = 'image/jpeg';
      } else if (input.startsWith('http://') || input.startsWith('https://')) {
        try {
          const res = await fetch(input, { signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const arr = await res.arrayBuffer();
            buffer = Buffer.from(arr);
            const ct = res.headers.get('content-type');
            if (ct) mimeType = ct;
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch (fetchErr) {
          throw new Error(`Could not load image from ${input}: ${fetchErr.message}`);
        }
      } else {
        throw new Error(`Cannot resolve image input: file not found at ${input}`);
      }
    }
  } else {
    throw new Error('Invalid image input: expected Buffer or string path/URL.');
  }

  return {
    buffer,
    base64: buffer.toString('base64'),
    mimeType,
  };
}

/**
 * Analyzes a garment image with Gemini Vision to detect category, neckline, silhouette,
 * and whether it has a single continuous skirt (dress) or separated legs (pants/cordset).
 */
export async function analyzeGarmentWithGeminiVision(garmentBuffer, mimeType = 'image/png') {
  const { apiKey, isConfigured } = getGeminiConfig();
  if (!isConfigured) {
    return null;
  }

  try {
    console.log('[Gemini Try-On AI] Analyzing garment visually with Gemini-3.5-flash-lite...');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const base64 = garmentBuffer.toString('base64');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this fashion garment in extreme detail (sleeve design, flare/silhouette, pattern, color, fabric, neckline, design accents). Return ONLY a valid JSON object:
{
  "category": "dresses" | "tops" | "bottoms" | "outerwear",
  "garmentType": string (e.g. "Sleeveless Flared A-line Dress", "Full-Body Maxi Frock", "Long Sleeve Gown", "Crop Top", "Trousers"),
  "length": "full-length" | "maxi" | "midi" | "knee-length" | "mini",
  "isFullBodyFrock": boolean (true for full-length frocks, gowns, and maxi dresses that extend to ankles),
  "sleeves": string (e.g. "sleeveless", "short sleeves", "off-the-shoulder", "cap sleeves", "long sleeves", "strapless"),
  "sleeveType": "sleeveless" | "short" | "long" | "off-shoulder" | "strapless",
  "isSleeveless": boolean (true if arms are bare/sleeveless),
  "hasLongSleeves": boolean (true ONLY if sleeves extend down the arms to wrists),
  "flare": string (e.g. "wide high-volume flare", "pleated flared skirt", "A-line flare", "straight column", "bodycon"),
  "silhouette": string (e.g. "pleated flared A-line frock", "fit and flare", "bodycon", "straight"),
  "neckline": string (e.g. "lapel V-neck", "sweetheart off-the-shoulder", "square", "v-neck", "halter"),
  "designDetails": string (e.g. "button-down front, lapel collar, pleated waist"),
  "color": string (e.g. "warm brown tweed", "rich chocolate brown", "crimson red"),
  "primaryColorHex": string (e.g. "#5A4738", "#3D2314", "#C41E3A"),
  "pattern": string (e.g. "tweed heathered", "solid smooth", "floral print", "polka dots", "plaid"),
  "fabric": string (e.g. "tweed wool", "georgette", "silk satin", "cotton"),
  "isSingleSkirt": boolean (true for dresses, frocks, and skirts; false for pants or separate legs),
  "hasSeparateLegs": boolean (true for pants, cordsets, or jumpsuits; false for dresses and frocks),
  "cleanTitle": string,
  "vtonPrompt": string (precise description for diffusion virtual try-on)
}`
            },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }]
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        let clean = rawText.trim();
        if (clean.includes('```json')) clean = clean.split('```json')[1].split('```')[0].trim();
        else if (clean.includes('```')) clean = clean.split('```')[1].split('```')[0].trim();
        const parsed = JSON.parse(clean);
        console.log(`[Gemini Try-On AI] Garment visual analysis: "${parsed.cleanTitle || parsed.garmentType}" (category: ${parsed.category}, isSingleSkirt: ${parsed.isSingleSkirt})`);
        return parsed;
      }
    } else {
      console.warn('[Gemini Try-On AI] Garment analysis notice:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('[Gemini Try-On AI] Garment analysis exception:', err.message);
  }

  return null;
}

/**
 * Analyzes the person photo to detect exact body landmarks (collarbone, chest, waist, hips, knees).
 * Supports full-body portraits, cropped/headless photos, and wide aspect ratios.
 */
export async function analyzePersonLandmarksWithGeminiVision(personBuffer, mimeType = 'image/jpeg') {
  const { apiKey, isConfigured } = getGeminiConfig();
  if (!isConfigured) {
    return null;
  }

  try {
    console.log('[Gemini Try-On AI] Analyzing person body landmarks with Gemini-3.5-flash-lite...');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
    const base64 = personBuffer.toString('base64');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this person photo and detect their exact anatomical body landmarks. Coordinates must be integers from 0 to 1000 (normalized to image dimensions).
Return ONLY a valid JSON object:
{
  "hasFullHeadAndFace": boolean,
  "hasHead": boolean,
  "headBottomY": number,
  "chinY": number,
  "collarboneY": number,
  "chestY": number,
  "shoulderLeftX": number,
  "shoulderRightX": number,
  "shoulderY": number,
  "waistY": number,
  "waistLeftX": number,
  "waistRightX": number,
  "hipY": number,
  "kneeY": number,
  "ankleY": number,
  "torsoBox": [ymin, xmin, ymax, xmax]
}`
            },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }]
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        let clean = rawText.trim();
        if (clean.includes('```json')) clean = clean.split('```json')[1].split('```')[0].trim();
        else if (clean.includes('```')) clean = clean.split('```')[1].split('```')[0].trim();
        const parsed = JSON.parse(clean);
        console.log(`[Gemini Try-On AI] Person landmarks detected: collarboneY=${parsed.collarboneY}, waistY=${parsed.waistY}, kneeY=${parsed.kneeY}, hasHead=${parsed.hasHead}, hasFullHeadAndFace=${parsed.hasFullHeadAndFace}`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Gemini Try-On AI] Person landmark detection notice:', err.message);
  }

  return null;
}

/**
 * Generates an accurate high-resolution binary mask for IDM-VTON diffusion inpainting.
 * White = replace region, Black = preserve (face, head, arms, feet, background).
 */
async function generateCategoryMask(category, garmentAnalysis = null, landmarks = null) {
  const scaleX = (val) => Math.round((val / 1000) * 768);
  const scaleY = (val) => Math.round((val / 1000) * 1024);

  let points = '';
  const isDress = category === 'dresses' || (garmentAnalysis && (garmentAnalysis.category === 'dresses' || garmentAnalysis.isSingleSkirt));

  const isFullBodyFrock =
    garmentAnalysis?.isFullBodyFrock ||
    garmentAnalysis?.length === 'full-length' ||
    garmentAnalysis?.length === 'maxi' ||
    garmentAnalysis?.length === 'midi' ||
    garmentAnalysis?.silhouette?.toLowerCase().includes('frock') ||
    (garmentAnalysis?.garmentType || '').toLowerCase().includes('frock') ||
    (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('frock') ||
    (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('gown') ||
    (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('maxi') ||
    (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('onepiece') ||
    (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('one-piece');

  // Detect whether the uploaded photo actually has a head and facial features
  const hasHead = (landmarks?.hasFullHeadAndFace === true || landmarks?.hasHead === true) && (landmarks?.headBottomY > 120 || landmarks?.chinY > 120);

  // Vertical anchors:
  // When photo has a head/face, the mask MUST stay strictly at/below the collarbone and hollow of neck to 100% preserve the face!
  // When photo is cropped/headless (like Girl.webp), mask starts near top (y=15..22) to remove old collar/shirt.
  const collarY = hasHead ? scaleY(landmarks.collarboneY || landmarks.headBottomY + 20) : 22;
  const shoulderY = hasHead ? Math.max(10, collarY - 15) : 65;
  const waistY = landmarks?.waistY ? scaleY(landmarks.waistY) : (hasHead ? 385 : 350);
  const sleeveBottomY = hasHead ? Math.round(collarY + (waistY - collarY) * 0.5) : 250;

  // For frocks, maxi gowns, and dresses, extend all the way down to floor/feet level (1018 out of 1024)
  // so previous pants/leggings are completely replaced with continuous skirt drapery
  const hemY = (isFullBodyFrock || garmentAnalysis?.length !== 'mini')
    ? 1018
    : (landmarks?.kneeY ? scaleY(landmarks.kneeY) + 40 : 780);
  const ankleY = landmarks?.ankleY ? scaleY(landmarks.ankleY) : 980;

  // Horizontal anchors:
  const shoulderLeftX = (hasHead && landmarks?.shoulderLeftX) ? scaleX(landmarks.shoulderLeftX) : 200;
  const shoulderRightX = (hasHead && landmarks?.shoulderRightX) ? scaleX(landmarks.shoulderRightX) : 735;
  const waistLeftX = (hasHead && landmarks?.waistLeftX) ? scaleX(landmarks.waistLeftX) : 260;
  const waistRightX = (hasHead && landmarks?.waistRightX) ? scaleX(landmarks.waistRightX) : 570;

  // Neckline points:
  const neckCenterX = Math.round((shoulderLeftX + shoulderRightX) / 2);
  const neckLeftX = Math.round(neckCenterX - (shoulderRightX - shoulderLeftX) * 0.16);
  const neckRightX = Math.round(neckCenterX + (shoulderRightX - shoulderLeftX) * 0.16);

  const sleevesLower = (garmentAnalysis?.sleeves || garmentAnalysis?.sleeveType || '').toLowerCase();
  const titleLower = (garmentAnalysis?.cleanTitle || garmentAnalysis?.garmentType || '').toLowerCase();
  const isSleeveless = garmentAnalysis?.isSleeveless ||
    garmentAnalysis?.sleeveType === 'sleeveless' ||
    garmentAnalysis?.sleeveType === 'strapless' ||
    sleevesLower.includes('sleeveless') ||
    sleevesLower.includes('strapless') ||
    sleevesLower.includes('tank') ||
    sleevesLower.includes('halter') ||
    sleevesLower.includes('spaghetti') ||
    sleevesLower.includes('slip') ||
    sleevesLower.includes('tube') ||
    sleevesLower.includes('no sleeve') ||
    sleevesLower.includes('bare arm') ||
    sleevesLower.includes('off-the-shoulder') ||
    sleevesLower.includes('off shoulder') ||
    sleevesLower.includes('off-shoulder') ||
    sleevesLower.includes('cap') ||
    titleLower.includes('sleeveless') ||
    titleLower.includes('strapless') ||
    titleLower.includes('off-the-shoulder') ||
    titleLower.includes('sundress');

  const isShortSleeve = !isSleeveless && (
    garmentAnalysis?.sleeveType === 'short' ||
    sleevesLower.includes('short')
  );

  if (isDress) {
    if (isSleeveless) {
      if (hasHead) {
        // Person with full head/face: preserve head & chin completely, envelope shoulders to erase white sleeves
        points = `${neckLeftX},${collarY - 5} ${neckCenterX},${collarY} ${neckRightX},${collarY + 5} ${shoulderRightX + 40},${shoulderY} ${shoulderRightX + 40},${sleeveBottomY} ${waistRightX},${waistY} 740,${hemY} 60,${hemY} ${waistLeftX},${waistY} ${shoulderLeftX - 40},${sleeveBottomY} ${shoulderLeftX - 40},${shoulderY}`;
      } else {
        // Headless / cropped portrait (e.g. Girl.webp): envelope full top and both white sleeves (x: 200..735, y: 65..250)
        // 1. Neckline hollow: (360,15 -> 440,22 -> 510,32)
        // 2. Right sleeve: (735,65 -> 735,250 -> 615,280) completely envelops right white sleeve
        // 3. Waist & skirt: (570,350 -> 740,hemY -> 60,hemY -> 260,350)
        // 4. Left sleeve: (270,250 -> 200,250 -> 200,65) completely envelops left white sleeve
        points = `360,15 440,22 510,32 735,65 735,250 615,280 570,310 570,350 740,${hemY} 60,${hemY} 260,350 270,250 200,250 200,65`;
      }
    } else if (isShortSleeve) {
      if (hasHead) {
        points = `${neckLeftX},${collarY - 5} ${neckCenterX},${collarY} ${neckRightX},${collarY + 5} ${shoulderRightX + 40},${shoulderY} ${shoulderRightX + 40},${sleeveBottomY + 30} ${waistRightX},${waistY} 740,${hemY} 60,${hemY} ${waistLeftX},${waistY} ${shoulderLeftX - 40},${sleeveBottomY + 30} ${shoulderLeftX - 40},${shoulderY}`;
      } else {
        points = `360,15 440,22 510,32 735,65 735,280 570,310 570,350 740,${hemY} 60,${hemY} 260,350 270,250 200,280 200,65`;
      }
    } else {
      // Full/Long sleeves: covers full arms down to wrists
      if (hasHead) {
        points = `${neckLeftX},${collarY - 5} ${neckCenterX},${collarY} ${neckRightX},${collarY + 5} ${shoulderRightX + 30},${shoulderY} ${shoulderRightX + 60},${waistY + 50} ${waistRightX},${waistY} 740,${hemY} 60,${hemY} ${waistLeftX},${waistY} ${shoulderLeftX - 60},${waistY + 50} ${shoulderLeftX - 30},${shoulderY}`;
      } else {
        points = `360,15 440,22 510,32 670,65 735,420 660,360 740,${hemY} 60,${hemY} 260,360 160,420 200,65`;
      }
    }
  } else if (category === 'bottoms') {
    points = `${waistLeftX - 20},${waistY} ${waistRightX + 90},${waistY} 680,${ankleY} 180,${ankleY}`;
  } else if (category === 'outerwear') {
    points = `${neckLeftX - 40},${shoulderY} ${neckRightX + 40},${shoulderY} ${shoulderRightX + 20},${waistY + 120} ${shoulderLeftX - 20},${waistY + 120}`;
  } else {
    // Tops
    if (isSleeveless) {
      if (hasHead) {
        points = `${neckLeftX},${collarY - 7} ${neckCenterX},${collarY} ${neckRightX},${collarY + 10} ${shoulderRightX},${shoulderY} ${shoulderRightX},${sleeveBottomY} ${waistRightX},${waistY} ${waistLeftX},${waistY} ${shoulderLeftX},${sleeveBottomY} ${shoulderLeftX},${shoulderY}`;
      } else {
        points = `420,15 510,15 675,35 735,240 560,270 560,${waistY} 270,${waistY} 270,270 200,240 200,35`;
      }
    } else if (isShortSleeve) {
      if (hasHead) {
        points = `${neckLeftX},${collarY - 7} ${neckCenterX},${collarY} ${neckRightX},${collarY + 10} ${shoulderRightX},${shoulderY} ${shoulderRightX},${waistY - 60} ${waistRightX},${waistY} ${waistLeftX},${waistY} ${shoulderLeftX},${waistY - 60} ${shoulderLeftX},${shoulderY}`;
      } else {
        points = `420,15 510,15 675,35 735,280 570,300 560,${waistY} 270,${waistY} 250,300 190,280 190,35`;
      }
    } else {
      if (hasHead) {
        points = `${neckLeftX},${collarY - 7} ${neckCenterX},${collarY} ${neckRightX},${collarY + 10} ${shoulderRightX},${shoulderY} ${shoulderRightX + 20},${waistY + 60} ${waistRightX},${waistY} ${waistLeftX},${waistY} ${shoulderLeftX - 30},${waistY + 60} ${shoulderLeftX},${shoulderY}`;
      } else {
        points = `420,15 510,15 675,35 720,400 660,${waistY} 260,${waistY} 160,400 190,35`;
      }
    }
  }

  const svg = `<svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="768" height="1024" fill="black" />
    <polygon points="${points}" fill="white" />
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Reads live Hugging Face token directly from disk .env to avoid stale in-memory cached envs
 */
function getLiveHfToken() {
  const candidateEnvPaths = [
    path.resolve('.env'),
    path.resolve('..', '.env'),
    path.resolve('My-Wardrobe', 'backend', '.env')
  ];
  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const text = fs.readFileSync(envPath, 'utf8');
        const match = text.match(/^\s*HF_TOKEN\s*=\s*(.+)$/m);
        if (match) {
          const tok = match[1].trim().replace(/^["']|["']$/g, '');
          if (tok.startsWith('hf_')) return tok;
        }
      } catch {}
    }
  }
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || undefined;
}

/**
 * Main AI Virtual Try-On Pipeline
 * 1. Uses state-of-the-art IDM-VTON diffusion model to realistically fit the garment on the human body,
 *    preserving facial features, hair, skin tone, posture, and synthesizing realistic fabric folds and lighting.
 * 2. If IDM-VTON is temporarily queued or offline, falls back to Gemini Multimodal + Imagen 3.
 */
export async function generateGeminiTryOn({
  personInput,
  garmentInput,
  category = 'tops',
  garmentDescription = '',
}) {
  const person = await resolveImagePayload(personInput);
  const garment = await resolveImagePayload(garmentInput, 'image/png');

  const outputId = `tryon_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  let finalBuffer = null;
  let methodUsed = 'idm_vton_diffusion_ai';
  let garmentAnalysisResult = null;
  let lastGpuError = '';

  // 1. Normalize person buffer to standard 768x1024 with fit: 'contain'
  // so head, face, and feet are NEVER cropped, regardless of upload aspect ratio
  const normalizedPersonBuf = await sharp(person.buffer)
    .resize(768, 1024, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toBuffer();

  // --- STEP 1: Vision Analysis & Real AI Virtual Try-On via IDM-VTON Diffusion Model ---
  try {
    const hfToken = getLiveHfToken();
    console.log(`[Virtual Try-On AI] Using live Hugging Face token: ${hfToken ? hfToken.slice(0, 10) + '...' : 'none'}`);

    // 1. Analyze garment visually with Gemini Vision
    const garmentAnalysis = await analyzeGarmentWithGeminiVision(garment.buffer, garment.mimeType);
    garmentAnalysisResult = garmentAnalysis;

    // 2. Analyze person body landmarks with Gemini Vision on the exact 768x1024 canvas
    const personLandmarks = await analyzePersonLandmarksWithGeminiVision(normalizedPersonBuf, 'image/png');

    const descLower = (garmentDescription || '').toLowerCase();
    const catLower = (category || '').toLowerCase();

    // Determine if garment is a dress or continuous skirt
    const isDress =
      (garmentAnalysis && (garmentAnalysis.category === 'dresses' || garmentAnalysis.isSingleSkirt)) ||
      catLower === 'dresses' ||
      catLower.includes('dress') ||
      catLower.includes('gown') ||
      catLower.includes('frock') ||
      descLower.includes('dress') ||
      descLower.includes('gown') ||
      descLower.includes('frock') ||
      descLower.includes('sundress') ||
      descLower.includes('saree') ||
      descLower.includes('one-piece') ||
      descLower.includes('onepiece');

    const isBottom =
      (garmentAnalysis && garmentAnalysis.category === 'bottoms') ||
      catLower === 'bottoms' ||
      catLower.includes('pant') ||
      catLower.includes('trouser') ||
      catLower.includes('jean') ||
      catLower.includes('skirt') ||
      catLower.includes('shorts') ||
      descLower.includes('pant') ||
      descLower.includes('trouser') ||
      descLower.includes('jean') ||
      descLower.includes('skirt') ||
      descLower.includes('shorts');

    const effectiveCategory = isDress ? 'dresses' : isBottom ? 'bottoms' : 'tops';

    const isFullBodyFrock =
      garmentAnalysis?.isFullBodyFrock ||
      garmentAnalysis?.length === 'full-length' ||
      garmentAnalysis?.length === 'maxi' ||
      garmentAnalysis?.length === 'midi' ||
      garmentAnalysis?.silhouette?.toLowerCase().includes('frock') ||
      (garmentAnalysis?.garmentType || '').toLowerCase().includes('frock') ||
      (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('frock') ||
      (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('gown') ||
      (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('maxi') ||
      (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('onepiece') ||
      (garmentAnalysis?.cleanTitle || '').toLowerCase().includes('one-piece') ||
      descLower.includes('frock') ||
      descLower.includes('gown') ||
      descLower.includes('maxi') ||
      descLower.includes('onepiece') ||
      descLower.includes('one-piece') ||
      descLower.includes('full');

    const hasHead = (personLandmarks?.hasFullHeadAndFace === true || personLandmarks?.hasHead === true) &&
      (personLandmarks?.headBottomY > 120 || personLandmarks?.chinY > 120);

    let personBufferToUse = normalizedPersonBuf;
    let layers = [];
    let isCheckedAutoMask = false;
    let promptText = '';

    if (isDress) {
      const sleevesLower = (garmentAnalysis?.sleeves || garmentAnalysis?.sleeveType || '').toLowerCase();
      const titleLower = (garmentAnalysis?.cleanTitle || garmentAnalysis?.garmentType || '').toLowerCase();
      const isSleeveless = garmentAnalysis?.isSleeveless ||
        garmentAnalysis?.sleeveType === 'sleeveless' ||
        garmentAnalysis?.sleeveType === 'strapless' ||
        sleevesLower.includes('sleeveless') ||
        sleevesLower.includes('strapless') ||
        sleevesLower.includes('tank') ||
        sleevesLower.includes('halter') ||
        sleevesLower.includes('spaghetti') ||
        sleevesLower.includes('slip') ||
        sleevesLower.includes('tube') ||
        sleevesLower.includes('no sleeve') ||
        sleevesLower.includes('bare arm') ||
        sleevesLower.includes('off-the-shoulder') ||
        sleevesLower.includes('off shoulder') ||
        sleevesLower.includes('off-shoulder') ||
        sleevesLower.includes('cap') ||
        titleLower.includes('sleeveless') ||
        titleLower.includes('strapless') ||
        titleLower.includes('off-the-shoulder') ||
        titleLower.includes('sundress');

      const isShortSleeve = !isSleeveless && (
        garmentAnalysis?.sleeveType === 'short' ||
        sleevesLower.includes('short')
      );

      const isLongSleeve = !isSleeveless && !isShortSleeve && (
        garmentAnalysis?.hasLongSleeves ||
        garmentAnalysis?.sleeveType === 'long' ||
        sleevesLower.includes('long') ||
        sleevesLower.includes('full')
      );

      const colorDesc = garmentAnalysis?.color || 'elegant';
      const patternDesc = garmentAnalysis?.pattern && !garmentAnalysis.pattern.includes('solid') ? `${garmentAnalysis.pattern} ` : '';
      const fabricDesc = garmentAnalysis?.fabric ? `${garmentAnalysis.fabric} ` : '';
      const lengthDesc = (isFullBodyFrock || garmentAnalysis?.length !== 'mini') ? 'full-body floor-length ' : (garmentAnalysis?.length ? `${garmentAnalysis.length} ` : '');
      const necklineDesc = garmentAnalysis?.neckline ? `${garmentAnalysis.neckline} neckline, ` : '';
      const flarePrompt = garmentAnalysis?.flare || garmentAnalysis?.silhouette || 'flared A-line frock';
      const designAccents = garmentAnalysis?.designDetails ? `${garmentAnalysis.designDetails}, ` : '';

      let sleevePrompt = '';
      if (isSleeveless) {
        sleevePrompt = 'completely SLEEVELESS dress with bare arms, bare shoulders, exposed bare arms, natural bare skin on arms, no sleeves on arms, no white sleeves, no shirt underneath, no t-shirt visible, natural skin on shoulders and arms, sleeveless fitted bodice';

        // Pre-composite skin tone over original white sleeves on headless model so DensePose sees 100% bare arms
        if (!hasHead) {
          const skinOverlaySvg = `<svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <polygon points="310,55 380,55 375,185 310,185" fill="#D8ACA0" />
            <polygon points="520,55 645,55 640,195 520,195" fill="#D8ACA0" />
          </svg>`;
          const skinOverlayBuf = await sharp(Buffer.from(skinOverlaySvg)).png().toBuffer();
          personBufferToUse = await sharp(normalizedPersonBuf)
            .composite([{ input: skinOverlayBuf, blend: 'over' }])
            .png()
            .toBuffer();
        }
      } else if (isShortSleeve) {
        sleevePrompt = `${garmentAnalysis?.sleeves || 'short sleeves'}, exposed forearms, no long sleeves`;
      } else if (isLongSleeve) {
        sleevePrompt = `${garmentAnalysis?.sleeves || 'long full sleeves extending to wrists'}`;
      } else {
        sleevePrompt = garmentAnalysis?.sleeves ? `${garmentAnalysis.sleeves}` : '';
      }

      promptText = `Front view facing camera, front-facing studio portrait of a woman facing forward toward the camera, chest facing front, wearing a ${lengthDesc}elegant ${colorDesc} ${patternDesc}${fabricDesc}${flarePrompt} gown, ${sleevePrompt}, ${necklineDesc}${designAccents}flowing floor-length continuous wide flared skirt hem cascading down to the floor, completely covering lower body and legs, no pants, no black leggings, no jeans, original hairstyle behind shoulders, clear chest, clean bare neckline, natural bare arms, clean white studio background, realistic fabric folds and drapes, professional studio photography, high resolution`;
      console.log(`[Virtual Try-On AI] Using landmark-tailored full-body dress mask for: "${promptText}"`);
    } else if (isBottom) {
      const title = garmentAnalysis?.cleanTitle || (garmentDescription ? garmentDescription.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]/g, ' ') : 'pants');
      promptText = `A pair of stylish ${title}, full length, realistic fabric folds, seamless fit`;
      console.log(`[Virtual Try-On AI] Using landmark-tailored pants mask for: "${title}"`);
    } else {
      const title = garmentAnalysis?.cleanTitle || (garmentDescription ? garmentDescription.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[-_]/g, ' ') : 'top');
      promptText = `${title}, realistic fit`;
      console.log(`[Virtual Try-On AI] Using landmark-tailored top mask for: "${title}"`);
    }

    // Generate landmark-tailored SVG mask
    const maskBuf = await generateCategoryMask(effectiveCategory, garmentAnalysis, personLandmarks);
    layers = [new Blob([maskBuf], { type: 'image/png' })];

    const personBlob = new Blob([personBufferToUse], { type: 'image/png' });
    const garmentBlob = new Blob([garment.buffer], { type: garment.mimeType });

    console.log(`[Virtual Try-On AI] Synthesizing realistic try-on image for: "${promptText}"...`);

    // Resilient try across available IDM-VTON spaces
    const spaceCandidates = ['yisol/IDM-VTON', 'Nymbo/Virtual-Try-On'];
    let result = null;

    for (const space of spaceCandidates) {
      try {
        console.log(`[Virtual Try-On AI] Attempting synthesis with ${space}...`);
        const app = await Client.connect(space, hfToken ? { token: hfToken } : {});
        result = await app.predict('/tryon', [
          { background: personBlob, layers, composite: null },
          garmentBlob,
          promptText,
          isCheckedAutoMask,
          false, // is_checked_crop
          28, // denoise_steps
          42 // seed
        ]);
        if (result && result.data && Array.isArray(result.data) && result.data[0] && result.data[0].url) {
          console.log(`[Virtual Try-On AI] Success from ${space}!`);
          break;
        }
      } catch (spaceErr) {
        const msg = spaceErr.message || '';
        if (msg.includes('ZeroGPU') || msg.includes('quota') || msg.includes('exceeded') || !lastGpuError) {
          lastGpuError = msg;
        }
        console.warn(`[Virtual Try-On AI] ${space} notice:`, spaceErr.message);
      }
    }

    if (result && result.data && Array.isArray(result.data) && result.data[0] && result.data[0].url) {
      const outputUrl = result.data[0].url;
      console.log(`[Virtual Try-On AI] Photorealistic synthesis completed! Downloading: ${outputUrl}`);
      const imgRes = await fetch(outputUrl);
      if (imgRes.ok) {
        const arr = await imgRes.arrayBuffer();
        finalBuffer = Buffer.from(arr);
        methodUsed = 'idm_vton_diffusion_ai';
        console.log(`[Virtual Try-On AI] Successfully generated real virtual try-on image (${finalBuffer.length} bytes)!`);
      }
    }
  } catch (err) {
    console.warn('[Virtual Try-On AI] IDM-VTON notice:', err.message);
  }

  // --- STEP 2: Secondary Cloud AI Fallback (Google Gemini + Imagen) ---
  if (!finalBuffer) {
    const { apiKey, isConfigured } = getGeminiConfig();
    if (isConfigured) {
      try {
        console.log('[Virtual Try-On AI] Attempting Gemini Multimodal + Imagen synthesis...');
        const candidateModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image', 'imagen-3.0-generate-002'];
        for (const model of candidateModels) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: `Photorealistic high-fashion full-body portrait of this person wearing this ${category} garment. Fit the garment naturally with realistic fabric drapes, shadows, and body curvature while preserving their exact face, hair, and posture.` },
                    { inline_data: { mime_type: person.mimeType, data: person.base64 } },
                    { inline_data: { mime_type: garment.mimeType, data: garment.base64 } }
                  ]
                }]
              })
            });
            if (res.ok) {
              const data = await res.json();
              const b64 = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data)?.inline_data?.data;
              if (b64) {
                finalBuffer = Buffer.from(b64, 'base64');
                methodUsed = 'gemini_image_generation';
                break;
              }
            }
          } catch (gemErr) {
            console.warn(`[Virtual Try-On AI] Notice with ${model}:`, gemErr.message);
          }
        }
      } catch (geminiErr) {
        console.warn('[Virtual Try-On AI] Gemini fallback notice:', geminiErr.message);
      }
    }
  }

  if (!finalBuffer) {
    if (lastGpuError && (lastGpuError.includes('ZeroGPU') || lastGpuError.includes('quota') || lastGpuError.includes('exceeded'))) {
      throw new Error(`Hugging Face ZeroGPU daily quota notice: ${lastGpuError}`);
    }
    throw new Error('AI virtual try-on models are currently busy or unavailable. Please wait a moment and try again.');
  }

  const finalFilename = `${outputId}.png`;
  const finalPath = path.join(TRYON_UPLOAD_DIR, finalFilename);
  fs.writeFileSync(finalPath, finalBuffer);

  return {
    success: true,
    resultUrl: `/uploads/tryon/${finalFilename}`,
    method: methodUsed,
    garmentAnalysis: garmentAnalysisResult,
    timestamp: new Date().toISOString(),
  };
}

export default {
  generateGeminiTryOn,
};
