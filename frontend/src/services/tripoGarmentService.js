/**
 * tripoGarmentService.js
 * Frontend client for:
 * 1. Garment Extraction & Background/Person Removal (OpenCV GrabCut + Skin Subtraction)
 * 2. Fashion Intelligence (Google Gemini Multimodal AI)
 * 3. 3D Model Synthesis & Avatar Fitting
 */

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000') + '/api';

/**
 * Checks AI 3D garment generation configuration status on the backend
 */
export async function getTripoApiConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/garments/config`);
    if (!res.ok) return { isConfigured: false, instructions: '' };
    const json = await res.json();
    return json.data || { isConfigured: false, instructions: '' };
  } catch (err) {
    console.warn('[tripoGarmentService] Could not reach garment config endpoint:', err.message);
    return { isConfigured: false, instructions: '' };
  }
}

/**
 * Extracts ONLY the clothing garment from an uploaded photo,
 * completely stripping background and the human person.
 *
 * @param {File|Blob|string} imageSource
 * @returns {Promise<object>} { extractedImageUrl, maskUrl, geminiAnalysis, width, height, garmentCoverage }
 */
export async function extractGarmentOnly(imageSource) {
  let response;

  if (imageSource instanceof File || imageSource instanceof Blob) {
    const formData = new FormData();
    formData.append('image', imageSource, imageSource.name || 'garment.png');

    response = await fetch(`${API_BASE_URL}/garments/extract`, {
      method: 'POST',
      body: formData,
    });
  } else {
    response = await fetch(`${API_BASE_URL}/garments/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalImageUrl: imageSource }),
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Garment extraction failed (HTTP ${response.status}): ${errText}`);
  }

  const json = await response.json();
  if (!json.success || !json.data?.extractedImageUrl) {
    throw new Error(json.message || 'Server did not return extracted garment');
  }

  return json.data;
}

/**
 * Initiates 2D-to-3D garment generation on the backend
 * @param {File|Blob|string} imageSource - File object or image URL
 * @param {object} metadata - { category, name, clothingItemId, color, extractedImageUrl, maskUrl }
 */
export async function start3DGarmentGeneration(imageSource, metadata = {}) {
  let response;

  if (imageSource instanceof File || imageSource instanceof Blob) {
    const formData = new FormData();
    formData.append('image', imageSource);
    if (metadata.category) formData.append('category', metadata.category);
    if (metadata.clothingItemId) formData.append('clothingItemId', metadata.clothingItemId);
    if (metadata.name) formData.append('name', metadata.name);
    if (metadata.extractedImageUrl) formData.append('extractedImageUrl', metadata.extractedImageUrl);
    if (metadata.maskUrl) formData.append('maskUrl', metadata.maskUrl);

    response = await fetch(`${API_BASE_URL}/garments/generate-3d`, {
      method: 'POST',
      body: formData,
    });
  } else {
    response = await fetch(`${API_BASE_URL}/garments/generate-3d`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originalImageUrl: typeof imageSource === 'string' ? imageSource : '',
        extractedImageUrl: metadata.extractedImageUrl || '',
        maskUrl: metadata.maskUrl || '',
        category: metadata.category || 'dress',
        clothingItemId: metadata.clothingItemId || null,
        name: metadata.name || '',
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initiate 3D garment generation (HTTP ${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (!json.success || !json.data?.taskId) {
    throw new Error(json.message || 'Server did not return a valid task ID');
  }

  return json.data;
}

/**
 * Polls 3D generation task until complete, invoking onProgress callback
 */
export async function pollGarmentGenerationTask(
  taskId,
  onProgress = null,
  maxAttempts = 60,
  intervalMs = 1500,
  initialData = null
) {
  if (initialData && initialData.status === 'success') {
    if (typeof onProgress === 'function') {
      onProgress({
        progress: 100,
        status: 'success',
        modelUrl: initialData.modelUrl,
      });
    }
    return {
      success: true,
      taskId: initialData.taskId,
      modelUrl: initialData.modelUrl,
      extractedImageUrl: initialData.extractedImageUrl,
      maskUrl: initialData.maskUrl,
      renderedImageUrl: initialData.renderedImageUrl,
      silhouette: initialData.silhouette || 'custom',
      geminiAnalysis: initialData.geminiAnalysis,
      isSimulated: false,
    };
  }

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(`${API_BASE_URL}/garments/tasks/${taskId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} when checking task status`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Failed to retrieve task data');
      }

      const task = json.data;
      if (typeof onProgress === 'function') {
        onProgress({
          progress: task.progress || 0,
          status: task.status || 'running',
          modelUrl: task.modelUrl,
        });
      }

      if (task.status === 'success') {
        return {
          success: true,
          taskId: task.taskId,
          modelUrl: task.modelUrl,
          extractedImageUrl: task.extractedImageUrl,
          maskUrl: task.maskUrl,
          renderedImageUrl: task.renderedImageUrl,
          silhouette: task.silhouette || 'custom',
          geminiAnalysis: task.geminiAnalysis,
          isSimulated: task.isSimulated || false,
        };
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        throw new Error(task.errorMessage || '3D garment generation failed or was cancelled');
      }
    } catch (pollErr) {
      console.warn(`[tripoGarmentService] Polling attempt ${attempts} warning:`, pollErr.message);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('3D garment generation timed out after 2 minutes.');
}
