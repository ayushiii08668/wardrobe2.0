import { useEffect, useState } from "react"
import { Button, Chip } from "./components/ui"
import { getApiKey } from "./store/key"
import "./style.css"

export default function Popup() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      const key = await getApiKey()
      setHasKey(Boolean(key))
    })()
  }, [])

  const openRoom = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/room.html") })
    window.close()
  }

  const openSidePanel = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id })
      }
    } catch {
      // fallback to full tab if side panel not supported on page
      openRoom()
    }
    window.close()
  }

  const openSetup = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/onboarding.html") })
    window.close()
  }

  return (
    <div className="w-[320px] p-4 bg-canvas text-ink font-sans">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold">Try-On Anywear</span>
        <Chip tone={hasKey ? "live" : "warn"}>
          {hasKey === null ? "..." : hasKey ? "Ready" : "Setup needed"}
        </Chip>
      </div>

      <p className="text-xs text-muted mb-4">
        Real-time virtual try-on room for shopping sites powered by Decart AI.
      </p>

      <div className="flex flex-col gap-2.5">
        <Button variant="primary" onClick={openRoom} className="w-full">
          Open Try-On Room (Full Tab)
        </Button>

        <Button variant="ghost" onClick={openSidePanel} className="w-full">
          Open Side Panel
        </Button>

        <Button variant="ghost" onClick={openSetup} className="w-full">
          {hasKey ? "API Key & Setup" : "Add Decart API Key"}
        </Button>
      </div>

      <div className="mt-4 pt-3 border-t border-hairline flex items-center justify-between text-[11px] text-muted">
        <span>Decart lucy-vton-latest</span>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="hover:underline">
          Settings
        </button>
      </div>
    </div>
  )
}
