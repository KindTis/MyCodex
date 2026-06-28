import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_OVERLAY_SETTINGS,
  normalizeStoredSettings,
  settingsUpdateFailure,
  validateSettingsUpdateInput,
  type OverlaySettings,
  type SettingsUpdateResult,
  type WindowPosition
} from "../shared/overlaySettings.js";
import { sanitizeMessage } from "../server/utils/sanitize.js";

type FsLike = {
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  mkdir: typeof fs.mkdir;
};

type LogLike = {
  write: (event: string, fields?: Record<string, unknown>) => Promise<unknown> | unknown;
};

export type SettingsStore = ReturnType<typeof createSettingsStore>;

function cloneSettings(settings: OverlaySettings): OverlaySettings {
  return {
    ...settings,
    windowPosition: settings.windowPosition ? { ...settings.windowPosition } : undefined
  };
}

function isValidPosition(position: WindowPosition): boolean {
  return (
    typeof position.x === "number" &&
    Number.isFinite(position.x) &&
    Number.isInteger(position.x) &&
    typeof position.y === "number" &&
    Number.isFinite(position.y) &&
    Number.isInteger(position.y)
  );
}

export function createSettingsStore(options: { settingsPath: string; fsImpl?: FsLike; log?: LogLike }) {
  const fsImpl = options.fsImpl ?? fs;
  const listeners = new Set<(settings: OverlaySettings) => void>();
  let current = cloneSettings(DEFAULT_OVERLAY_SETTINGS);
  let loaded = false;
  let shuttingDown = false;
  let writeQueue = Promise.resolve();

  const log = async (event: string, fields: Record<string, unknown> = {}) => {
    await options.log?.write(event, fields);
  };

  function emitChanged(): void {
    const snapshot = cloneSettings(current);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function enqueueWrite(settings: OverlaySettings): Promise<void> {
    const payload = `${JSON.stringify(settings, null, 2)}\n`;
    const write = writeQueue.then(async () => {
      await fsImpl.mkdir(path.dirname(options.settingsPath), { recursive: true });
      await fsImpl.writeFile(options.settingsPath, payload, "utf8");
    });
    writeQueue = write.catch(() => undefined);
    return write;
  }

  async function load(): Promise<OverlaySettings> {
    if (loaded) {
      return cloneSettings(current);
    }

    try {
      const raw = await fsImpl.readFile(options.settingsPath, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        current = cloneSettings(DEFAULT_OVERLAY_SETTINGS);
        loaded = true;
        await log("settings-normalized", { reason: "malformed-json", message: sanitizeMessage(error) });
        await enqueueWrite(current).catch((writeError) =>
          log("settings-normalization-write-failed", { message: sanitizeMessage(writeError) })
        );
        return cloneSettings(current);
      }

      const normalized = normalizeStoredSettings(parsed);
      current = normalized.settings;
      loaded = true;
      if (normalized.changed) {
        await log("settings-normalized", { reason: normalized.reasons.join(", ") });
        await enqueueWrite(current).catch((writeError) =>
          log("settings-normalization-write-failed", { message: sanitizeMessage(writeError) })
        );
      }
      return cloneSettings(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await log("settings-read-failed", { message: sanitizeMessage(error) });
      }
      current = cloneSettings(DEFAULT_OVERLAY_SETTINGS);
      loaded = true;
      return cloneSettings(current);
    }
  }

  function get(): OverlaySettings {
    return cloneSettings(current);
  }

  async function updateEditableSettings(input: unknown): Promise<SettingsUpdateResult> {
    if (shuttingDown) {
      await log("settings-update-rejected", { message: "앱 종료 중입니다." });
      return settingsUpdateFailure("앱 종료 중에는 설정을 저장할 수 없습니다.");
    }

    const validation = validateSettingsUpdateInput(input);
    if (!validation.ok) {
      return { ok: false, fieldErrors: validation.fieldErrors, formError: validation.formError };
    }

    const next = { ...current, ...validation.input };
    try {
      await enqueueWrite(next);
    } catch (error) {
      await log("settings-write-failed", { message: sanitizeMessage(error) });
      return settingsUpdateFailure("설정을 저장하지 못했습니다.");
    }

    current = next;
    emitChanged();
    return { ok: true, settings: cloneSettings(current) };
  }

  async function updateWindowPosition(position: WindowPosition): Promise<void> {
    if (shuttingDown) {
      await log("window-position-rejected", { message: "앱 종료 중입니다." });
      return;
    }

    if (!isValidPosition(position)) {
      await log("window-position-invalid", { position });
      return;
    }

    current = { ...current, windowPosition: { ...position } };
    await enqueueWrite(current).catch((error) =>
      log("window-position-write-failed", { message: sanitizeMessage(error) })
    );
  }

  async function flush(): Promise<void> {
    await writeQueue;
  }

  async function beginShutdown(finalWindowPosition?: WindowPosition): Promise<void> {
    shuttingDown = true;
    if (finalWindowPosition && isValidPosition(finalWindowPosition)) {
      current = { ...current, windowPosition: { ...finalWindowPosition } };
      await enqueueWrite(current).catch((error) =>
        log("shutdown-window-position-write-failed", { message: sanitizeMessage(error) })
      );
    }

    await flush().catch((error) => log("settings-flush-failed", { message: sanitizeMessage(error) }));
  }

  function onChanged(listener: (settings: OverlaySettings) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    load,
    get,
    updateEditableSettings,
    updateWindowPosition,
    flush,
    beginShutdown,
    onChanged
  };
}
