export type Region =
  | "top"
  | "bottom"
  | "outfit"
  | "footwear"
  | "hat"
  | "accessory"

export interface Garment {
  id: string
  /** Display name, e.g. the product title */
  name: string
  region: Region
  /** The user-editable part of the prompt ("Substitute the …" line's tail) */
  hint: string
  enhance: boolean
  /** Built from region + hint via buildPrompt() */
  prompt: string
  /** Raw garment image bytes (JPEG/PNG/WebP), >= 512px */
  blob: Blob
  /** Set when the drop came from a product page, for re-resolving and history */
  sourceUrl?: string
}

export const REGION_LABEL: Record<Region, string> = {
  top: "Top",
  bottom: "Bottom",
  outfit: "Outfit",
  footwear: "Shoes",
  hat: "Hat",
  accessory: "Accessory"
}
