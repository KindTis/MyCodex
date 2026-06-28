import type { DashboardResponse } from "../shared/dashboardTypes.js";
import type { OverlaySettings, SettingsUpdateResult, WindowPosition } from "../shared/overlaySettings.js";
import { sanitizeMessage } from "../server/utils/sanitize.js";
import { IPC_CHANNELS } from "./ipcContract.js";
import type { WindowKind } from "./windowConfig.js";

type IpcEventLike = {
  sender: {
    id: number;
    isDestroyed?: () => boolean;
  };
};

type DashboardServiceLike = {
  getDashboard: () => Promise<DashboardResponse>;
};

type SettingsStoreLike = {
  get: () => OverlaySettings;
  updateEditableSettings: (input: unknown) => Promise<SettingsUpdateResult>;
  updateWindowPosition: (position: WindowPosition) => Promise<void>;
};

type LogLike = {
  write: (event: string, fields?: Record<string, unknown>) => Promise<unknown> | unknown;
};

type IpcMainLike = {
  handle: (channel: string, handler: (event: IpcEventLike, ...args: unknown[]) => unknown) => void;
};

function unauthorizedError(channel: string): Error {
  return new Error(`${channel} IPC sender가 허용되지 않았습니다.`);
}

function settingsUpdateRejected(message: string): SettingsUpdateResult {
  return { ok: false, fieldErrors: {}, formError: message };
}

function summarizeLimits(response: DashboardResponse) {
  const codex = response.limits.find((bucket) => bucket.id === "codex");
  return {
    fiveHour: codex?.primary?.usedPercent ?? null,
    oneWeek: codex?.secondary?.usedPercent ?? null
  };
}

export function createIpcHandlers(options: {
  dashboardService: DashboardServiceLike;
  settingsStore: SettingsStoreLike;
  getSenderKind: (senderId: number) => WindowKind | null;
  isShuttingDown: () => boolean;
  broadcastSettingsChanged: (settings: OverlaySettings) => void;
  log: LogLike;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());

  function senderKind(event: IpcEventLike): WindowKind | null {
    if (event.sender.isDestroyed?.()) {
      return null;
    }

    return options.getSenderKind(event.sender.id);
  }

  function requireSender(event: IpcEventLike, allowed: WindowKind[], channel: string): WindowKind {
    const kind = senderKind(event);
    if (!kind || !allowed.includes(kind)) {
      void options.log.write("ipc-sender-rejected", { channel, senderId: event.sender.id });
      throw unauthorizedError(channel);
    }

    return kind;
  }

  async function handleUsageGetSnapshot(event: IpcEventLike): Promise<DashboardResponse> {
    requireSender(event, ["overlay"], IPC_CHANNELS.usageGetSnapshot);
    if (options.isShuttingDown()) {
      await options.log.write("usage-rejected", { channel: IPC_CHANNELS.usageGetSnapshot, message: "앱 종료 중입니다." });
      throw new Error("앱 종료 중에는 사용량을 조회할 수 없습니다.");
    }

    await options.log.write("usage-started", { startedAt: now().toISOString() });
    try {
      const response = await options.dashboardService.getDashboard();
      await options.log.write("usage-completed", {
        generatedAt: response.generatedAt,
        status: response.status,
        todayTokens: response.today?.tokens ?? null,
        todayCostUsd: response.today?.costUsd ?? null,
        limits: summarizeLimits(response)
      });

      if (response.status !== "ok") {
        for (const [source, status] of Object.entries(response.sources)) {
          if (!status.ok) {
            await options.log.write("usage-source-failed", {
              source,
              generatedAt: response.generatedAt,
              message: status.message ?? "unknown"
            });
          }
        }
      }

      return response;
    } catch (error) {
      await options.log.write("usage-exception", {
        channel: IPC_CHANNELS.usageGetSnapshot,
        message: sanitizeMessage(error)
      });
      throw error;
    }
  }

  async function handleSettingsGet(event: IpcEventLike): Promise<OverlaySettings> {
    requireSender(event, ["overlay", "settings"], IPC_CHANNELS.settingsGet);
    return options.settingsStore.get();
  }

  async function handleSettingsUpdate(event: IpcEventLike, input: unknown): Promise<SettingsUpdateResult> {
    const kind = senderKind(event);
    if (kind !== "settings") {
      await options.log.write("ipc-sender-rejected", { channel: IPC_CHANNELS.settingsUpdate, senderId: event.sender.id });
      return settingsUpdateRejected("이 창에서는 설정을 저장할 수 없습니다.");
    }

    if (options.isShuttingDown()) {
      await options.log.write("settings-update-rejected", { message: "앱 종료 중입니다." });
      return settingsUpdateRejected("앱 종료 중에는 설정을 저장할 수 없습니다.");
    }

    const result = await options.settingsStore.updateEditableSettings(input);
    if (result.ok && !options.isShuttingDown()) {
      options.broadcastSettingsChanged(result.settings);
    }

    return result;
  }

  async function updateWindowPosition(position: WindowPosition): Promise<void> {
    if (options.isShuttingDown()) {
      await options.log.write("window-position-rejected", { message: "앱 종료 중입니다." });
      return;
    }

    await options.settingsStore.updateWindowPosition(position);
  }

  function register(ipcMain: IpcMainLike): void {
    ipcMain.handle(IPC_CHANNELS.usageGetSnapshot, (event) => handleUsageGetSnapshot(event));
    ipcMain.handle(IPC_CHANNELS.settingsGet, (event) => handleSettingsGet(event));
    ipcMain.handle(IPC_CHANNELS.settingsUpdate, (event, input) => handleSettingsUpdate(event, input));
  }

  return {
    handleUsageGetSnapshot,
    handleSettingsGet,
    handleSettingsUpdate,
    updateWindowPosition,
    register
  };
}
