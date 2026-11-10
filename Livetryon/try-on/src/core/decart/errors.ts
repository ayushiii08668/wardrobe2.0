export interface MappedError {
  title: string
  detail: string
  /** "setup" opens onboarding; "retry" offers a retry button */
  action?: "setup" | "retry"
}

/**
 * Maps DecartSDKError codes + our own codes to user-facing copy.
 * Only error CODES are matched — never render raw network traces.
 */
export function mapError(code?: string): MappedError {
  switch (code) {
    case "INVALID_API_KEY":
      return {
        title: "Key rejected",
        detail: "Your Decart API key is invalid or missing. Check it in setup.",
        action: "setup"
      }
    case "TOKEN_EXPIRED":
      return {
        title: "Session expired",
        detail: "Tap to resume — we'll mint a fresh token."
      }
    case "WEB_RTC_ERROR":
      return {
        title: "Connection failed",
        detail:
          "Decart couldn't reach your network over WebRTC. Check firewall/VPN; blocked UDP (7882/3478) is the usual culprit.",
        action: "retry"
      }
    case "MODEL_NOT_FOUND":
      return {
        title: "Model unavailable",
        detail: "The try-on model is temporarily unavailable. Try again shortly.",
        action: "retry"
      }
    case "INVALID_INPUT":
      return {
        title: "Invalid garment",
        detail: "The reference image was rejected. Try a cleaner product photo."
      }
    case "SESSION_LIMIT":
      return {
        title: "Key already in use",
        detail: "Concurrent session limit reached. Close other tabs/apps using this key, then retry.",
        action: "retry"
      }
    case "CAPACITY":
      return {
        title: "Server busy",
        detail: "No capacity right now — automatically retrying."
      }
    case "NO_KEY":
      return {
        title: "No API key",
        detail: "Add your Decart key in setup to start try-on.",
        action: "setup"
      }
    case "CAMERA_NOT_ALLOWED":
      return {
        title: "Camera blocked",
        detail: "Grant camera access in the setup tab, then come back."
      }
    default:
      return { title: "Something went wrong", detail: "Tap to retry.", action: "retry" }
  }
}
