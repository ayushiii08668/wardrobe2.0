import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["http://localhost:*/*", "http://127.0.0.1:*/*", "https://*/*"]
}

// Extension availability handshake
window.addEventListener("WARDROBEWISE_PING_EXTENSION", () => {
  window.dispatchEvent(new CustomEvent("WARDROBEWISE_EXTENSION_READY", { detail: { ready: true } }))
})

// Dispatch ready on load
try {
  window.dispatchEvent(new CustomEvent("WARDROBEWISE_EXTENSION_READY", { detail: { ready: true } }))
} catch {}

// Listen for try-on requests dispatched by WardrobeWise
window.addEventListener("WARDROBEWISE_LIVE_TRYON", (event: any) => {
  const garment = event?.detail
  if (garment && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: "TRY_ON_GARMENT_FROM_PAGE",
      garment
    })
  }
})

// Listen for postMessage as fallback
window.addEventListener("message", (event) => {
  if (event.data?.type === "WARDROBEWISE_LIVE_TRYON" && event.data?.payload) {
    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "TRY_ON_GARMENT_FROM_PAGE",
        garment: event.data.payload
      })
    }
  }
})

