import { useState, type ReactNode } from "react"
import { decartClient } from "../core/decart/client"
import { Button, Card, Spinner } from "../components/ui"
import { clearApiKey, saveApiKey } from "../store/key"
import "../style.css"

type KeyState = "pristine" | "checking" | "saved" | "rejected"

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-hairline pb-4 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {n}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function Onboarding() {
  const [keyState, setKeyState] = useState<KeyState>("pristine")
  const [keyDetail, setKeyDetail] = useState<string>("")
  const [keyInput, setKeyInput] = useState<string>("")
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null)
  const [network, setNetwork] = useState<{
    quality: string
    transport: string
  } | null>(null)
  const [netBusy, setNetBusy] = useState(false)

  const validateKey = async () => {
    const key = keyInput.trim()
    setKeyState("checking")
    // Validation = store the key, then mint a real test token with it.
    await saveApiKey(key)
    const res = await chrome.runtime.sendMessage({ type: "MINT_TOKEN" })
    if (res?.ok) {
      setKeyState("saved")
      setKeyDetail("Validated & saved — a live test token was minted")
    } else {
      await clearApiKey() // don't keep a bad key
      setKeyState("rejected")
      setKeyDetail(
        res?.code === "INVALID_API_KEY"
          ? "Key rejected by Decart — check it again"
          : (res?.error ?? "Couldn't reach Decart")
      )
    }
  }

  const grantCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((t) => t.stop())
      setCameraGranted(true)
    } catch {
      setCameraGranted(false)
    }
  }

  const checkNetwork = async () => {
    setNetBusy(true)
    try {
      const { quality, metrics } =
        await decartClient.realtime.checkConnectivity()
      setNetwork({ quality, transport: metrics?.transport ?? "unknown" })
    } catch {
      setNetwork({ quality: "unknown", transport: "failed" })
    } finally {
      setNetBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex w-full max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-bold">Try-On · Anywear — setup</h1>
        <p className="text-xs text-muted">
          One-time, ~1 minute. Unlike other try-on extensions there is no queue,
          no VIP pass and no passes left — only your own Decart key and free
          credits.
        </p>

        <Step n={1} title="Decart API key">
          <input
            type="password"
            placeholder="dct_…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="w-full rounded-full border border-hairline bg-canvas px-3.5 py-2 text-sm outline-none focus:border-primary/50"
          />
          {keyState === "checking" && <Spinner label="Minting a test token…" />}
          {keyState === "saved" && (
            <p className="text-xs font-medium text-[#1d8f66]">{keyDetail}</p>
          )}
          {keyState === "rejected" && (
            <p className="text-xs font-medium text-[#c0504d]">{keyDetail}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={validateKey} disabled={!keyInput || keyState === "checking"}>
              Validate &amp; save
            </Button>
          </div>
          <p className="text-[10px] text-muted">
            Stored in chrome.storage.local. Never exposed to web pages — only
            60-second tokens, minted in the extension's background worker, are
            handed to Decart.
          </p>
        </Step>

        <Step n={2} title="Camera permission">
          <p className="text-xs text-muted">
            Once here, in the extension's own origin — no per-site prompts later.
          </p>
          <Button
            variant={cameraGranted ? "success" : "ghost"}
            onClick={grantCamera}>
            {cameraGranted ? "Camera allowed ✓" : "Allow camera"}
          </Button>
          {cameraGranted === false && (
            <p className="text-xs font-medium text-[#c0504d]">
              Blocked — allow access from the address-bar icon and retry.
            </p>
          )}
        </Step>

        <Step n={3} title="Network check">
          <p className="text-xs text-muted">
            Blocked UDP (7882/3478) is the top cause of a session that connects
            but the video freezes.
          </p>
          <Button variant="ghost" onClick={checkNetwork} disabled={netBusy}>
            Run check
          </Button>
          {netBusy && <Spinner label="Probing…" />}
          {network && (
            <p
              className={`text-xs font-medium ${
                network.quality === "critical" ? "text-[#c0504d]" : "text-[#1d8f66]"
              }`}>
              {network.quality === "critical"
                ? `Network is restricted (transport: ${network.transport}) — try disabling firewall/VPN for the session.`
                : `Looks good (quality: ${network.quality}, transport: ${network.transport})`}
            </p>
          )}
        </Step>

        <Button
          onClick={() => window.close()}
          disabled={keyState !== "saved" || !cameraGranted}>
          Done — try something on
        </Button>
      </Card>
    </main>
  )
}

