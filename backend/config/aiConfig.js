/**
 * AI Service Configuration
 * Centralizes endpoint URLs, timeouts, fallback policies, and Groq API settings.
 */
export const aiConfig = {
  // ── Groq AI (Primary — Highest Accuracy) ──────────────────────────────────
  groqApiKey:       process.env.GROQ_API_KEY || null,
  groqEnabled:      Boolean(process.env.GROQ_API_KEY),

  // ── OpenCV Python Vision Service (Fallback) ──────────────────────────────
  serviceUrl:       process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  timeoutMs:        parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) || 10000,
  mockFallback:     process.env.AI_MOCK_FALLBACK !== 'false',
  recognitionEndpoint: '/api/ai/analyze-clothing',

  // ── Rule-based JS Recommendation Service (Fallback) ──────────────────────
  recommendationServiceUrl:
    process.env.AI_RECOMMENDATION_SERVICE_URL ||
    process.env.AI_SERVICE_URL ||
    'http://127.0.0.1:8000',
  recommendationEndpoint:
    process.env.AI_RECOMMENDATION_ENDPOINT || '/recommend/outfits',
  recommendationTimeoutMs:
    parseInt(process.env.AI_RECOMMENDATION_TIMEOUT_MS, 10) ||
    parseInt(process.env.AI_SERVICE_TIMEOUT_MS, 10) ||
    10000,
  recommendationMockFallback:
    process.env.AI_RECOMMENDATION_MOCK_FALLBACK !== undefined
      ? process.env.AI_RECOMMENDATION_MOCK_FALLBACK !== 'false'
      : process.env.AI_MOCK_FALLBACK !== 'false',
};

export default aiConfig;
