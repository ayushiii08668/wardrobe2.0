import { Button } from "../ui"

export default function ControlBar({
  fast,
  onToggleFast,
  mirrored,
  onToggleMirror,
  onHoldCompareStart,
  onHoldCompareEnd,
  onSnapshot,
  onEnd,
  live
}: {
  fast: boolean
  onToggleFast: () => void
  mirrored: boolean
  onToggleMirror: () => void
  onHoldCompareStart: () => void
  onHoldCompareEnd: () => void
  onSnapshot: () => void
  onEnd: () => void
  live: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        variant="ghost"
        disabled={!live}
        onPointerDown={onHoldCompareStart}
        onPointerUp={onHoldCompareEnd}
        onPointerLeave={onHoldCompareEnd}
        className="select-none">
        Hold to compare
      </Button>
      <Button variant="ghost" disabled={!live} onClick={onSnapshot}>
        Snapshot
      </Button>
      <Button variant="ghost" onClick={onToggleMirror}>
        Mirror: {mirrored ? "on" : "off"}
      </Button>
      <Button
        variant={fast ? "success" : "ghost"}
        onClick={onToggleFast}
        title="Lower latency, higher throughput. Billed at 2× the standard rate.">
        Fast mode{fast ? " · 2× cost" : ""}
      </Button>
      {live && (
        <Button variant="danger" onClick={onEnd}>
          End session
        </Button>
      )}
    </div>
  )
}
