import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

interface StageProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  /** CSS-mirror the local preview (raw camera); remote frames are pre-flipped by mirror:true, shown as-is. */
  showLocal: boolean
  overlays?: ReactNode
}

/**
 * 16:9 stage card. VTON captures and outputs 1280×720 (landscape) — the panel
 * wraps it, it does not letterbox it.
 */
export default function Stage({
  localStream,
  remoteStream,
  showLocal,
  overlays
}: StageProps) {
  const localRef = useRef<HTMLVideoElement>(null)
  const remoteRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream
      localRef.current.play().catch(() => {})
    }
  }, [localStream])

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream
      remoteRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  const showRaw = showLocal || !remoteStream

  return (
    <div
      className="relative w-full overflow-hidden rounded-stage border border-hairline bg-ink/95 shadow-panel"
      style={{ aspectRatio: "16 / 9" }}>
      {/* raw camera — always rendered so we can "hold to compare" and snapshot */}
      <video
        ref={localRef}
        data-raw
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          showRaw ? "opacity-100" : "opacity-0"
        }`}
        style={{ transform: "scaleX(-1)" }}
      />

      {/* generated output */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          showRaw ? "opacity-0" : "opacity-100"
        }`}
      />

      {overlays}
    </div>
  )
}
