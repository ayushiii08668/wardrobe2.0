import { createDecartClient } from "@decartai/sdk"

/**
 * One client per page. It holds no credential of its own: every connect and
 * reconnect first calls the background service worker, which mints a fresh
 * short-lived client token with the user's permanent key. The permanent key
 * never reaches a page context.
 */
export const decartClient = createDecartClient({
  apiKeyProvider: async () => {
    const res = await chrome.runtime.sendMessage({ type: "MINT_TOKEN" })
    if (!res || res.ok === false) {
      const err = new Error(res?.error ?? "Couldn't mint a Decart client token") as Error & {
        code?: string
      }
      err.code = res?.code ?? "MINT_FAILED"
      throw err
    }
    return res.apiKey as string
  }
})
