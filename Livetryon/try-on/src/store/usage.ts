import { create } from "zustand"

interface UsageState {
  /** Generated seconds this session (from generationTick). Realtime is billed per second. */
  seconds: number
  add: (s: number) => void
  reset: () => void
}

export const useUsageStore = create<UsageState>((set) => ({
  seconds: 0,
  add: (s) =>
    set((st) => ({ seconds: st.seconds + s })),
  reset: () => set({ seconds: 0 })
}))
