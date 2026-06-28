import type { WindowPosition } from "../shared/overlaySettings.js";

type TimerId = ReturnType<typeof setTimeout>;

type EventSource = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  once?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type LifecycleWindow = EventSource & {
  show: () => void;
  focus: () => void;
  getBounds: () => { x: number; y: number };
};

export function createMainLifecycle(options: {
  requestSingleInstanceLock: () => boolean;
  quit: () => void;
  onSecondInstance: (handler: () => void) => void;
  createOverlayWindow: () => LifecycleWindow;
  createSettingsWindow: () => LifecycleWindow;
  settingsStore: {
    updateWindowPosition: (position: WindowPosition) => Promise<void> | void;
    beginShutdown: (finalWindowPosition?: WindowPosition) => Promise<void> | void;
  };
  childTracker?: {
    cleanup: (options?: { timeoutMs?: number }) => Promise<unknown> | unknown;
  };
  log?: { write: (event: string, fields?: Record<string, unknown>) => Promise<unknown> | unknown };
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}) {
  const setTimer = options.setTimeoutFn ?? setTimeout;
  const clearTimer = options.clearTimeoutFn ?? clearTimeout;
  let overlayWindow: LifecycleWindow | null = null;
  let settingsWindow: LifecycleWindow | null = null;
  let moveTimer: TimerId | null = null;
  let shuttingDown = false;

  function start(): boolean {
    if (!options.requestSingleInstanceLock()) {
      options.quit();
      return false;
    }

    overlayWindow = options.createOverlayWindow();
    attachMovePersistence(overlayWindow);
    options.onSecondInstance(() => {
      overlayWindow?.show();
      overlayWindow?.focus();
      void options.log?.write("second-instance", { action: "show-focus-existing-overlay" });
    });
    return true;
  }

  function openSettings(): void {
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
      return;
    }

    settingsWindow = options.createSettingsWindow();
    settingsWindow.once?.("closed", () => {
      settingsWindow = null;
    });
  }

  function attachMovePersistence(window: LifecycleWindow): void {
    const schedule = () => {
      if (shuttingDown) {
        return;
      }
      if (moveTimer) {
        clearTimer(moveTimer);
      }
      moveTimer = setTimer(() => {
        const { x, y } = window.getBounds();
        void options.settingsStore.updateWindowPosition({ x, y });
        moveTimer = null;
      }, 500);
    };

    window.on("move", schedule);
    window.on("moved", schedule);
  }

  async function beginShutdown(): Promise<void> {
    shuttingDown = true;
    if (moveTimer) {
      clearTimer(moveTimer);
      moveTimer = null;
    }

    const finalBounds = overlayWindow?.getBounds();
    await options.settingsStore.beginShutdown(finalBounds ? { x: finalBounds.x, y: finalBounds.y } : undefined);
    await options.childTracker?.cleanup({ timeoutMs: 2_000 });
  }

  return {
    start,
    openSettings,
    attachMovePersistence,
    beginShutdown,
    isShuttingDown: () => shuttingDown,
    getOverlayWindow: () => overlayWindow,
    getSettingsWindow: () => settingsWindow
  };
}
