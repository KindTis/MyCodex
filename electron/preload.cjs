const { contextBridge, ipcRenderer } = require("electron");

const IPC_CHANNELS = {
  usageGetSnapshot: "usage.getSnapshot",
  settingsGet: "settings.get",
  settingsUpdate: "settings.update",
  settingsChanged: "settings.changed"
};

function getWindowKind(argv = process.argv) {
  const arg = argv.find((value) => value.startsWith("--codex-overlay-window="));
  return arg && arg.endsWith("=settings") ? "settings" : "overlay";
}

function createApi(kind) {
  if (kind === "settings") {
    return {
      settings: {
        get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
        update: (settings) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, settings)
      }
    };
  }

  return {
    usage: {
      getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.usageGetSnapshot)
    },
    settings: {
      get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
      onChanged: (handler) => {
        const wrapped = (_event, settings) => handler(settings);
        ipcRenderer.on(IPC_CHANNELS.settingsChanged, wrapped);
        return () => {
          ipcRenderer.off(IPC_CHANNELS.settingsChanged, wrapped);
        };
      }
    }
  };
}

contextBridge.exposeInMainWorld("codexOverlay", createApi(getWindowKind()));
