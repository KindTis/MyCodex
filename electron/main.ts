import { app, BrowserWindow, ipcMain, Menu, screen, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCcusageDailyReader } from "../server/data/ccusage.js";
import { createCodexRateLimitsReader } from "../server/data/codexAppServer.js";
import { createDashboardService } from "../server/data/dashboardService.js";
import { DebugStore } from "../server/data/debugStore.js";
import { sanitizeMessage } from "../server/utils/sanitize.js";
import { createAppLog } from "./appLog.js";
import { createChildTracker } from "./childTracker.js";
import { registerOverlayContextMenu } from "./contextMenu.js";
import { createDashboardServerController } from "./dashboardServer.js";
import { createIpcHandlers } from "./ipcHandlers.js";
import { createSettingsStore } from "./settingsStore.js";
import { getBrowserWindowOptions, getRendererTarget, isAllowedNavigation, isDevMode, type RendererMode, type WindowKind } from "./windowConfig.js";
import { OVERLAY_HEIGHT, OVERLAY_WIDTH, resolveOverlayBounds, type Bounds } from "./windowBounds.js";
import { registerWindowKind } from "./windowRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distClientDir = path.resolve(__dirname, "../../client");
const preloadPath = path.join(__dirname, "preload.cjs");
const mode: RendererMode = isDevMode(process.argv) ? "dev" : "build";
app.setName("mycodex-usage-dashboard");
const appLog = createAppLog({ logDir: path.join(app.getPath("userData"), "logs") });
const settingsStore = createSettingsStore({
  settingsPath: path.join(app.getPath("userData"), "overlay-settings.json"),
  log: appLog
});
const childTracker = createChildTracker();
const senderKinds = new Map<number, WindowKind>();

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("disable-software-rasterizer");

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let moveTimer: ReturnType<typeof setTimeout> | null = null;
let shuttingDown = false;
let shutdownCompleted = false;

const dashboardService = createDashboardService({
  ccusageReader: createCcusageDailyReader({ cwd: app.getAppPath(), onChild: childTracker.track }),
  codexReader: createCodexRateLimitsReader({ onChild: childTracker.track }),
  store: new DebugStore()
});
const dashboardServer = createDashboardServerController({
  clientDir: distClientDir,
  service: dashboardService,
  log: appLog
});

function displayLike(display: Electron.Display) {
  return { workArea: display.workArea };
}

function hardenNavigation(window: BrowserWindow, kind: WindowKind): void {
  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedNavigation(kind, targetUrl, { mode, distClientDir })) {
      event.preventDefault();
      void appLog.write("navigation-blocked", { kind, targetUrl });
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

function hardenDashboardNavigation(window: BrowserWindow, dashboardUrl: string): void {
  const allowedOrigin = new URL(dashboardUrl).origin;

  window.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      if (new URL(targetUrl).origin === allowedOrigin) {
        return;
      }
    } catch {
      // Invalid URLs are blocked below.
    }

    event.preventDefault();
    void appLog.write("navigation-blocked", { kind: "dashboard", targetUrl });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

async function loadRenderer(window: BrowserWindow, kind: WindowKind): Promise<void> {
  const target = getRendererTarget(kind, { mode, distClientDir });
  window.webContents.on("did-fail-load", (_event, _errorCode, errorDescription) => {
    void appLog.write("renderer-load-failed", { kind, message: sanitizeMessage(errorDescription) });
  });

  if (target.type === "url") {
    await window.loadURL(target.url);
  } else {
    await window.loadFile(target.filePath);
  }
}

function savedBounds(position: { x: number; y: number } | undefined): Bounds {
  return {
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT
  };
}

function attachMovePersistence(window: BrowserWindow): void {
  const schedule = () => {
    if (shuttingDown) {
      return;
    }
    if (moveTimer) {
      clearTimeout(moveTimer);
    }
    moveTimer = setTimeout(() => {
      const { x, y } = window.getBounds();
      void ipcHandlers.updateWindowPosition({ x, y });
      moveTimer = null;
    }, 500);
  };

  window.on("move", schedule);
  window.on("moved", schedule);
}

async function createOverlayWindow(): Promise<BrowserWindow> {
  const settings = await settingsStore.load();
  const targetDisplay = screen.getDisplayMatching(savedBounds(settings.windowPosition));
  const resolved = resolveOverlayBounds({
    savedPosition: settings.windowPosition,
    targetDisplay: displayLike(targetDisplay),
    primaryDisplay: displayLike(screen.getPrimaryDisplay())
  });
  await appLog.write("overlay-window-bounds", {
    reason: resolved.reason,
    adjusted: resolved.adjusted,
    bounds: resolved.bounds
  });

  const window = new BrowserWindow(
    getBrowserWindowOptions("overlay", { preloadPath, bounds: resolved.bounds }) as BrowserWindowConstructorOptions
  );
  overlayWindow = window;
  registerWindowKind(senderKinds, window, "overlay");
  hardenNavigation(window, "overlay");
  attachMovePersistence(window);
  registerOverlayContextMenu({
    webContents: window.webContents,
    menu: Menu,
    openDashboard: () => {
      void openDashboard().catch((error) => appLog.write("dashboard-window-failed", { message: sanitizeMessage(error) }));
    },
    openSettings,
    quit: () => app.quit()
  });
  window.once("ready-to-show", () => {
    window.show();
    void appLog.write("overlay-window-shown");
  });
  await loadRenderer(window, "overlay").catch((error) => appLog.write("renderer-load-failed", { kind: "overlay", message: sanitizeMessage(error) }));
  return window;
}

function openSettings(): void {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    void appLog.write("settings-window-focused");
    return;
  }

  const window = new BrowserWindow(getBrowserWindowOptions("settings", { preloadPath }) as BrowserWindowConstructorOptions);
  settingsWindow = window;
  registerWindowKind(senderKinds, window, "settings");
  hardenNavigation(window, "settings");
  window.once("closed", () => {
    settingsWindow = null;
    void appLog.write("settings-window-closed");
  });
  window.once("ready-to-show", () => window.show());
  void appLog.write("settings-window-opened");
  void loadRenderer(window, "settings").catch((error) =>
    appLog.write("renderer-load-failed", { kind: "settings", message: sanitizeMessage(error) })
  );
}

async function openDashboard(): Promise<void> {
  if (dashboardWindow) {
    dashboardWindow.show();
    dashboardWindow.focus();
    void appLog.write("dashboard-window-focused");
    return;
  }

  const dashboardUrl = await dashboardServer.ensureStarted();
  const window = new BrowserWindow(getBrowserWindowOptions("dashboard") as BrowserWindowConstructorOptions);
  dashboardWindow = window;
  hardenDashboardNavigation(window, dashboardUrl);
  window.once("closed", () => {
    dashboardWindow = null;
    void appLog.write("dashboard-window-closed");
  });
  window.once("ready-to-show", () => window.show());
  void appLog.write("dashboard-window-opened", { url: dashboardUrl });
  await window.loadURL(dashboardUrl).catch((error) =>
    appLog.write("renderer-load-failed", { kind: "dashboard", message: sanitizeMessage(error) })
  );
}

const ipcHandlers = createIpcHandlers({
  dashboardService,
  settingsStore,
  getSenderKind: (senderId) => senderKinds.get(senderId) ?? null,
  isShuttingDown: () => shuttingDown,
  broadcastSettingsChanged: (settings) => {
    overlayWindow?.webContents.send("settings.changed", settings);
  },
  log: appLog
});

ipcHandlers.register(ipcMain);

async function shutdown(): Promise<void> {
  shuttingDown = true;
  if (moveTimer) {
    clearTimeout(moveTimer);
    moveTimer = null;
  }

  await appLog.write("app-shutdown-started");
  const bounds = overlayWindow?.getBounds();
  await settingsStore.beginShutdown(bounds ? { x: bounds.x, y: bounds.y } : undefined);
  const cleanup = await childTracker.cleanup({ timeoutMs: 2_000 });
  if (cleanup.timedOut) {
    await appLog.write("child-cleanup-timeout", cleanup);
  }
  await dashboardServer.close().catch((error) => appLog.write("dashboard-server-stop-failed", { message: sanitizeMessage(error) }));
  await appLog.write("app-shutdown-completed");
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    overlayWindow?.show();
    overlayWindow?.focus();
    void appLog.write("second-instance", { action: "show-focus-existing-overlay" });
  });

  app.on("before-quit", (event) => {
    if (shutdownCompleted) {
      return;
    }
    event.preventDefault();
    void shutdown().finally(() => {
      shutdownCompleted = true;
      app.quit();
    });
  });

  void app.whenReady().then(async () => {
    await appLog.write("app-started");
    await createOverlayWindow();
  });
}
