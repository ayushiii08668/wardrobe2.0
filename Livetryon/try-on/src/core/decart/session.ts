import { models, type DecartSDKError } from "@decartai/sdk"
import { decartClient } from "./client"
import type { Garment } from "../../types"

type ConnectionState = "connecting" | "connected" | "generating" | "reconnecting" | "disconnected"

export interface SessionCallbacks {
  /** 2× cost — opt-in only */
  fast?: boolean
  onRemoteStream: (stream: MediaStream) => void
  onState: (state: ConnectionState) => void
  onTick: (seconds: number) => void
  onError: (code: string, message: string) => void
  onCapacityWait?: (retryAfterMs: number) => void
  onSessionEnded?: (reason: string) => void
}

export type RealtimeHandle = Awaited<ReturnType<typeof decartClient.realtime.connect>>

/**
 * Connect once and keep the handle for the whole visit; garment swaps use
 * set() (atomic state replacement) instead of reconnects.
 */
export async function startSession(
  stream: MediaStream,
  garment: Garment,
  cb: SessionCallbacks
): Promise<RealtimeHandle> {
  const model = models.realtime("lucy-vton-latest")

  const rt = await decartClient.realtime.connect(stream, {
    model,
    // Desktop webcams usually don't report facingMode, so "auto" won't flip there
    mirror: true,
    ...(cb.fast ? { speed: "fast" as const } : {}),
    onRemoteStream: cb.onRemoteStream,
    onConnectionChange: cb.onState,
    onCapacityWait: cb.onCapacityWait
      ? (wait: unknown) => cb.onCapacityWait?.(capacityWaitMs(wait))
      : undefined,
    // First garment goes into the initial state so frame #1 is already transformed
    initialState: {
      prompt: { text: garment.prompt, enhance: garment.enhance },
      image: garment.blob
    }
  })

  rt.on("connectionChange", cb.onState)
  rt.on("generationTick", ({ seconds }) => cb.onTick(seconds))
  rt.on("error", (e: DecartSDKError) => cb.onError(e.code, e.message))
  rt.on("sessionEnded", (e: any) => {
    const reason = e?.reason || e || "unknown"
    cb.onSessionEnded?.(String(reason))
  })
  rt.on("generationEnded", (e: any) => {
    const reason = e?.reason || e || "unknown"
    cb.onSessionEnded?.(String(reason))
  })
  return rt
}

/** Atomic: set() replaces the entire state — include every field we want kept. */
export function swapGarment(rt: RealtimeHandle, garment: Garment): Promise<void> {
  return rt.set({
    prompt: garment.prompt,
    enhance: garment.enhance,
    image: garment.blob
  })
}

export function stopSession(rt: RealtimeHandle | null, camera: MediaStream | null) {
  try {
    rt?.disconnect()
  } catch {
    // already closed
  }
  camera?.getTracks().forEach((t) => t.stop())
}

/** Capture at the model's native 1280×720 exactly — no browser scaling.
 *  The SDK's `model.fps` may be a plain number OR a `{ ideal, max, … }` hint;
 *  both are valid ConstrainDOMNumber values for getUserMedia. */
export function cameraConstraints(model: { fps: unknown; width: number; height: number }) {
  return {
    audio: false, // try-on needs no mic — avoids a second permission prompt
    video: {
      frameRate: model.fps as number | { max?: number; min?: number; ideal?: number; exact?: number },
      width: model.width,
      height: model.height,
      facingMode: "user" as const
    }
  }
}

/** Normalize the SDK's capacity-wait argument (number or { retryAfterMs }) to milliseconds. */
export function capacityWaitMs(wait: unknown): number {
  if (typeof wait === "number") return wait
  const ms = (wait as { retryAfterMs?: number } | null)?.retryAfterMs
  return typeof ms === "number" ? ms : 0
}
