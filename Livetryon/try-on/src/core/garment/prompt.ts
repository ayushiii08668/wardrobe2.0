import type { Region } from "../../types"

const REGION_LEAD = {
  top: "Substitute the upper body garment with",
  bottom: "Substitute the lower body garment with",
  outfit: "Substitute the outfit with",
  footwear: "Substitute the footwear with",
  hat: "Substitute the hat with",
  accessory: "Add"
} as const

/**
 * Uses the docs' substitute/add patterns. Placeholder hint falls back to the
 * reference image itself; enhance:true fills in the rest.
 */
export function buildPrompt(region: Region, hint: string): string {
  const item = (hint || "the garment shown in the reference image").trim()
  const lead = REGION_LEAD[region]
  return region === "accessory"
    ? `Add ${item} to the outfit.`
    : `${lead} ${item}, matching the reference image exactly.`
}

/** Guard rail: keep prompts compact; never invent details not visible in the image. */
export function clampPrompt(text: string, max = 750): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : clean.slice(0, max - 1).replace(/[\s,]+\S*$/, "") + "…"
}
