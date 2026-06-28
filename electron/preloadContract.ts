import type { DashboardResponse } from "../shared/dashboardTypes.js";
import type { OverlaySettings, SettingsUpdateInput, SettingsUpdateResult } from "../shared/overlaySettings.js";
import { IPC_CHANNELS } from "./ipcContract.js";
import type { WindowKind } from "./windowConfig.js";

type IpcRendererLike = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, handler: (...args: unknown[]) => void) => void;
  off: (channel: string, handler: (...args: unknown[]) => void) => void;
};

export type OverlayWindowApi = {
  usage: {
    getSnapshot: () => Promise<DashboardResponse>;
  };
  settings: {
    get: () => Promise<OverlaySettings>;
    onChanged: (handler: (settings: OverlaySettings) => void) => () => void;
  };
};

export type SettingsWindowApi = {
  settings: {
    get: () => Promise<OverlaySettings>;
    update: (settings: SettingsUpdateInput) => Promise<SettingsUpdateResult>;
  };
};

export type CodexOverlayApi = OverlayWindowApi | SettingsWindowApi;

export function createCodexOverlayApi(kind: WindowKind, ipcRenderer: IpcRendererLike): CodexOverlayApi {
  if (kind === "settings") {
    return {
      settings: {
        get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<OverlaySettings>,
        update: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, settings) as Promise<SettingsUpdateResult>
      }
    };
  }

  return {
    usage: {
      getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.usageGetSnapshot) as Promise<DashboardResponse>
    },
    settings: {
      get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<OverlaySettings>,
      onChanged: (handler) => {
        const wrapped = (...args: unknown[]) => handler(args[1] as OverlaySettings);
        ipcRenderer.on(IPC_CHANNELS.settingsChanged, wrapped);
        return () => {
          ipcRenderer.off(IPC_CHANNELS.settingsChanged, wrapped);
        };
      }
    }
  };
}

export function getPreloadWindowKind(argv = process.argv): WindowKind {
  const arg = argv.find((value) => value.startsWith("--codex-overlay-window="));
  return arg?.endsWith("=settings") ? "settings" : "overlay";
}
