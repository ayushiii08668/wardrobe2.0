import type { Garment, Region } from "../../types"
import { buildPrompt, clampPrompt } from "./prompt"

export interface GarmentInput {
  blob: Blob
  name: string
  region?: Region
  hint?: string
  sourceUrl?: string
}

function humanizeFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Step-1 resolver: normalize whatever came in (a picked file for now; later a
 * fetched product image) into a Garment. The keyword classifier (region.ts)
 * and lucy-image-2 extraction hook in from step 3.
 */
export async function resolveGarment(input: GarmentInput): Promise<Garment> {
  const region = input.region ?? "top"
  const hint = (input.hint ?? humanizeFileName(input.name)).slice(0, 120)
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    region,
    hint,
    enhance: true,
    prompt: clampPrompt(buildPrompt(region, hint)),
    blob: input.blob,
    sourceUrl: input.sourceUrl
  }
}
