import { Storage } from "@plasmohq/storage"
import { create } from "zustand"

/** chrome.storage.local-backed storage. The permanent key NEVER leaves extension contexts. */
export const storage = new Storage({ area: "local" })

const KEY_NAME = "decart:apiKey"
const FAST_NAME = "settings:fast"

export async function getApiKey(): Promise<string | null> {
  return (await storage.get<string>(KEY_NAME)) ?? null
}

export async function saveApiKey(key: string): Promise<void> {
  await storage.set(KEY_NAME, key)
}

export async function clearApiKey(): Promise<void> {
  await storage.remove(KEY_NAME)
}

export async function getFastMode(): Promise<boolean> {
  return (await storage.get<boolean>(FAST_NAME)) ?? false
}

export async function setFastMode(on: boolean): Promise<void> {
  await storage.set(FAST_NAME, on)
}

interface KeyState {
  apiKey: string | null
  loaded: boolean
  refresh: () => Promise<void>
}

/** Convenience store for extension pages. */
export const useKeyStore = create<KeyState>((set) => ({
  apiKey: null,
  loaded: false,
  refresh: async () => {
    const key = await getApiKey()
    set({ apiKey: key, loaded: true })
  }
}))
