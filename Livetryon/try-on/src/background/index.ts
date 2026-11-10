import { setFastMode, getFastMode } from "../store/key"
import { mintClientToken, MintError } from "./mint-token"

export {} // background entrypoint

function getSafeExtensionUrl(path: string): string {
  const url = chrome.runtime.getURL(path)
  return url.replace(/^extension:\/\//, "chrome-extension://")
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: getSafeExtensionUrl("tabs/onboarding.html") })
  }
  chrome.contextMenus.create({
    id: "try-on-anywear",
    title: "Try this on me",
    contexts: ["image"]
  })
})

chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === "try-on-anywear" && info.srcUrl) {
    try {
      await chrome.storage.local.set({
        pendingGarment: {
          imageUrl: info.srcUrl,
          name: "Web Garment",
          category: "top"
        }
      })
      chrome.tabs.create({ url: getSafeExtensionUrl("tabs/room.html") })
    } catch {
      chrome.tabs.create({ url: getSafeExtensionUrl("tabs/room.html") })
    }
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case "TRY_ON_GARMENT_FROM_PAGE": {
      ;(async () => {
        try {
          if (msg.garment) {
            await chrome.storage.local.set({ pendingGarment: msg.garment })
          }
          chrome.tabs.create({ url: getSafeExtensionUrl("tabs/room.html") })
          sendResponse({ ok: true })
        } catch (e) {
          chrome.tabs.create({ url: getSafeExtensionUrl("tabs/room.html") })
          sendResponse({ ok: true })
        }
      })()
      return true
    }
    case "MINT_TOKEN": {
      ;(async () => {
        try {
          const apiKey = await mintClientToken(msg.expiresIn ?? 60)
          sendResponse({ ok: true, apiKey })
        } catch (e) {
          if (e instanceof MintError) {
            sendResponse({ ok: false, code: e.code, error: e.message })
          } else {
            sendResponse({ ok: false, code: "MINT_FAILED", error: String(e) })
          }
        }
      })()
      return true // keep the channel open for the async sendResponse
    }
    case "SET_FAST_MODE": {
      ;(async () => {
        await setFastMode(Boolean(msg.value))
        sendResponse({ ok: true, value: await getFastMode() })
      })()
      return true
    }
    default:
      sendResponse({ ok: false, code: "UNKNOWN_MESSAGE" })
      return false
  }
})
