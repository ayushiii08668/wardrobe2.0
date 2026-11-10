import { useEffect, useState } from "react"
import { Button, Card } from "./components/ui"
import { clearApiKey, getApiKey, getFastMode, setFastMode } from "./store/key"
import "./style.css"

export default function Options() {
  const [hasKey, setHasKey] = useState<boolean>(false)
  const [fast, setFast] = useState(false)

  useEffect(() => {
    void (async () => {
      setHasKey((await getApiKey()) !== null)
      setFast(await getFastMode())
    })()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="flex w-full max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-bold">Try-On · Anywear — settings</h1>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Decart key</span>
          <p className="text-xs text-muted">
            {hasKey
              ? "Stored locally. Only 60-second tokens ever leave the extension."
              : "Not set up yet."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => window.open(chrome.runtime.getURL("tabs/onboarding.html"), "_blank")}>
              {hasKey ? "Re-run setup" : "Open setup"}
            </Button>
            {hasKey && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await clearApiKey()
                  setHasKey(false)
                }}>
                Remove key
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <label className="flex items-center justify-between text-sm font-semibold">
            Fast mode
            <input
              type="checkbox"
              checked={fast}
              onChange={async (e) => {
                setFast(e.target.checked)
                await setFastMode(e.target.checked)
              }}
            />
          </label>
          <p className="text-[10px] text-muted">
            Lower latency, higher throughput. Unchanged output quality, billed
            at 2× the standard realtime rate.
          </p>
        </div>

        <p className="border-t border-hairline pt-4 text-[10px] text-muted">
          Privacy: your webcam stream goes only to Decart; there is no other
          backend. The API key stays in this extension.
        </p>
      </Card>
    </main>
  )
}

