export type GuideTone = "idle" | "ok" | "warn"

export interface AlignmentHint {
  text: string
  tone: GuideTone
}

/** Pre-MediaPipe silhouette. Pose Landmarker drives hint + tone in step 2. */
export function guideFor(hint?: string | null, tone: GuideTone = "idle") {
  return { tone, hint: hint ?? "Show your full upper body" }
}

/** Person-shaped mask: head + torso landscape composition (640×360 = the model's 1280×720 halved). */
export default function PersonGuide({ tone, hint }: { tone: GuideTone; hint: string }) {
  const stroke =
    tone === "ok" ? "#2BC48A" : tone === "warn" ? "#F5A524" : "rgba(255,255,255,.55)"
  const fill = "rgba(255,255,255,.08)"

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <svg viewBox="0 0 640 360" className="h-full w-full">
        <g stroke={stroke} fill={fill} strokeWidth={2}>
          <ellipse cx="320" cy="86" rx="30" ry="38" />
          <path d="M 232 168 Q 320 138 408 168 L 400 330 Q 320 344 240 330 Z" />
        </g>
      </svg>
      <div className="absolute bottom-4">
        <span
          className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur"
          style={{ background: "rgba(21,24,38,.55)" }}
        >
          {hint}
        </span>
      </div>
    </div>
  )
}
