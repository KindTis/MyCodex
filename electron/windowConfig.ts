import path from "node:path";
import { pathToFileURL } from "node:url";
import { OVERLAY_HEIGHT, OVERLAY_WIDTH, type Bounds } from "./windowBounds.js";

export type WindowKind = "overlay" | "settings";
export type BrowserWindowKind = WindowKind | "dashboard";
export type RendererMode = "dev" | "build";

export type BrowserWindowOptionsLike = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  frame?: boolean;
  alwaysOnTop?: boolean;
  transparent?: boolean;
  autoHideMenuBar?: boolean;
  minWidth?: number;
  minHeight?: number;
  resizable: boolean;
  show?: boolean;
  title?: string;
  webPreferences: {
    nodeIntegration: false;
    contextIsolation: true;
    sandbox: true;
    preload?: string;
    additionalArguments?: string[];
  };
};

export type RendererTarget =
  | { type: "url"; url: string }
  | { type: "file"; filePath: string; url: string };

export function isDevMode(argv = process.argv): boolean {
  return argv.includes("--dev");
}

export function getBrowserWindowOptions(kind: WindowKind, options: { preloadPath: string; bounds?: Bounds }): BrowserWindowOptionsLike;
export function getBrowserWindowOptions(kind: "dashboard", options?: { preloadPath?: string; bounds?: Bounds }): BrowserWindowOptionsLike;
export function getBrowserWindowOptions(
  kind: BrowserWindowKind,
  options: { preloadPath?: string; bounds?: Bounds } = {}
): BrowserWindowOptionsLike {
  if (kind === "dashboard") {
    return {
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
    };
  }

  const base: Pick<BrowserWindowOptionsLike, "resizable" | "webPreferences"> = {
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: options.preloadPath ?? "",
      additionalArguments: [`--codex-overlay-window=${kind}`]
    }
  };

  if (kind === "overlay") {
    return {
      ...base,
      width: options.bounds?.width ?? OVERLAY_WIDTH,
      height: options.bounds?.height ?? OVERLAY_HEIGHT,
      x: options.bounds?.x,
      y: options.bounds?.y,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      show: false
    };
  }

  return {
    ...base,
    width: 360,
    height: 240,
    frame: false,
    transparent: true,
    autoHideMenuBar: true,
    resizable: false,
    show: false
  };
}

export function getRendererTarget(kind: WindowKind, options: { mode: RendererMode; distClientDir: string }): RendererTarget {
  const fileName = kind === "overlay" ? "overlay.html" : "settings.html";

  if (options.mode === "dev") {
    return { type: "url", url: `http://127.0.0.1:5173/${fileName}` };
  }

  const filePath = path.join(options.distClientDir, fileName);
  return { type: "file", filePath, url: pathToFileURL(filePath).toString() };
}

export function isAllowedNavigation(kind: WindowKind, targetUrl: string, options: { mode: RendererMode; distClientDir: string }): boolean {
  return targetUrl === getRendererTarget(kind, options).url;
}
