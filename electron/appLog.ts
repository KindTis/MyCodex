import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeMessage } from "../server/utils/sanitize.js";

export type AppLog = ReturnType<typeof createAppLog>;

export type AppLogWriteResult = {
  ok: boolean;
  error?: string;
};

type FsLike = {
  appendFile: typeof fs.appendFile;
  mkdir: typeof fs.mkdir;
  rename: typeof fs.rename;
  rm: typeof fs.rm;
  stat: typeof fs.stat;
};

function sanitizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return sanitizeMessage(value);
  }

  if (typeof value === "string") {
    return sanitizeMessage(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeLogValue(entry)]));
  }

  return value;
}

export function createAppLog(options: { logDir: string; maxBytes?: number; fsImpl?: FsLike }) {
  const fsImpl = options.fsImpl ?? fs;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const logPath = path.join(options.logDir, "app.log");
  const previousLogPath = path.join(options.logDir, "app.previous.log");

  async function rotateIfNeeded(): Promise<void> {
    try {
      const stat = await fsImpl.stat(logPath);
      if (stat.size <= maxBytes) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }

    await fsImpl.rm(previousLogPath, { force: true });
    await fsImpl.rename(logPath, previousLogPath);
  }

  async function write(event: string, fields: Record<string, unknown> = {}): Promise<AppLogWriteResult> {
    try {
      await fsImpl.mkdir(options.logDir, { recursive: true });
      await rotateIfNeeded();
      const entry = {
        timestamp: new Date().toISOString(),
        event: sanitizeMessage(event),
        ...(sanitizeLogValue(fields) as Record<string, unknown>)
      };
      await fsImpl.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
      return { ok: true };
    } catch (error) {
      return { ok: false, error: sanitizeMessage(error) };
    }
  }

  return {
    logPath,
    previousLogPath,
    write
  };
}
