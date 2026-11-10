import { getApiKey } from "../store/key"

const TOKEN_URL = "https://api.decart.ai/v1/client/tokens"

/** Room (realtime) + Process (garment extraction) — api keyProvider feeds BOTH, so the token must allow both. */
const ALLOWED_MODELS = ["lucy-vton-latest", "lucy-image-2"]

export class MintError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Mints a short-lived client token (default 60s) with the user's permanent key.
 * Works from the MV3 service worker — it's just an authenticated HTTP call;
 * the permanent key never leaves this worker (and chrome.storage.local).
 */
export async function mintClientToken(
  expiresIn = 60,
  allowedModels: string[] = ALLOWED_MODELS
): Promise<string> {
  const key = await getApiKey()
  if (!key) {
    throw new MintError("NO_KEY", "No Decart key stored yet")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn, allowedModels })
  })

  if (res.status === 401 || res.status === 403) {
    throw new MintError("INVALID_API_KEY", "Decart rejected the stored API key")
  }
  if (!res.ok) {
    throw new MintError("MINT_FAILED", `Token endpoint returned ${res.status}`)
  }

  const data = (await res.json()) as { apiKey?: string }
  if (!data.apiKey) {
    throw new MintError("MINT_FAILED", "Token response had no apiKey")
  }
  return data.apiKey
}
