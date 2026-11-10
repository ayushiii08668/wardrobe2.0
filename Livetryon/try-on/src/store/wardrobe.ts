import { create } from "zustand"
import type { Garment } from "../types"

interface WardrobeState {
  /** Most-recent-first. Blobs live only for this session (as in the design). */
  items: Garment[]
  current: Garment | null
  add: (g: Garment) => void
  setCurrent: (id: string) => void
}

export const useWardrobeStore = create<WardrobeState>((set) => ({
  items: [],
  current: null,
  add: (g) =>
    set((st) => ({
      items: [g, ...st.items].slice(0, 12),
      current: st.current ?? g
    })),
  setCurrent: (id) =>
    set((st) => ({ current: st.items.find((i) => i.id === id) ?? st.current }))
}))
