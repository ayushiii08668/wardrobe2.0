import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Plays while the session connects (SCANNING) and hides the connection latency.
 * Ends only when connectionChange reaches "generating" and a remote frame is up.
 */
export default function LaserScan({
  label,
  children
}: {
  label?: string
  children?: ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-stage">
      <div className="absolute inset-0 scan-grid opacity-70" />

      {reduce ? (
        // simple progress sweep for reduced motion
        <motion.div
          className="absolute inset-x-0 h-1.5"
          style={{ background: "rgba(56,214,255,.9)" }}
          initial={{ top: 0 }}
          animate={{ top: ["0%", "100%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        />
      ) : (
        <motion.div
          className="absolute inset-x-0 h-28"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(139,124,255,.22) 70%, rgba(56,214,255,.95) 99%, transparent)",
            filter: "drop-shadow(0 0 14px rgba(56,214,255,.7))"
          }}
          initial={{ top: "-15%" }}
          animate={{ top: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
        />
      )}

      {label && (
        <div className="absolute inset-x-0 top-4 text-center">
          <span
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
            style={{ background: "rgba(21,24,38,.55)" }}
          >
            {label}
          </span>
        </div>
      )}
      {children}
    </div>
  )
}
