import type { CodexOverlayApi } from "../../electron/preloadContract";

declare global {
  interface Window {
    codexOverlay?: CodexOverlayApi;
  }
}

export function getCodexOverlayApi(): CodexOverlayApi {
  if (!window.codexOverlay) {
    throw new Error("window.codexOverlay API를 찾지 못했습니다.");
  }

  return window.codexOverlay;
}
