// ============================================================================
// API SERVICE LAYER — Connects frontend to Express backend
// ============================================================================
// All backend endpoints are proxied through Vite dev server to avoid CORS.
// In production, both are served from the same origin.

const API_BASE = '/api';

// ── Token Management ────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('wardrobewise_token');
}

function setToken(token) {
  localStorage.setItem('wardrobewise_token', token);
}

function removeToken() {
  localStorage.removeItem('wardrobewise_token');
}

function getUser() {
  const data = localStorage.getItem('wardrobewise_user');
  return data ? JSON.parse(data) : null;
}

function setUser(user) {
  localStorage.setItem('wardrobewise_user', JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem('wardrobewise_user');
}

// ── Base Fetch with Auth ────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response' }));

  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ── Auth API ────────────────────────────────────────────────────────────────
export async function registerUser(name, email, password) {
  const result = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (result.success && result.data) {
    setToken(result.data.token);
    setUser(result.data.user);
  }
  return result;
}

export async function loginUser(email, password) {
  const result = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (result.success && result.data) {
    setToken(result.data.token);
    setUser(result.data.user);
  }
  return result;
}

export function logoutUser() {
  removeToken();
  removeUser();
}

export function isLoggedIn() {
  return !!getToken();
}

export function getCurrentUser() {
  return getUser();
}

// ── User Profile API ────────────────────────────────────────────────────────
export async function getUserProfile() {
  return apiFetch('/users/profile');
}

export async function updateUserProfile(updates) {
  return apiFetch('/users/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ── Clothing Items API ──────────────────────────────────────────────────────
export async function getClothingItems(params = {}) {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.favorite !== undefined) query.set('favorite', params.favorite);
  
  const qs = query.toString();
  return apiFetch(`/clothes${qs ? '?' + qs : ''}`);
}

export async function getClothingItemById(id) {
  return apiFetch(`/clothes/${id}`);
}

export async function addClothingItem(itemData) {
  return apiFetch('/clothes', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
}

export async function updateClothingItem(id, updates) {
  return apiFetch(`/clothes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteClothingItem(id) {
  return apiFetch(`/clothes/${id}`, { method: 'DELETE' });
}

export async function toggleFavorite(id) {
  return apiFetch(`/clothes/${id}/favorite`, { method: 'PATCH' });
}

// ── Image Upload API ────────────────────────────────────────────────────────
export async function uploadClothingImage(id, file) {
  const formData = new FormData();
  formData.append('image', file);
  return apiFetch(`/clothes/${id}/image`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteClothingImage(id) {
  return apiFetch(`/clothes/${id}/image`, { method: 'DELETE' });
}

// ── AI Analysis API ─────────────────────────────────────────────────────────
export async function analyzeClothingItem(id) {
  return apiFetch(`/clothes/${id}/analyze`, { method: 'POST' });
}

export async function reanalyzeClothingItem(id) {
  return apiFetch(`/clothes/${id}/reanalyze`, { method: 'POST' });
}

export async function getClothingAnalysis(id) {
  return apiFetch(`/clothes/${id}/analysis`);
}

// ── Outfit API ──────────────────────────────────────────────────────────────
export async function createOutfit(outfitData) {
  return apiFetch('/outfits', {
    method: 'POST',
    body: JSON.stringify(outfitData),
  });
}

export async function getOutfits() {
  return apiFetch('/outfits');
}

export async function deleteOutfit(id) {
  return apiFetch(`/outfits/${id}`, { method: 'DELETE' });
}

// ── AI Recommendation API ───────────────────────────────────────────────────
export async function getOutfitRecommendations(preferences = {}) {
  return apiFetch('/recommendations/outfits', {
    method: 'POST',
    body: JSON.stringify(preferences),
  });
}

export async function getRAGOutfitRecommendations({ query = '', preferences = {} }) {
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/recommendations/rag-outfits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ query, ...preferences })
    });
    if (!res.ok) throw new Error(`RAG API returned status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('RAG API error:', err);
    throw err;
  }
}

export async function searchClothingByImage(fileOrFormData) {
  try {
    const token = getToken();
    let body = fileOrFormData;
    if (fileOrFormData instanceof File) {
      body = new FormData();
      body.append('image', fileOrFormData);
    }
    const res = await fetch(`${API_BASE}/recommendations/search-by-image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body
    });
    if (!res.ok) throw new Error(`Visual search API returned status ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Visual search error:', err);
    throw err;
  }
}

// ── Health Check ────────────────────────────────────────────────────────────
export async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Groq AI Direct Analysis (for GroqAIPanel — no auth required demo) ─────
export async function analyzeWithGroqDirect(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  // Try the backend proxy first, fallback to Python AI service 
  try {
    const res = await fetch(`${API_BASE}/clothes/demo-analyze`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) return res.json();
  } catch {
    // ignore and try fallback
  }
  
  // Fallback to Python AI service directly
  const res = await fetch('http://localhost:8000/api/ai/analyze-clothing', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Analysis failed (HTTP ${res.status})`);
  return res.json();
}

export async function getGroqRecommendations(wardrobe, options) {
  // Try backend first
  try {
    const res = await fetch(`${API_BASE}/clothes/demo-recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wardrobe, options }),
    });
    if (res.ok) return res.json();
  } catch {
    // ignore and try fallback
  }
  
  // Fallback to Python AI service
  const res = await fetch('http://localhost:8000/api/ai/recommend-outfits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'recommend', wardrobe, options }),
  });
  if (!res.ok) throw new Error(`Recommendation failed (HTTP ${res.status})`);
  return res.json();
}

export default {
  registerUser,
  loginUser,
  logoutUser,
  isLoggedIn,
  getCurrentUser,
  getUserProfile,
  updateUserProfile,
  getClothingItems,
  getClothingItemById,
  addClothingItem,
  updateClothingItem,
  deleteClothingItem,
  toggleFavorite,
  uploadClothingImage,
  deleteClothingImage,
  analyzeClothingItem,
  reanalyzeClothingItem,
  getClothingAnalysis,
  createOutfit,
  getOutfits,
  deleteOutfit,
  getOutfitRecommendations,
  healthCheck,
  analyzeWithGroqDirect,
  getGroqRecommendations,
};
