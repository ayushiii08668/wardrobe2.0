import { useCallback, useEffect, useRef, useState } from "react"
import { models } from "@decartai/sdk"
import { cameraConstraints, startSession, stopSession, swapGarment, type RealtimeHandle } from "../../core/decart/session"
import { decartClient } from "../../core/decart/client"
import { mapError, type MappedError } from "../../core/decart/errors"
import { resolveGarment } from "../../core/garment/resolve"
import { useKeyStore, getFastMode, setFastMode } from "../../store/key"
import { useUsageStore } from "../../store/usage"
import { useWardrobeStore } from "../../store/wardrobe"
import { Button, Card } from "../ui"
import Stage from "./Stage"
import PersonGuide, { guideFor, type GuideTone } from "./PersonGuide"
import LaserScan from "./LaserScan"
import ControlBar from "./ControlBar"
import StatusChip from "./StatusChip"

type Phase = "NO_KEY" | "ALIGNING" | "SCANNING" | "LIVE" | "ENDED"

/**
 * The Virtual Room — shared by the extension tab (iframed into shopping sites
 * later) and the side panel fallback. The camera stream is local and free;
 * the WebRTC session (billed per generated second) only starts after the
 * first garment is chosen.
 */
export default function Room() {
  const apiKey = useKeyStore((s) => s.apiKey)
  const loaded = useKeyStore((s) => s.loaded)
  const refresh = useKeyStore((s) => s.refresh)
  const usageSeconds = useUsageStore((s) => s.seconds)
  const wardrobe = useWardrobeStore()

  const [phase, setPhase] = useState<Phase>("NO_KEY")
  const phaseRef = useRef<Phase>("NO_KEY")
  const setPhaseWithRef = useCallback((p: Phase | ((prev: Phase) => Phase)) => {
    setPhase((prev) => {
      const next = typeof p === "function" ? p(prev) : p
      phaseRef.current = next
      return next
    })
  }, [])
  const [camera, setCamera] = useState<MediaStream | null>(null)
  const [remote, setRemote] = useState<MediaStream | null>(null)
  const [error, setError] = useState<MappedError | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [compareHold, setCompareHold] = useState(false)
  const [fast, setFast] = useState(false)
  const [guide, setGuide] = useState<{ tone: GuideTone; hint: string }>(guideFor())
  const [screenSize, setScreenSize] = useState<"wide" | "compact">("wide")
  const stageWrapperRef = useRef<HTMLDivElement>(null)

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      stageWrapperRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  const rtRef = useRef<RealtimeHandle | null>(null)
  const cameraRef = useRef<MediaStream | null>(null)
  const remoteRef = useRef<MediaStream | null>(null)
  const stateRef = useRef<"connecting" | "connected" | "generating" | "reconnecting" | "disconnected">(
    "connecting"
  )
  const fastRef = useRef(false)
  const wornRef = useRef(false)
  const connectingRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void getFastMode().then((v) => {
      setFast(v)
      fastRef.current = v
    })
  }, [])

  const beginAligning = useCallback(async () => {
    setPhaseWithRef("ALIGNING")
    setRemote(null)
    remoteRef.current = null
    setBanner(null)
    setError(null)
    useUsageStore.getState().reset()
    wornRef.current = false

    // Local-only preview: no cost. Capture at the model's native 1280×720.
    try {
      const model = models.realtime("lucy-vton-latest")
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(model))
      cameraRef.current = stream
      setCamera(stream)
      setError(null)
    } catch (e) {
      setError(mapError("CAMERA_NOT_ALLOWED"))
    }
  }, [setPhaseWithRef])

  useEffect(() => {
    if (!loaded) return
    if (!apiKey) {
      setPhaseWithRef((prev) => (prev === "NO_KEY" ? prev : "NO_KEY"))
      return
    }
    setPhaseWithRef((prev) => {
      if (prev === "NO_KEY" || prev === "ENDED") {
        void beginAligning()
        return "ALIGNING"
      }
      return prev
    })
  }, [loaded, apiKey, beginAligning, setPhaseWithRef])

  const handleState = useCallback(
    (state: "connecting" | "connected" | "generating" | "reconnecting" | "disconnected") => {
      console.log("[DecartRoom] connectionChange state:", state, "remoteStream:", !!remoteRef.current)
      stateRef.current = state
      switch (state) {
        case "generating":
          setPhaseWithRef("LIVE")
          setBanner(null)
          break
        case "connected":
          if (remoteRef.current) {
            setPhaseWithRef("LIVE")
            setBanner(null)
          }
          break
        case "reconnecting":
          setBanner("Reconnecting — the stream pauses briefly")
          break
        case "disconnected":
          setPhaseWithRef((prev) => {
            if (prev !== "ENDED") {
              setRemote(null)
              remoteRef.current = null
              useUsageStore.getState().reset()
              wornRef.current = false
              return "ALIGNING"
            }
            return prev
          })
          break
        default:
          break
      }
    },
    [setPhaseWithRef]
  )

  const connect = useCallback(
    async (garment: Parameters<typeof startSession>[1]) => {
      if (!cameraRef.current || !apiKey) return
      if (connectingRef.current) {
        console.warn("[DecartRoom] Connection already in flight, skipping duplicate call")
        return
      }
      connectingRef.current = true
      setPhaseWithRef("SCANNING")
      setError(null)
      setBanner(null)
      stateRef.current = "connecting"

      // Watchdog timer: If stuck in SCANNING for > 25 seconds with no stream
      const watchdog = setTimeout(() => {
        if (phaseRef.current === "SCANNING" && !remoteRef.current) {
          console.warn("[DecartRoom] Connection timed out after 25s in SCANNING")
          setError({
            title: "Connection Timed Out",
            detail: "Decart AI live stream is taking too long to connect. Please check your network/firewall, or try Fast mode.",
            action: "retry"
          })
          setPhaseWithRef("ALIGNING")
          setRemote(null)
          remoteRef.current = null
          connectingRef.current = false
        }
      }, 25000)

      try {
        if (rtRef.current) {
          try { rtRef.current.disconnect() } catch {}
          rtRef.current = null
        }
        const rt = await startSession(cameraRef.current, garment, {
          fast: fastRef.current,
          onRemoteStream: (s) => {
            console.log("[DecartRoom] onRemoteStream received track count:", s?.getTracks()?.length)
            remoteRef.current = s
            setRemote(s)
            setPhaseWithRef("LIVE")
            setBanner(null)
          },
          onState: (state) => handleState(state),
          onTick: (seconds) => {
            useUsageStore.getState().add(seconds)
            if (phaseRef.current !== "LIVE") {
              setPhaseWithRef("LIVE")
              setBanner(null)
            }
          },
          onCapacityWait: (retryAfterMs) =>
            setBanner(`Server busy — retrying in ${Math.max(1, Math.round(retryAfterMs / 1000))} s`),
          onSessionEnded: (reason) => {
            clearTimeout(watchdog)
            console.warn('[DecartRoom] session ended with reason:', reason)
            const mapped = mapError(reason)
            setError(mapped)
            setPhaseWithRef("ALIGNING")
            setRemote(null)
            remoteRef.current = null
            useUsageStore.getState().reset()
            wornRef.current = false
          },
          onError: (code, message) => {
            clearTimeout(watchdog)
            console.error('[DecartRoom] session onError:', code, message)
            if (code === 'AbortError' || message?.includes('Stale connect')) return
            const mapped = mapError(code)
            if (message) {
              mapped.detail = `${mapped.detail} (${message})`
            }
            setError(mapped)
            setPhaseWithRef("ALIGNING")
            setRemote(null)
            remoteRef.current = null
            useUsageStore.getState().reset()
            wornRef.current = false
          }
        })
        rtRef.current = rt
        wornRef.current = true
        clearTimeout(watchdog)

        if (remoteRef.current || stateRef.current === "generating" || stateRef.current === "connected") {
          setPhaseWithRef("LIVE")
          setBanner(null)
        }
      } catch (e) {
        clearTimeout(watchdog)
        console.error('[DecartRoom] startSession catch:', e)
        const msg = (e as any)?.message || String(e)
        if (msg.includes('Stale connect') || (e as any)?.name === 'AbortError') {
          console.warn('[DecartRoom] Connect attempt was aborted/superseded, ignoring Stale message')
          return
        }
        const code = (e as any)?.code
        let mapped = code ? mapError(code) : null
        if (!mapped) {
          if (msg.includes('401') || msg.includes('403') || msg.includes('key')) {
            mapped = mapError('INVALID_API_KEY')
          } else if (msg.includes('limit') || msg.includes('concurrent') || msg.includes('SESSION_LIMIT')) {
            mapped = mapError('SESSION_LIMIT')
          } else if (msg.includes('quota') || msg.includes('credits') || msg.includes('balance') || msg.includes('402')) {
            mapped = {
              title: "Credits Exhausted",
              detail: "Your Decart AI account has run out of credits or quota. Check platform.decart.ai.",
              action: "retry"
            }
          } else {
            mapped = {
              title: "Connection Failed",
              detail: msg || "Decart WebRTC connection failed. Check firewall, close duplicate tabs, or try a hotspot/VPN.",
              action: "retry"
            }
          }
        }
        setError(mapped)
        setPhaseWithRef("ALIGNING")
        setRemote(null)
        remoteRef.current = null
        useUsageStore.getState().reset()
        wornRef.current = false
      } finally {
        connectingRef.current = false
      }
    },
    [apiKey, handleState, setPhaseWithRef]
  )

  const onPickFile = useCallback(
    async (file: File) => {
      const garment = await resolveGarment({ blob: file, name: file.name })
      wardrobe.add(garment)
      wardrobe.setCurrent(garment.id)
      if (wornRef.current && rtRef.current && phaseRef.current === "LIVE") {
        // already LIVE → atomic swap, no reconnect
        await swapGarment(rtRef.current, garment)
      } else {
        await connect(garment)
      }
    },
    [connect, wardrobe]
  )

  const loadGarmentFromUrl = useCallback(
    async (item: { imageUrl: string; name?: string; category?: string }) => {
      try {
        const res = await fetch(item.imageUrl)
        const blob = await res.blob()
        const cat = (item.category || "").toLowerCase()
        const region =
          cat.includes("dress") || cat.includes("gown")
            ? ("outfit" as const)
            : cat.includes("bottom") || cat.includes("pant") || cat.includes("skirt")
              ? ("bottom" as const)
              : ("top" as const)

        const garment = await resolveGarment({
          blob,
          name: item.name || "Wardrobe Garment",
          region,
          sourceUrl: item.imageUrl
        })
        wardrobe.add(garment)
        wardrobe.setCurrent(garment.id)
        if (wornRef.current && rtRef.current && phaseRef.current === "LIVE") {
          await swapGarment(rtRef.current, garment)
        } else {
          await connect(garment)
        }
      } catch (err) {
        console.warn("Failed to load pending garment from URL:", err)
      }
    },
    [connect, wardrobe]
  )

  useEffect(() => {
    if (!apiKey) return
    const checkPending = async () => {
      try {
        const stored = await chrome?.storage?.local?.get("pendingGarment")
        if (stored?.pendingGarment?.imageUrl) {
          await chrome.storage.local.remove("pendingGarment")
          await loadGarmentFromUrl(stored.pendingGarment)
        }
      } catch {}
    }
    void checkPending()

    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.pendingGarment?.newValue?.imageUrl) {
        const newItem = changes.pendingGarment.newValue
        void chrome.storage.local.remove("pendingGarment")
        void loadGarmentFromUrl(newItem)
      }
    }
    chrome?.storage?.onChanged?.addListener(listener)
    return () => chrome?.storage?.onChanged?.removeListener(listener)
  }, [apiKey, loadGarmentFromUrl])

  const endSession = useCallback(() => {
    stopSession(rtRef.current, null)
    rtRef.current = null
    setRemote(null)
    remoteRef.current = null
    setPhaseWithRef("ENDED")
    useUsageStore.getState().reset()
    wornRef.current = false
  }, [setPhaseWithRef])

  const toggleFast = useCallback(async () => {
    const next = !fastRef.current
    fastRef.current = next
    setFast(next)
    await setFastMode(next)
  }, [])

  const snapshot = useCallback(() => {
    const video = document.querySelector<HTMLVideoElement>("video:not([data-raw])")
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = `anywear-${Date.now()}.png`
    a.click()
  }, [])

  // Cleanup: tab hidden / unloaded → disconnect + stop tracks (open sessions keep consuming credits)
  useEffect(() => {
    const cleanup = () => {
      stopSession(rtRef.current, cameraRef.current)
    }
    window.addEventListener("pagehide", cleanup)
    window.addEventListener("beforeunload", cleanup)
    return () => {
      window.removeEventListener("pagehide", cleanup)
      window.removeEventListener("beforeunload", cleanup)
    }
  }, [])

  if (!loaded) {
    return <div className="flex h-screen w-full items-center justify-center text-sm text-muted">Loading…</div>
  }

  if (phase === "NO_KEY") {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <Card className="flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted">
            Add your Decart API key once — it stays in this extension and only
            session tokens ever touch the network.
          </p>
          <Button
            onClick={() =>
              window.open(chrome.runtime.getURL("tabs/onboarding.html").replace(/^extension:\/\//, "chrome-extension://"), "_blank")
            }>
            Set up
          </Button>
        </Card>
      </div>
    )
  }

  const statusLabel =
    error?.title && phase !== "LIVE"
      ? "Error"
      : phase === "SCANNING"
        ? "Connecting"
        : phase === "LIVE"
          ? banner
            ? "Reconnecting"
            : "Live"
          : "Ready"

  return (
    <div
      className={`mx-auto flex w-full ${
        screenSize === "wide" ? "max-w-4xl" : "max-w-md"
      } flex-col gap-4 p-4 md:p-6 transition-all duration-300`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base font-bold tracking-tight">Try-On · Anywear</span>
          <button
            onClick={() =>
              window.open(
                chrome.runtime.getURL("tabs/onboarding.html").replace(/^extension:\/\//, "chrome-extension://"),
                "_blank"
              )
            }
            title="Change Decart API Key"
            className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:border-primary/50 hover:text-primary transition-all">
            ⚙️ Key
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Screen Size Switcher */}
          <div className="flex items-center rounded-full border border-hairline bg-surface p-0.5 text-xs shadow-sm">
            <button
              onClick={() => setScreenSize("wide")}
              className={`rounded-full px-3 py-1 font-semibold transition-all ${
                screenSize === "wide" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-ink"
              }`}>
              🖥️ Big Screen
            </button>
            <button
              onClick={() => setScreenSize("compact")}
              className={`rounded-full px-3 py-1 font-semibold transition-all ${
                screenSize === "compact" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-ink"
              }`}>
              📱 Compact
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            title="Full Screen View"
            className="flex items-center gap-1 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-muted hover:border-primary/50 hover:text-primary transition-all shadow-sm">
            ⛶ Fullscreen
          </button>

          <div className="flex items-center gap-2 border-l border-hairline pl-2.5">
            <span className="text-xs tabular-nums text-muted">
              {Math.floor(usageSeconds / 60)}:{String(usageSeconds % 60).padStart(2, "0")} used
            </span>
            <StatusChip label={statusLabel} tone={phase === "LIVE" ? "live" : error ? "warn" : "default"} />
          </div>
        </div>
      </div>

      {/* Stage Wrapper */}
      <div ref={stageWrapperRef} className="relative w-full overflow-hidden rounded-2xl shadow-xl">
        <Stage
          localStream={camera}
          remoteStream={remote}
          showLocal={compareHold || phase === "ALIGNING"}
          overlays={
            <>
              {phase === "ALIGNING" && <PersonGuide tone={guide.tone} hint={guide.hint} />}
              {phase === "SCANNING" && (
                <LaserScan
                  label={
                    banner?.startsWith("Server busy")
                      ? banner
                      : "Scanning you in…"
                  }
                />
              )}
              {phase === "LIVE" && banner && (
                <div className="absolute inset-x-3 top-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs font-medium text-[#b47d1b] backdrop-blur">
                  {banner}
                </div>
              )}
              {error && phase !== "LIVE" && (
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-hairline bg-surface/95 px-4 py-3 text-xs backdrop-blur shadow-2xl">
                  <p className="font-semibold text-sm">{error.title}</p>
                  <p className="text-muted mt-0.5">{error.detail}</p>
                  {error.action === "setup" && (
                    <Button
                      className="mt-2.5"
                      onClick={() =>
                        window.open(
                          chrome.runtime.getURL("tabs/onboarding.html").replace(/^extension:\/\//, "chrome-extension://"),
                          "_blank"
                        )
                      }>
                      Open setup
                    </Button>
                  )}
                  {error.action === "retry" && (
                    <Button
                      className="mt-2.5"
                      onClick={() => {
                        setError(null)
                        if (wardrobe.current) {
                          void connect(wardrobe.current)
                        } else {
                          void beginAligning()
                        }
                      }}>
                      Try again
                    </Button>
                  )}
                </div>
              )}
            </>
          }
        />
      </div>

      {/* Garment tray */}
      <Card className="flex flex-col gap-2.5 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Wardrobe Garments</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {wardrobe.items.length} items
            </span>
          </div>
          <Button className="!px-3.5 !py-1.5 !text-xs font-semibold" onClick={() => fileRef.current?.click()}>
            + Upload Garment
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) await onPickFile(f)
              e.target.value = ""
            }}
          />
        </div>
        {wardrobe.items.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
            {wardrobe.items.map((g) => (
              <button
                key={g.id}
                onClick={async () => {
                  wardrobe.setCurrent(g.id)
                  if (wornRef.current && rtRef.current && phaseRef.current === "LIVE") {
                    await swapGarment(rtRef.current, g)
                  } else {
                    await connect(g)
                  }
                }}
                className={`group shrink-0 rounded-2xl border p-1.5 transition-all text-center ${
                  wardrobe.current?.id === g.id
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
                    : "border-hairline bg-surface hover:border-primary/40 hover:bg-canvas"
                }`}>
                <img
                  src={URL.createObjectURL(g.blob)}
                  alt={g.name}
                  className={`${
                    screenSize === "wide" ? "h-20 w-20" : "h-14 w-14"
                  } rounded-xl object-cover transition-transform group-hover:scale-105`}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
                <span className="block max-w-[80px] truncate text-[11px] font-medium text-muted mt-1">
                  {g.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <ControlBar
        fast={fast}
        onToggleFast={() => void toggleFast()}
        mirrored={true}
        onToggleMirror={() => {}}
        onHoldCompareStart={() => setCompareHold(true)}
        onHoldCompareEnd={() => setCompareHold(false)}
        onSnapshot={snapshot}
        onEnd={endSession}
        live={phase === "LIVE"}
      />

      <p className="text-center text-[11px] text-muted">
        Your webcam streams directly to Decart AI WebRTC. Key stays local in your browser.
      </p>
    </div>
  )
}
