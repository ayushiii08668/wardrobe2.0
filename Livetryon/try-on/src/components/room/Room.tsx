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
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Try-On · Anywear</span>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted">
            {Math.floor(usageSeconds / 60)}:{String(usageSeconds % 60).padStart(2, "0")} used
          </span>
          <StatusChip label={statusLabel} tone={phase === "LIVE" ? "live" : error ? "warn" : "default"} />
        </div>
      </div>

      {/* Stage */}
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
              <div className="absolute inset-x-2 top-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-[#b47d1b] backdrop-blur">
                {banner}
              </div>
            )}
            {error && phase !== "LIVE" && (
              <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-hairline bg-surface/95 px-3 py-2 text-xs backdrop-blur">
                <p className="font-semibold">{error.title}</p>
                <p className="text-muted">{error.detail}</p>
                {error.action === "setup" && (
                  <Button
                    className="mt-2"
                    onClick={() => window.open(chrome.runtime.getURL("tabs/onboarding.html").replace(/^extension:\/\//, "chrome-extension://"), "_blank")}>
                    Open setup
                  </Button>
                )}
                {error.action === "retry" && (
                  <Button
                    className="mt-2"
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

      {/* Garment tray */}
      <Card className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted">Garments</span>
          <Button className="!px-3 !py-1.5 !text-xs" onClick={() => fileRef.current?.click()}>
            + Try on
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
          <div className="flex gap-2 overflow-x-auto pb-1">
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
                className={`shrink-0 rounded-xl border p-1 ${
                  wardrobe.current?.id === g.id ? "border-primary" : "border-hairline"
                }`}>
                <img
                  src={URL.createObjectURL(g.blob)}
                  alt={g.name}
                  className="h-14 w-14 rounded-lg object-cover"
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
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

      <p className="text-center text-[10px] text-muted">
        Your webcam streams only to Decart — there is no other backend. Key stays local.
      </p>
    </div>
  )
}
