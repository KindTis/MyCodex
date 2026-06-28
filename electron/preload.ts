import { contextBridge, ipcRenderer } from "electron";
import { createCodexOverlayApi, getPreloadWindowKind } from "./preloadContract.js";

contextBridge.exposeInMainWorld("codexOverlay", createCodexOverlayApi(getPreloadWindowKind(), ipcRenderer));
