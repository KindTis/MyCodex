import path from "node:path";
import { pathToFileURL } from "node:url";
import { getBrowserWindowOptions, getRendererTarget, isAllowedNavigation } from "./windowConfig.js";

describe("windowConfig", () => {
  it("overlay window 옵션을 고정한다", () => {
    const options = getBrowserWindowOptions("overlay", { preloadPath: "preload.js" });

    expect(options).toMatchObject({
      width: 280,
      height: 188,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: "preload.js",
        additionalArguments: ["--codex-overlay-window=overlay"]
      }
    });
  });

  it("settings window 옵션을 고정한다", () => {
    const options = getBrowserWindowOptions("settings", { preloadPath: "preload.js" });

    expect(options).toMatchObject({
      width: 360,
      height: 240,
      frame: false,
      transparent: true,
      autoHideMenuBar: true,
      resizable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        additionalArguments: ["--codex-overlay-window=settings"]
      }
    });
  });

  it("dashboard window 옵션은 일반 앱 창으로 고정한다", () => {
    const options = getBrowserWindowOptions("dashboard");

    expect(options).toMatchObject({
      width: 1120,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      autoHideMenuBar: true,
      resizable: true,
      show: false,
      title: "Codex Usage Dashboard",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    expect(options.webPreferences).not.toHaveProperty("preload");
    expect(options.webPreferences).not.toHaveProperty("additionalArguments");
  });

  it("dev mode는 kind별 strict port entry만 허용한다", () => {
    const distClientDir = "dist/client";

    expect(getRendererTarget("overlay", { mode: "dev", distClientDir })).toEqual({
      type: "url",
      url: "http://127.0.0.1:5173/overlay.html"
    });
    expect(isAllowedNavigation("overlay", "http://127.0.0.1:5173/overlay.html", { mode: "dev", distClientDir })).toBe(true);
    expect(isAllowedNavigation("overlay", "http://127.0.0.1:5173/settings.html", { mode: "dev", distClientDir })).toBe(false);
    expect(isAllowedNavigation("settings", "http://127.0.0.1:5173/settings.html", { mode: "dev", distClientDir })).toBe(true);
    expect(isAllowedNavigation("settings", "http://127.0.0.1:5173/overlay.html", { mode: "dev", distClientDir })).toBe(false);
  });

  it("build mode는 kind별 dist html만 허용한다", () => {
    const distClientDir = path.resolve("dist/client");
    const overlayUrl = pathToFileURL(path.join(distClientDir, "overlay.html")).toString();
    const settingsUrl = pathToFileURL(path.join(distClientDir, "settings.html")).toString();

    expect(isAllowedNavigation("overlay", overlayUrl, { mode: "build", distClientDir })).toBe(true);
    expect(isAllowedNavigation("overlay", settingsUrl, { mode: "build", distClientDir })).toBe(false);
    expect(isAllowedNavigation("settings", settingsUrl, { mode: "build", distClientDir })).toBe(true);
    expect(isAllowedNavigation("settings", overlayUrl, { mode: "build", distClientDir })).toBe(false);
  });
});
